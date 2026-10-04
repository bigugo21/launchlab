/**
 * Example gated page. Reached at /settings — no auth logic lives here
 * because (protected)/_layout.tsx already wraps the subtree in <AuthGate>.
 */

import { useState } from 'react'
import { signOut, useUser, useUsers } from 'deepspace'
import { Button, ConfirmModal, useToast } from '@/components/ui'
import { callAction } from '../../../components/verdicts'

export default function SettingsPage() {
  const { user } = useUser()

  return (
    // No background on page wrappers — pages render into whatever the app's
    // (app)/_layout provides (a plain background, or a raised panel), so they
    // stay transparent and inherit it.
    <div className="min-h-full text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="mb-12 text-4xl font-bold tracking-tight">Settings</h1>

        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Your account</h2>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="text-foreground">{user?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="text-foreground">{user?.email ?? '—'}</dd>
            </div>
          </dl>

          <Button variant="secondary" className="mt-6" onClick={() => signOut()}>
            Sign out
          </Button>
        </section>

        {user?.role === 'admin' && <TeamSection selfId={user.id} />}
        {user?.role === 'admin' && <SampleDataSection />}
      </div>
    </div>
  )
}

/** Admin-only member list with removal (profile row only — see actions/admin.ts). */
function TeamSection({ selfId }: { selfId: string }) {
  const { users, usersLoaded } = useUsers()
  const [target, setTarget] = useState<{ id: string; label: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const { error, success } = useToast()

  async function confirm() {
    if (!target) return
    setBusy(true)
    try {
      await callAction('removeMember', { userId: target.id })
      success('Member removed', `${target.label} no longer has a profile in Launch Lab.`)
      setTarget(null)
    } catch (e) {
      error('Could not remove member', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-6" data-testid="team-section">
      <h2 className="text-lg font-semibold">Team</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Admin only. Removing a member deletes their Launch Lab profile; delete their experiments first.
      </p>
      {!usersLoaded ? (
        <div className="mt-4 h-10 animate-pulse rounded-md bg-muted" />
      ) : (
        <ul className="mt-4 divide-y divide-border text-sm">
          {users.map((u) => {
            const label = u.name || u.email || 'Unnamed member'
            return (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-foreground">{label}</div>
                  {u.email && <div className="truncate text-xs text-muted-foreground">{u.email}</div>}
                </div>
                <span className="text-xs capitalize text-muted-foreground">{u.role}</span>
                {u.id !== selfId && (
                  <Button size="sm" variant="ghost" onClick={() => setTarget({ id: u.id, label })}>
                    Remove
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <ConfirmModal
        open={!!target}
        onClose={() => setTarget(null)}
        onConfirm={confirm}
        loading={busy}
        title={`Remove ${target?.label ?? 'member'}?`}
        description="Their Launch Lab profile is deleted. Their sign-in account itself is not — if they sign in again, a new empty member profile is created."
        confirmText="Remove member"
      />
    </section>
  )
}

/** Admin-only: load or remove the clearly-labelled sample ledger. */
function SampleDataSection() {
  const [busy, setBusy] = useState<'load' | 'clear' | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const { error, success } = useToast()

  async function run(kind: 'load' | 'clear') {
    setBusy(kind)
    try {
      if (kind === 'load') {
        await callAction('loadSampleData', {})
        success('Sample data loaded', 'Three SAMPLE experiments are on the Lab board. Run the AI review on each.')
      } else {
        await callAction('clearSampleData', {})
        success('Sample data removed')
        setConfirmClear(false)
      }
    } catch (e) {
      error(kind === 'load' ? 'Could not load sample data' : 'Could not remove sample data', e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mt-8 rounded-lg border border-border bg-card p-6" data-testid="sample-section">
      <h2 className="text-lg font-semibold">Sample data</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Admin only. Loads three experiments with synthetic clicks and signups, each marked SAMPLE, so a new visitor sees
        a working ledger. Loading again replaces them. Real experiments are never touched.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => run('load')} loading={busy === 'load'} disabled={busy !== null} data-testid="load-sample">
          Load sample data
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)} disabled={busy !== null}>
          Remove sample data
        </Button>
      </div>
      <ConfirmModal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={() => run('clear')}
        loading={busy === 'clear'}
        title="Remove all sample experiments?"
        description="Deletes every experiment marked SAMPLE with its links, clicks, conversions, snapshots and verdicts. Real experiments are not affected."
        confirmText="Remove sample data"
      />
    </section>
  )
}
