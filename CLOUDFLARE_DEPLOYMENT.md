# FrameFlow Cloudflare deployment

FrameFlow deploys as a full-stack Cloudflare Worker. Cloudflare Pages is not
used. ChatGPT Sites remains supported by the same source tree.

## Required Workers Builds settings

- Root directory: the repository directory containing `package.json`
- Build command: `npm run build:cloudflare`
- Deploy command: `npm run deploy:cloudflare`

Add these non-secret build variables:

- `FRAMEFLOW_WORKER_NAME=frameflow-os`
- `CLOUDFLARE_D1_DATABASE_ID=<production D1 UUID>`
- `CLOUDFLARE_D1_DATABASE_NAME=frameflow-production-db`
- `CLOUDFLARE_R2_BUCKET_NAME=frameflow-production-assets`

The build generates `.cloudflare/wrangler.jsonc`. It binds:

- D1 as `DB`
- R2 as `BUCKET`
- Cloudflare Images as `IMAGES`
- Worker static assets as `ASSETS`

## Database

After the first successful configuration build, initialize a new database once:

```sh
npm run db:migrate:cloudflare
```

The production database uses the canonical SQL in `drizzle-baseline/`.

## Authentication

Protect the production hostname with Cloudflare Zero Trust Access before team
use. FrameFlow accepts the Access-authenticated email header and normalizes it
to the existing application identity header. Do not expose an unprotected
`workers.dev` hostname as the production application.

## Runtime secrets

Add secrets under Worker Settings > Variables and Secrets. Do not add them as
GitHub files or plaintext build variables.

- `FRAMEFLOW_INTEGRATION_KEY`
- `GOOGLE_DRIVE_CLIENT_ID`
- `GOOGLE_DRIVE_CLIENT_SECRET`
- `GOOGLE_DRIVE_REDIRECT_URI`
- `GOOGLE_DRIVE_TOKEN_KEY`
- `PUBLISHING_STORAGE_SECRET` (only if dormant publishing is re-enabled)
- `PUBLISHING_STORAGE_URL` (only if dormant publishing is re-enabled)

RunningHub, Telegram, LLM, and social-provider credentials that are managed in
FrameFlow's Integrations UI are encrypted in D1 by
`FRAMEFLOW_INTEGRATION_KEY`; migrate them only through a controlled export and
import using the same key.
