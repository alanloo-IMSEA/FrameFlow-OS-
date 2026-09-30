# FrameFlow OS

FrameFlow OS is I-Marketing's production workspace for AI-assisted content
operations. The active production surface supports:

- Internal Social Account
- Client Social Account

Other project workflows remain preserved in the source and data model but are
hidden until they are reactivated.

## Current release

- Version: 223
- Runtime: ChatGPT Sites and standalone Cloudflare Workers
- Verification: 136 automated checks
- UI languages: English and Simplified Chinese

The Chinese interface translates system UI while preserving prompts, Brief
content, project/file names, generated production details, and user-entered
values in their original language.

## Production safeguards

- Approved Content is preserved during partial Retakes.
- Only explicitly selected Reel Retakes are sent to RunningHub.
- Duplicate review submissions are rejected idempotently.
- Automatic social publishing remains dormant and hidden.
- Generation failures stop the affected queue and notify management.

## Requirements

- Node.js `>=22.13.0`
- Linux with `flock`, `curl`, and GNU `timeout`

## Development

```sh
npm ci
npm run dev
```

Verification:

```sh
npm test
```

## Deployment

- ChatGPT Sites uses `.openai/hosting.json` and `npm run build`.
- Standalone Cloudflare uses `npm run build:cloudflare`, then
  `npm run deploy:cloudflare`.

Read [CLOUDFLARE_DEPLOYMENT.md](./CLOUDFLARE_DEPLOYMENT.md) before configuring
Workers Builds, D1, R2, Images, runtime secrets, or Cloudflare Access.

Never commit API keys, OAuth secrets, access tokens, database exports, or
production media to this repository.
