# Launch Lab

**A shared ledger for go-to-market experiments.** Each launch bet gets its own tracked links, a funnel measured from real events, and an AI verdict that code checks against the numbers before an admin approves it into the team playbook.

**Live:** https://launchlab.app.space · built on [DeepSpace](https://deep.space)

> Sign in with GitHub or Google. Signed-out visitors see the board with labelled sample rows. Admins can load a clearly-marked **SAMPLE** ledger from Settings.

## Why this app

Developer tools grow through many small launches: a Show HN, a Reddit post, a creator thread, a fork-this-repo campaign. Tools exist for *finding* attention (keyword monitors, reply drafters). What's usually missing is the step after: **did that post actually produce developers, and should we do more of it?** Today that's a spreadsheet of hand-typed numbers and a gut call.

Launch Lab is that step, and it's built to keep evidence and assumption apart:

1. **Measured.** Every channel gets its own `/go/<code>` link. The worker records each click server-side, drops bots, link unfurlers and browser prefetch, and marks repeat visits. Signups, activation and payment arrive from the product's backend through `POST /api/convert`. Nothing in the funnel is typed in by hand.
2. **Judged.** Claude writes the judgment: assumptions and the smallest next test. The "proven" list is **computed in code** from stored records, and a **code guardrail** decides which decisions the data allows. The AI can't over-claim a fact or call a result on too little data.
3. **Kept.** An admin approves verdicts into a Playbook, ordered expand → change → stop.

## What's in it

| Area | What it does |
|---|---|
| Experiments | Hypothesis, channel, smallest test, pass bar (unique humans), destination |
| Tracked links | `/go/<code>` → 302 to the stored destination with UTM tags; click written in `waitUntil` so the redirect isn't slowed |
| Click hygiene | Bot/unfurler/prefetch filter; per-link 24 h cookie marks repeats (no IP, no user agent stored) |
| Measured funnel | `POST /api/convert` with a per-experiment key; idempotent by `(experiment, event, externalId)` |
| GitHub attention | Star/fork snapshots of the repo an experiment targets; refreshed daily for running experiments |
| AI verdict | Claude judgment + computed facts + guardrail; the model's original proposal and any override are stored |
| Playbook | Admin-approved verdicts |
| Notifications | Email when an experiment reaches its bar, and when a teammate's verdict needs approval |
| Team | Live "also viewing" presence; admin-only member removal and cascading experiment delete |

## DeepSpace: what I used and why

**Platform primitives (instead of hand-rolling them):**

- **Auth + RBAC records.** One shared team ledger. Members read everything and edit only what they created. `clicks`, `verdicts`, `signals` and `conversions` deny client writes entirely, so a browser can't forge a click or a verdict. Conversion-key hashes are readable only by their creator. `uniqueOn` enforces one-link-per-code and one-conversion-per-user at the room.
- **Realtime sync.** Click counts, the funnel and verdicts update live for everyone on the page.
- **Presence rooms.** "Also viewing" per experiment.
- **Server actions.** AI review, approval, signal refresh and admin cleanup run server-side and re-check the caller's role. The UI hiding a button is never the protection.
- **Cron room.** A daily GitHub snapshot of running experiments.
- **Custom worker routes.** `/go/:code` (public, anonymous) and `/api/convert` (server-to-server, key-authenticated).

**Integrations (3):**

| Integration | Why it earns its place |
|---|---|
| `anthropic/chat-completion` | The judgment layer. Uses `claude-haiku-4-5`: the task is small and strictly constrained, so the cheapest model is enough. 60 s cooldown per experiment because the owner pays. |
| `github/get-repository` | "Fork this repo" campaigns are a real DeepSpace motion; stars/forks are the attention metric for them. No GitHub token lives in the app. |
| `email/send` | Experiments run for days and nobody watches a dashboard. The email lands at the decision moment. Plain text only; links built server-side. |

**Deliberately left out:**

- **X/Twitter engagement (`twitterapi`).** Planned as a fourth signal, but the integration's upstream provider returned *"Credits is not enough"* during the build. I replaced it rather than ship a panel that errors.
- **Web search (Exa/SERP).** Finding conversations is a separate job that monitoring tools already do. Search results are also noisy as *evidence*.
- **Payments, LiveKit, file uploads, collaborative docs.** They don't help a team decide what to do next.

## The main tradeoff

**Trust over fluency.** The easy version lets the model read everything and write the whole analysis. It reads well, and testing it showed why that's dangerous: on 5 clicks out of a 50 target, it recommended STOP while saying the sample was too small. It also listed "4 clicks were direct, not from Reddit" as *proven*, but "direct" only means the referrer was missing.

So the AI was demoted:
- Facts are computed in code (`src/lib/verdict-rules.ts`) and never generated.
- Missing referrers are labelled *unknown*, never "direct".
- A guardrail decides what's allowed. **No decision below 20 unique humans**, **no EXPAND below the pass bar**, **no STOP before half the bar**. The model's own proposal is stored next to the final decision.
- An admin approves before anything reaches the Playbook.

The cost is less flexible prose and a rule set someone has to own. The gain is that every number in a verdict can be defended in a meeting.

A second, smaller tradeoff is scope: **one shared team space** (every signed-in user is a member), not multi-tenant workspaces. That fits a single GTM team and kept the five-day scope honest. See *What's next*.

## Security notes

- Secrets live in the platform secret store and `.dev.vars` (git-ignored). The repo and its history contain none.
- Conversion keys are generated in the browser, shown once, and stored only as SHA-256. A key is accepted only if its creator owns the experiment (or is an admin).
- `/go` never redirects to a request-supplied URL, only the stored destination (no open redirect).
- Emails are plain text. User-written text is flattened to one line, and links come from `APP_NAME`, not client input.
- Recipient emails are read server-side and never returned to clients.

## Testing

```bash
npx vitest run src      # 21 unit tests: guardrail, computed facts, repo parsing, sample ledger
npx tsc --noEmit && npx eslint src --max-warnings 0
```

The core flows were verified by hand on the live site with two real accounts: permissions, presence, emails, the funnel, AI review and approval. See *How this was built*.

## Run it locally

```bash
npm install          # npm 11.6+ (npx -y npm@11 install)
npx deepspace auth login
npx deepspace dev start
```

## What's next

- **Workspaces:** per-team scopes so separate teams don't share one ledger.
- **Per-channel minimum samples:** the 20-person floor is a fixed constant today.
- **Expose the ledger to coding agents** with DeepSpace local agent tools (create experiment, mint link, read verdict) so a GTM engineer can run it from their terminal.
- **X engagement** once the `twitterapi` provider is funded again.
- **A Playwright two-user spec** covering what was checked by hand.

## How this was built

Built with Claude Code as the coding agent, directed and checked step by step by me.

**The agent** scaffolded the app, wrote the schemas, routes, actions, UI and tests, read the DeepSpace docs before each area, and ran the type checks, lint, unit tests and deploys.

**I verified** each flow myself, in the browser and in my inbox, before moving on: tracked links counting live, bot and repeat filtering, the AI verdict, approval into the Playbook, the GitHub snapshot, both emails, the measured funnel, and a two-account permissions and presence test on the live site.

Several of those checks changed the design:
- A double-counted click led to repeat detection.
- An over-confident verdict led to computed facts and the guardrail.
- A live STOP on 2 clicks led to the 20-person minimum.
- Fragile key copy-pasting led to the built-in "Send test signup" check.
