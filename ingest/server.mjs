import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import postgres from 'postgres';
import { z } from 'zod';

/**
 * Canopy Website — Demo-form ingest shim
 *
 * A deliberately tiny service that sits inside the cluster (namespace
 * `canopy-website`) and is the ONLY thing exposed to the public internet
 * (via Tailscale Funnel on 443). It accepts one authenticated POST, validates
 * it, and writes a single row to Postgres over the in-cluster ClusterIP.
 *
 * The database itself is never exposed — Vercel cannot reach raw Postgres over
 * Tailscale Funnel, so the flow is: browser -> Vercel function (same origin) ->
 * this shim (Funnel 443, shared-secret bearer) -> Postgres (ClusterIP).
 */

const PORT = parseInt(process.env.PORT || '8080', 10);
const INGEST_SECRET = process.env.INGEST_SECRET;

if (!INGEST_SECRET) {
  console.error('FATAL: INGEST_SECRET is not set. Refusing to start.');
  process.exit(1);
}

const sql = postgres({
  host: process.env.PGHOST || 'canopy-website-db',
  port: parseInt(process.env.PGPORT || '5432', 10),
  user: process.env.PGUSER || 'canopy_website',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || 'canopy_website',
  max: parseInt(process.env.PG_MAX_CONNECTIONS || '5', 10),
  idle_timeout: 20,
  connect_timeout: 10,
  // In-cluster ClusterIP hop — no TLS needed on this leg.
  ssl: false,
});

// Mirrors canopy-website/src/lib/schema.ts so the shim and the site agree.
const DemoSubmissionSchema = z.object({
  companyName: z.string().min(1).max(255).trim(),
  contactName: z.string().min(1).max(255).trim(),
  email: z.string().email().max(255).toLowerCase().trim(),
  phone: z.string().max(50).optional().default(''),
  companySize: z.enum(['', '1-10', '11-50', '51-200', '200+']).optional().default(''),
  message: z.string().max(5000).optional().default(''),
});

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/** Constant-time bearer-token check. */
function authorized(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = Buffer.from(token);
  const b = Buffer.from(INGEST_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readBody(req, limitBytes = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) throw new Error('payload too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const server = createServer(async (req, res) => {
  // Health check — unauthenticated, used by k8s probes.
  if (req.method === 'GET' && req.url === '/healthz') {
    try {
      await sql`SELECT 1`;
      return json(res, 200, { status: 'healthy', database: 'connected' });
    } catch (err) {
      return json(res, 503, { status: 'unhealthy', database: 'disconnected' });
    }
  }

  // The one real route.
  if (req.method === 'POST' && req.url === '/demo') {
    if (!authorized(req)) {
      return json(res, 401, { error: 'unauthorized' });
    }

    let raw;
    try {
      raw = await readBody(req);
    } catch {
      return json(res, 413, { error: 'payload too large' });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json(res, 400, { error: 'invalid JSON' });
    }

    const result = DemoSubmissionSchema.safeParse(parsed);
    if (!result.success) {
      return json(res, 400, {
        error: 'validation failed',
        details: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }
    const data = result.data;

    const rawIp =
      (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
      (req.headers['x-real-ip'] || '').toString().trim();
    // ip_address is an INET column — only store values that look like an IP
    // (v4 or v6), otherwise NULL. Guards against "unknown"/hostnames -> cast error.
    const ip = /^[0-9a-fA-F:.]{3,}$/.test(rawIp) ? rawIp : null;
    const userAgent = (req.headers['x-original-user-agent'] || req.headers['user-agent'] || '').toString().slice(0, 2000) || null;
    const referrer = (req.headers['x-original-referer'] || '').toString().slice(0, 2000) || null;

    try {
      const rows = await sql`
        INSERT INTO demo_submissions
          (company_name, contact_name, email, phone, company_size, message, ip_address, user_agent, referrer)
        VALUES
          (${data.companyName}, ${data.contactName}, ${data.email},
           ${data.phone || null}, ${data.companySize || null}, ${data.message || null},
           ${ip}, ${userAgent}, ${referrer})
        RETURNING id, submitted_at
      `;
      const row = rows[0];
      console.log(`demo submission stored: ${row?.id} (${data.companyName})`);
      return json(res, 200, { success: true, id: row?.id, submitted_at: row?.submitted_at });
    } catch (err) {
      console.error('database insert failed:', err instanceof Error ? err.message : err);
      return json(res, 502, { error: 'failed to store submission' });
    }
  }

  // Everything else — no query surface, no method fallbacks.
  return json(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`canopy-website ingest listening on :${PORT}`);
});

// Graceful shutdown so in-flight inserts finish and the pool closes cleanly.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    console.log(`${sig} received, shutting down`);
    server.close(() => sql.end({ timeout: 5 }).then(() => process.exit(0)));
  });
}
