// pages/accounts.tsx
// Halaman kelola multi-akun: lihat akun tersimpan, tambah akun baru,
// beralih akun, dan hapus akun dari daftar perangkat.

import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { Check, Info, Plus, Trash2, UserPlus, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { translate } from '@/lib/i18n'
import { SavedAccount, accountInitial, providerLabelKey } from '@/lib/accounts'

function Avatar({ account, size = 44 }: { account: SavedAccount; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-base font-bold text-white dark:bg-accent dark:text-noir"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {account.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={account.photoURL} alt="" className="h-full w-full object-cover" />
      ) : (
        accountInitial(account)
      )}
    </span>
  )
}

export default function AccountsPage() {
  const { user, accounts, activeUid, loading, addAccount, switchAccount, forgetAccount } = useAuth()
  const { language } = useSettings()
  const t = (key: string) => translate(language, key)

  // uid yang sedang menunggu konfirmasi hapus (bukan window.confirm).
  const [confirmUid, setConfirmUid] = useState<string | null>(null)

  const currentUid = user?.uid || activeUid
  const currentAccount = accounts.find((account) => account.uid === currentUid) || null

  return (
    <>
      <Head>
        <title>{t('account.pageTitle')}</title>
      </Head>

      <div className="space-y-8">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Users size={22} className="text-ocean" aria-hidden="true" /> {t('account.title')}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{t('account.subtitle')}</p>
        </div>

        {loading ? (
          <div className="card p-5">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 animate-pulse rounded-full bg-pearl/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-40 animate-pulse rounded bg-pearl/10" />
                <div className="h-3 w-24 animate-pulse rounded bg-pearl/10" />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Akun yang sedang aktif */}
            {currentAccount && (
              <section className="card p-5" aria-label={t('account.current')}>
                <div className="flex items-center gap-3">
                  <Avatar account={currentAccount} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-bold text-[var(--color-text)]">
                      {currentAccount.displayName || currentAccount.email || 'KiraFan'}
                    </p>
                    {currentAccount.email && (
                      <p className="truncate text-sm text-[var(--color-text-muted)]">
                        {currentAccount.email}
                      </p>
                    )}
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary dark:bg-accent/15 dark:text-accent">
                    <Check size={13} aria-hidden="true" /> {t('account.current')}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/profile" className="btn-primary text-xs px-3.5 py-2">
                    {t('nav.profile')}
                  </Link>
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-pearl/10 px-3.5 py-2 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-pearl/20"
                  >
                    {t('nav.settings')}
                  </Link>
                </div>
              </section>
            )}

            {/* Daftar akun tersimpan */}
            <section aria-label={t('account.saved')}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                  {t('account.saved')}
                </h2>
                <button
                  type="button"
                  onClick={addAccount}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 dark:bg-accent dark:text-noir"
                >
                  <Plus size={14} aria-hidden="true" /> {t('account.add')}
                </button>
              </div>

              {accounts.length === 0 ? (
                <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
                  <UserPlus size={28} className="text-[var(--color-text-muted)]" aria-hidden="true" />
                  <p className="max-w-sm text-sm text-[var(--color-text-muted)]">{t('account.empty')}</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {accounts.map((account) => {
                    const isCurrent = account.uid === currentUid
                    const name = account.displayName || account.email || 'KiraFan'
                    const confirming = confirmUid === account.uid

                    return (
                      <li key={account.uid} className="card p-3 sm:p-4">
                        <div className="flex items-center gap-3">
                          <Avatar account={account} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-[var(--color-text)]">{name}</p>
                              <span className="rounded-full bg-pearl/10 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">
                                {t(providerLabelKey(account.providerId))}
                              </span>
                              {isCurrent && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary dark:bg-accent/15 dark:text-accent">
                                  {t('account.active')}
                                </span>
                              )}
                            </div>
                            {account.email && (
                              <p className="truncate text-xs text-[var(--color-text-muted)]">{account.email}</p>
                            )}
                          </div>

                          {!confirming && (
                            <div className="flex shrink-0 items-center gap-1.5">
                              {!isCurrent && (
                                <button
                                  type="button"
                                  onClick={() => switchAccount(account.uid)}
                                  className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 dark:bg-accent/15 dark:text-accent"
                                >
                                  {user ? t('account.switch') : t('account.signIn')}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setConfirmUid(account.uid)}
                                className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
                                aria-label={`${t('account.remove')}: ${name}`}
                                title={t('account.remove')}
                              >
                                <Trash2 size={15} aria-hidden="true" />
                              </button>
                            </div>
                          )}
                        </div>

                        {confirming && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {t('account.removeConfirm').replace('{name}', name)}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  forgetAccount(account.uid)
                                  setConfirmUid(null)
                                }}
                                className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/25"
                              >
                                {t('account.remove')}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmUid(null)}
                                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-pearl/10"
                              >
                                {t('account.cancel')}
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <div className="flex gap-3 rounded-xl border border-ocean/20 bg-ocean/5 p-4">
              <Info size={18} className="mt-0.5 shrink-0 text-ocean" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">{t('account.note')}</p>
            </div>
          </>
        )}
      </div>
    </>
  )
}
