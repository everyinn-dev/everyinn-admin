# Every Inn Admin — Agent Index

This directory is the local index for AI guidance, MCP templates, and project conventions used by `everyinn-admin`.

## Start here
1. `AGENTS.md`
2. `CLAUDE.md`
3. `.agents/README.md`
4. `.agents/rules/cloudflare-free-tier.md`
5. `.mcp.json.example`
6. `.agents/mcp_config.example.json`

## Local agent files already in this repo
- `.agents/rules/cloudflare-free-tier.md` — Cloudflare Workers + D1 free-tier infrastructure guardrails.
- `.agents/skills/cloudflare-expert/SKILL.md` — local Cloudflare architecture skill bundle (synced from every-inn-booking).
- `.agents/skills/ui-ux/SKILL.md` — UI/UX design skill bundle (synced from every-inn-booking).
- `.mcp.json` — local gitignored MCP config for this checkout only.
- `.mcp.json.example` — portable MCP template for clients that read `.mcp.json`.
- `.agents/mcp_config.json` — local gitignored MCP config for clients that expect `serverUrl` entries.
- `.agents/mcp_config.example.json` — MCP template for clients that expect `serverUrl` entries.

## Recommended MCP servers for this project
### Cloudflare
- `cloudflare-docs` — public Cloudflare documentation search.
- `cloudflare` — Cloudflare Code Mode / API access.
- `cloudflare-bindings` — bindings management.
- `cloudflare-builds` — build log inspection.
- `cloudflare-observability` — logs, metrics, and tracing.

### Project-adjacent tooling
- `cloudinary` — asset management for the `everyinn` Cloudinary account.
- `shadcn` — shadcn component MCP.
- `agentic-awesome-skills` — external skills catalog MCP.

## Cloudflare token security
For authenticated Cloudflare MCP servers, use a token created from **Cloudflare Dashboard → Profile → API Tokens → Edit Cloudflare Workers**.

Minimum scopes called out by the project brief:
- `Account: Workers Scripts (Edit)`
- `Account: D1 (Edit)`
- `Account Settings (Read)`

Rules:
- Never commit active bearer tokens.
- Keep real secrets only in local ignored files such as `.mcp.json` or `.agents/mcp_config.json`.
- Treat production D1 execution and destructive SQL as confirmation-required actions.

## Project conventions to preserve
- Runtime stack: Next.js 16 App Router + React 19 + TypeScript + Cloudflare Workers via OpenNext.
- Cloudflare Worker constraints are mandatory: stateless design, tight CPU budgets, and indexed D1 access.
- UI direction: dark slate surfaces with amber brand accents, with emerald and purple status colors.
- Use toast-based notifications instead of `window.alert()` / `window.confirm()`.
- Prefer Cloudflare-native integrations for email, anti-spam, observability, and storage.
- Keep performance and accessibility visible in frontend work; the project brief targets strong Core Web Vitals and a11y hygiene.

## Related machine-wide skills that fit this project
These are not checked into this repo, but they are relevant to this workspace if installed globally:
- `nextjs-on-cloudflare`
- `workers-best-practices`
- `wrangler`
- `durable-objects`
- `agents-sdk`
- `cloudflare-email-service`
- `turnstile-spin`
- `web-perf`

## Desired skill buckets from the project brief
The brief also calls out these domains as important conventions to preserve, even if they are not all checked into this repo as local skill folders yet:
- `cloudflare-expert`
- `ui-ux`
- `modern-web-guidance`
- `chrome-devtools`
- `a11y-debugging`
- `debug-optimize-lcp`
- `accidental-data-loss-prevention`

## Cross-project note
The sibling repo `booking-page/every-inn-booking` already contains local skill bundles in `.agents/skills/` (`cloudflare-expert`, `ui-ux`) plus a matching `.mcp.json.example`. Use that repo as the nearest checked-in reference when you need an existing local skill implementation.

