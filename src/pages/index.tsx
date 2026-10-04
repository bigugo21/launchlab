/**
 * Design Direction
 *
 * Product: a shared ledger where a dev-tools GTM team logs each launch bet,
 *   measures what it actually produced (tracked clicks → signups → activation),
 *   and gets an AI verdict that code checks against the numbers.
 * Emotion: the quiet relief of a number you can defend in a meeting.
 * Metaphor: a lab notebook page — ruled lines, a reading in pencil, and a
 *   rubber stamp pressed at the bottom once the evidence is in.
 * References: Field Notes memo books; a ship's logbook; the departure-board
 *   flap of a train station when a number settles.
 * Signature: the verdict stamp — CHANGE / EXPAND / STOP — landing on a
 *   ledger card only after the counts finish ticking.
 * Hero: a live ledger card: unique humans count up, a link-preview bot is
 *   struck through and excluded, then the stamp lands with the rule it obeyed.
 *
 * Style Tile
 * - Color: warm paper background, ink foreground, one signal-orange accent for
 *   "act on this"; decisions use the theme's success / warning / destructive.
 * - Type: IBM Plex Sans for words, IBM Plex Mono for every measured number —
 *   a technical pair that makes evidence look like instrument readings.
 * - Theme: light — a notebook on a desk, not a terminal at night.
 * - Art direction: editorial-technical; ruled lines, no illustrations.
 * - Motion: precise — counts settle, one stamp press, nothing loops.
 * - Voice: plain numbers; says what is unknown; never promises growth.
 *
 * Static page (top level of src/pages): no providers, prerendered at build.
 * Animation is CSS keyframes gated by prefers-reduced-motion in styles.css.
 */

import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div data-testid="static-landing" className="min-h-screen bg-background text-foreground">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <span className="text-sm font-semibold tracking-tight">
            Launch Lab<span className="text-primary">.</span>
          </span>
          <Link to="/home" className="text-sm text-muted-foreground hover:text-foreground">
            Open the lab →
          </Link>
        </header>

        <main className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 pb-20 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pt-16">
          <section>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">GTM experiment ledger</p>
            <h1 className="mt-4 break-words text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Every launch, judged by evidence.
            </h1>
            <p className="mt-6 max-w-md text-base text-muted-foreground">
              Track each post with its own link, measure signups from your backend, and get an AI
              verdict that code checks against the numbers before anyone approves it.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/home"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Open the lab <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <span className="font-mono text-xs text-muted-foreground">sign in with GitHub or Google</span>
            </div>
          </section>

          <LedgerCard />
        </main>

        <section className="border-t border-border bg-card">
          <ol className="mx-auto max-w-6xl divide-y divide-border px-4 sm:px-6">
            <LedgerRow n="01" term="Measured">
              Bots, link previews and repeat visits are excluded before a click counts. Signups arrive
              from your backend, never typed in.
            </LedgerRow>
            <LedgerRow n="02" term="Judged">
              Claude writes the assumptions and the next test. Code decides which verdicts the data
              allows.
            </LedgerRow>
            <LedgerRow n="03" term="Kept">
              An admin approves each verdict into the team playbook, so the next launch starts from
              what worked.
            </LedgerRow>
          </ol>
        </section>

        <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-xs text-muted-foreground sm:px-6">
          <span>Built on DeepSpace — auth, realtime records, integrations, cron.</span>
          <Link to="/home" className="font-medium text-foreground hover:text-primary">
            Start an experiment →
          </Link>
        </footer>
      </div>
    </>
  )
}

function LedgerRow({ n, term, children }: { n: string; term: string; children: React.ReactNode }) {
  return (
    <li className="grid gap-2 py-6 md:grid-cols-[12rem_1fr] md:gap-8">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-xs text-muted-foreground">{n}</span>
        <span className="text-lg font-semibold">{term}</span>
      </div>
      <p className="text-sm text-muted-foreground md:pt-1">{children}</p>
    </li>
  )
}

/**
 * Hero visual: a ledger card built from markup (no screenshot). Numbers are
 * the final values in the HTML (crawlers and reduced-motion users see the end
 * state); the count-up and stamp are CSS-only flourishes.
 */
function LedgerCard() {
  const rows = [
    { t: '14:02', src: 'news.ycombinator.com', tag: 'human', cls: 'text-primary' },
    { t: '14:02', src: 'slackbot link preview', tag: 'bot', cls: 'text-muted-foreground line-through' },
    { t: '14:05', src: 'x.com', tag: 'human', cls: 'text-primary' },
    { t: '14:07', src: 'source unknown', tag: 'repeat', cls: 'text-muted-foreground line-through' },
  ]
  return (
    <figure
      aria-label="Example experiment card"
      className="relative rounded-lg border border-border bg-card p-6 shadow-sm"
    >
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">Show HN: clone Slack in an afternoon</span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">running</span>
      </figcaption>

      <dl className="mt-6 grid grid-cols-3 gap-4">
        <Reading label="unique humans" value="34" sub="of 50 needed" />
        <Reading label="signed up" value="6" sub="measured" />
        <Reading label="activated" value="2" sub="first deploy" />
      </dl>

      <ul className="mt-6 space-y-1.5 font-mono text-xs">
        {rows.map((r, i) => (
          <li key={i} className="ledger-row flex gap-3" style={{ animationDelay: `${0.25 + i * 0.25}s` }}>
            <span className="text-muted-foreground">{r.t}</span>
            <span className={`flex-1 truncate ${r.cls}`}>{r.src}</span>
            <span className="text-muted-foreground">{r.tag}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex items-end justify-between gap-4 border-t border-border pt-4">
        <p className="max-w-[16rem] text-xs text-muted-foreground">
          AI proposed <span className="font-mono">EXPAND</span>. Rule: expanding needs the bar cleared —
          34 of 50.
        </p>
        <span className="ledger-stamp rounded-md border-2 border-warning px-3 py-1 font-mono text-sm font-semibold tracking-widest text-warning">
          CHANGE
        </span>
      </div>
    </figure>
  )
}

function Reading({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="ledger-count mt-1 font-mono text-3xl font-medium tabular-nums">{value}</dd>
      <dd className="text-[11px] text-muted-foreground">{sub}</dd>
    </div>
  )
}
