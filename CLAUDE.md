# Cost policy (hard constraint — read before doing anything)

**We do not pay for any additional cost, under any circumstance, without explicit prior approval from the user.**

This applies to all three repos in this project (`evexec`, `evexecoperator`, `evexecdriverapp`) and to the shared Supabase project (`yoltkmhtxwluqxxpewbl`) they all depend on.

- **No new billed resources, ever, without asking first.** This includes (not an exhaustive list): Supabase database branches, additional Supabase projects, upgraded Supabase/Vercel plan tiers or add-ons, new paid third-party APIs or SaaS tools, additional cloud compute, paid monitoring/observability tiers, domain purchases, etc.
- **The one standing exception is SMS notifications via Twilio.** SMS is an already-accepted, already-capped fallback channel used only when email/push delivery fails. Do not remove or degrade that existing usage — but also do not expand SMS volume or add new SMS-triggering flows without approval, since it's the one channel that isn't free.
- **Before taking any action that would create a new billed resource or increase spend on an existing one, stop and ask.** This applies even to trivially small amounts (pennies, hourly micro-charges) — the rule is "always ask first," not "ask only above some threshold."
- **Prefer free tiers and already-provisioned infrastructure.** When a task could be done either by spinning up a paid resource (e.g. a Supabase branch to test a migration) or by a slower/more careful free alternative (e.g. read-only validation queries plus additive, reversible migrations applied directly, with review), default to the free alternative unless the user has explicitly approved the paid one.
- Abandon or redesign any plan that turns out to require a new cost, rather than proceeding and asking forgiveness after the fact.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
