# TransitionOS

TransitionOS is an internal knowledge-transition system for:

- employee handover (leave, transfer, owner rotation)
- successor/new-hire onboarding
- manager review, approval, and progress tracking

It combines source ingestion, structured generation, citation traceability, checklist tracking, approval gates, and export in one workflow.

## Tech Stack

- Next.js (App Router, API routes, TypeScript)
- Prisma + PostgreSQL
- Tailwind CSS
- Demo RBAC (no enterprise SSO in MVP)
- Connector adapters (GitHub, Notion, Slack, Jira; MVP focus is GitHub + Notion)

## Core Capabilities

- Transition task lifecycle with state tracking
- Source connectors with admin management and connection test
- Handover draft + onboarding pack generation
- Citation mapping for each generated section
- Versioned edits for draft/onboarding content
- Approval workflow with readiness gates
- New-hire checklist completion tracking
- Export (Markdown + HTML-to-PDF flow)
- Ghost Chat (retrieval mode, with optional LLM mode when configured)

## Main Screens

- `/login`
- `/dashboard`
- `/tasks/new`
- `/tasks/[id]/manage`
- `/tasks/[id]/draft`
- `/tasks/[id]/onboarding`
- `/tasks/[id]/checklist`
- `/tasks/[id]/approval`
- `/tasks/[id]/export`
- `/admin/settings`
- `/guide` (full operation guide)

## Data Model

Main tables:

- `users`
- `transition_tasks`
- `source_connections`
- `source_items`
- `handover_drafts`
- `onboarding_packs`
- `citations`
- `checklist_items`
- `approvals`
- `audit_logs`
- `generation_jobs`

Task status flow:

`DRAFT -> INGESTING -> GENERATED -> IN_REVIEW -> CHANGES_REQUESTED/APPROVED -> EXPORTED`

## Local Setup

1. Copy environment file.
   - PowerShell: `Copy-Item .env.example .env`
2. Install dependencies.
   - `npm install`
3. Start PostgreSQL.
   - `docker compose up -d db`
4. Generate Prisma client + apply schema.
   - `npm run prisma:generate`
   - `npx prisma db push`
5. Seed demo data.
   - `npm run prisma:seed`
6. Run application.
   - `npm run dev`
7. Optional job worker.
   - `npm run worker`

## One-command Start (Windows)

- Stable mode: `.\start-local.ps1`
- Stable mode in background: `.\start-local.ps1 -Background`
- Dev mode: `.\start-local.ps1 -Dev`
- Dev mode in background: `.\start-local.ps1 -Dev -Background`
- Skip DB startup: `.\start-local.ps1 -SkipDb`

## Demo Accounts

Use `/login` to switch seeded users:

- `admin@transitionos.local`
- `manager@transitionos.local`
- `employee@transitionos.local`
- `successor@transitionos.local`
- `mentor@transitionos.local`

## Recommended Demo Flow

1. Login as `admin@transitionos.local`.
2. Go to `/admin/settings` and create real source connections.
3. Create task in `/tasks/new` and select the target sources.
4. Open draft page and click `Generate / Refresh`.
5. Review citations, edit content, and create a new version.
6. Complete checklist items from successor/mentor perspective.
7. Approve as manager.
8. Export Markdown/PDF.

## Environment Variables

See `.env.example`:

- `DATABASE_URL`
- `APP_BASE_URL`
- `OPENAI_API_KEY` (optional)
- `OPENAI_MODEL` (optional)
- `DEMO_ALLOW_UNAUTH_FALLBACK`

If `OPENAI_API_KEY` is missing, system falls back to deterministic retrieval summaries.

## Testing

- Unit/integration: `npm test`
- E2E (Playwright): `npm run test:e2e`
- Build check: `npm run build`

## Share With Others

Best practice:

1. Push source code to a **private GitHub repository**.
2. Keep `.env` and real tokens out of git.
3. Share this README + demo script (`DEMO_SCRIPT_ZH.md`) with teammates.
4. Provide either:
   - local run instructions, or
   - deployed URL + test accounts.

## Security Notes

- Do not commit `.env` or connector tokens.
- Rotate any token that was exposed in screenshots/chat.
- Use read-only scopes for GitHub/Notion/Slack/Jira tokens.

## Project Files

- Demo script (Traditional Chinese): `DEMO_SCRIPT_ZH.md`
- Docker setup: `docker-compose.yml`
- Local startup helper: `start-local.ps1`
