import type { APIRoute } from 'astro';
import { DemoSubmissionSchema } from '../../lib/schema';

// This endpoint must run on-demand as a Vercel serverless function. Without
// this, `output: 'static'` would try to prerender it and the POST would 404
// in production.
export const prerender = false;

/**
 * Demo-form submission.
 *
 * The lead database lives in the homelab Kubernetes cluster and is NOT
 * reachable from Vercel directly (Tailscale Funnel can't tunnel raw Postgres,
 * and Vercel functions aren't tailnet members). So this function validates the
 * submission and forwards it to the in-cluster ingest shim over HTTPS
 * (Tailscale Funnel :443, authenticated with a shared secret). The shim writes
 * to Postgres.
 *
 * If the shim is unreachable or unconfigured, we fall back to an email
 * notification via Resend so a lead is never silently lost.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  let data;
  try {
    data = await request.json();
  } catch {
    return json(400, { error: 'Invalid JSON in request body' });
  }

  const parsed = DemoSubmissionSchema.safeParse(data);
  if (!parsed.success) {
    return json(400, {
      error: 'Validation failed',
      errors: parsed.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  const submission = parsed.data;

  const ingestUrl = import.meta.env.INGEST_URL;
  const ingestSecret = import.meta.env.INGEST_SECRET;

  // Preserve real client metadata for the shim's audit trail (server-to-server
  // hop would otherwise mask the browser's IP / UA / referrer).
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    clientAddress ||
    'unknown';

  if (ingestUrl && ingestSecret) {
    try {
      const res = await fetch(ingestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ingestSecret}`,
          'x-forwarded-for': ip,
          'x-original-user-agent': request.headers.get('user-agent') || '',
          'x-original-referer': request.headers.get('referer') || '',
        },
        body: JSON.stringify(submission),
        // Don't let a slow homelab hang the request forever.
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        return json(200, {
          success: true,
          id: body.id,
          message: 'Thank you! We will be in touch within 24 hours.',
        });
      }
      console.error(`Ingest returned ${res.status}: ${await res.text().catch(() => '')}`);
    } catch (err) {
      console.error('Ingest request failed:', err instanceof Error ? err.message : err);
    }
    // fall through to email fallback below
  } else {
    console.warn('INGEST_URL/INGEST_SECRET not configured; using email fallback');
  }

  // Fallback: email the lead so it is never lost. Still report success to the
  // user (we have their submission via email).
  await sendFallbackEmail(submission);
  return json(200, {
    success: true,
    message: 'Thank you! We will be in touch within 24 hours.',
  });
};

async function sendFallbackEmail(s: {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  companySize?: string;
  message?: string;
}) {
  const apiKey = import.meta.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('No RESEND_API_KEY; lead could not be stored OR emailed:', s.email);
    return;
  }
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: 'Canopy Website <hello@canopy.ag>',
      to: ['hello@canopy.ag'],
      subject: `Demo Request (email fallback): ${s.companyName}`,
      html: `
        <h2>New Demo Request (stored via email fallback because DB ingest is unavailable)</h2>
        <p><strong>Company:</strong> ${s.companyName}</p>
        <p><strong>Contact:</strong> ${s.contactName}</p>
        <p><strong>Email:</strong> ${s.email}</p>
        <p><strong>Phone:</strong> ${s.phone || 'N/A'}</p>
        <p><strong>Company Size:</strong> ${s.companySize || 'N/A'}</p>
        <p><strong>Message:</strong> ${s.message || 'N/A'}</p>
      `,
    });
  } catch (err) {
    console.error('Fallback email failed:', err instanceof Error ? err.message : err);
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
