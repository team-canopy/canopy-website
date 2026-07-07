# canopy-website ingest shim

The demo form on canopy.ag stores leads in a Postgres database that runs in the
homelab Kubernetes cluster. Vercel serverless functions **cannot** reach that
database directly — Tailscale Funnel only forwards HTTPS-style traffic on
443/8443/10000, not raw Postgres (5432), and Vercel functions are not tailnet
members. So the write path is:

```
browser
  → POST /api/submit-demo        (Vercel function, same origin, no CORS)
    → POST <INGEST_URL>/demo     (this shim, Tailscale Funnel :443, Bearer INGEST_SECRET)
      → INSERT demo_submissions  (Postgres, in-cluster ClusterIP)
```

This service is the only thing exposed publicly. It has exactly one route
(`POST /demo`), requires a shared-secret bearer token, validates input with the
same Zod schema the site uses, and performs a single parameterized INSERT. There
is no query/read surface.

## Endpoints

| Method | Path       | Auth            | Purpose                         |
|--------|------------|-----------------|---------------------------------|
| POST   | `/demo`    | `Bearer` secret | Validate + insert one submission |
| GET    | `/healthz` | none            | Liveness/readiness (SELECT 1)   |

Anything else returns `404`.

## Environment

| Var                 | Required | Default             | Notes                                   |
|---------------------|----------|---------------------|-----------------------------------------|
| `INGEST_SECRET`     | yes      | —                   | Shared bearer token (also set in Vercel) |
| `PGHOST`            | no       | `canopy-website-db` | ClusterIP service of the database        |
| `PGPORT`            | no       | `5432`              |                                          |
| `PGUSER`            | no       | `canopy_website`    |                                          |
| `PGPASSWORD`        | yes      | —                   | From the `canopy-website-db-credentials` secret |
| `PGDATABASE`        | no       | `canopy_website`    |                                          |
| `PG_MAX_CONNECTIONS`| no       | `5`                 |                                          |
| `PORT`              | no       | `8080`              |                                          |

## Local run

```bash
npm install
INGEST_SECRET=dev-secret PGHOST=localhost PGPASSWORD=... npm start
curl -sS localhost:8080/healthz
curl -sS -X POST localhost:8080/demo \
  -H 'Authorization: Bearer dev-secret' -H 'Content-Type: application/json' \
  -d '{"companyName":"Test Co","contactName":"Jane","email":"jane@test.com"}'
```

## Image

Built + published by `.github/workflows/ingest-image.yml` to
`ghcr.io/canopy-ag/canopy-website-ingest`. The deployment in
`canopy-k8s-configs/canopy-tools/canopy-website-ingest/` pins an immutable tag.
