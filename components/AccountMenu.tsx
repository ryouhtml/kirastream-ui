// components/AccountMenu.tsx
// Menu akun di navbar: daftar akun yang tersimpan di perangkat, tombol
// tambah akun, kelola akun, profil, dan logout.

import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, LogOut, Plus, User, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { translate } from '@/lib/i18n'
import { useAnimationsEnabled } from '@/lib/hooks/useAnimations'
import { SavedAccount, accountInitial, providerLabelKey } from '@/lib/accounts'
import { LiquidGlassCursorButton } from './LiquidGlassCursor'

function Avatar({ account, size = 32 }: { account: SavedAccount; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-white dark:bg-accent dark:text-noir"
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

export default function AccountMenu() {
  const router = useRouter()
  const { user, profile, accounts, activeUid, addAccount, switchAccount, logout } = useAuth()
  const { language, liquidGlass } = useSettings()
  const t = (key: string) => translate(language, key)
  const reduceMotion = useAnimationsEnabled()

  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const currentUid = user?.uid || activeUid
  const displayName = profile?.displayName || user?.displayName || 'KiraFan'
  const avatarSrc = profile?.photoURL || user?.photoURL || ''

  // Tutup menu setiap pindah halaman.
  useEffect(() => {
    setOpen(false)
  }, [router.asPath])

  useEffect(() => {
    if (!open) return

    const handlePointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      // LiquidGlassCursorButton merender div role="button", jadi cari manual.
      const trigger =
        buttonRef.current ||
        rootRef.current?.querySelector<HTMLElement>('[role="button"], button')
      trigger?.focus()
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      setOpen(false)
      router.push('/')
    } finally {
      setLoggingOut(false)
    }
  }

  const handleSwitch = (account: SavedAccount) => {
    setOpen(false)
    switchAccount(account.uid)
  }

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      {liquidGlass ? (
        <LiquidGlassCursorButton
          ref={buttonRef}
          onClick={() => setOpen((value) => !value)}
          className="!rounded-full !pl-1 !pr-2 !py-1"
          aria-label={t('account.menu')}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary dark:bg-accent">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <User size={16} className="text-white" aria-hidden="true" />
            )}
          </span>
          <span className="hidden max-w-[100px] truncate text-sm font-semibold text-[var(--color-text)] xl:block">
            {displayName}
          </span>
        </LiquidGlassCursorButton>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-2 rounded-full border border-pearl/10 py-1 pl-1 pr-2 transition-colors hover:bg-pearl/10"
          aria-label={t('account.menu')}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary dark:bg-accent">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
            ) : (
              <User size={16} className="text-white" aria-hidden="true" />
            )}
          </span>
          <span className="hidden max-w-[100px] truncate text-sm font-semibold xl:block">
            {displayName}
          </span>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={t('account.title')}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 top-full z-[60] mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-pearl/10 bg-surface shadow-2xl dark:bg-surface-dark"
          >
            <div className="flex items-center justify-between gap-2 border-b border-pearl/10 px-4 py-2.5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                {t('account.title')}
              </span>
              <span className="rounded-full bg-pearl/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)]">
                {accounts.length}
              </span>
            </div>

            <div className="custom-scrollbar max-h-64 overflow-y-auto p-1.5">
              {accounts.length === 0 ? (
                <p className="px-3 py-3 text-xs text-[var(--color-text-muted)]">
                  {t('account.empty')}
                </p>
              ) : (
                accounts.map((account) => {
                  const isCurrent = account.uid === currentUid
                  return (
                    <button
                      key={account.uid}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isCurrent}
                      onClick={() => (isCurrent ? setOpen(false) : handleSwitch(account))}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors ${
                        isCurrent
                          ? 'bg-primary/10 dark:bg-accent/10'
                          : 'hover:bg-pearl/10'
                      }`}
                      title={isCurrent ? t('account.current') : t('account.switchNote')}
                    >
                      <Avatar account={account} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[var(--color-text)]">
                          {account.displayName || account.email || 'KiraFan'}
                        </span>
                        <span className="block truncate text-[11px] text-[var(--color-text-muted)]">
                          {account.email || t(providerLabelKey(account.providerId))}
                        </span>
                      </span>
                      {isCurrent ? (
                        <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-primary dark:text-accent">
                          <Check size={13} aria-hidden="true" /> {t('account.active')}
                        </span>
                      ) : (
                        <span className="shrink-0 text-[10px] font-semibold text-[var(--color-text-muted)]">
                          {t('account.switch')}
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>

            {accounts.length > 1 && (
              <p className="border-t border-pearl/10 px-4 py-2 text-[10px] leading-snug text-[var(--color-text-muted)]">
                {t('account.switchNote')}
              </p>
            )}

            <div className="border-t border-pearl/10 p-1.5">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  addAccount()
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-pearl/10"
              >
                <Plus size={16} aria-hidden="true" /> {t('account.add')}
              </button>
              <Link
                href="/accounts"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-pearl/10"
              >
                <Users size={16} aria-hidden="true" /> {t('account.manage')}
              </Link>
            </div>

            <div className="border-t border-pearl/10 p-1.5">
              <Link
                href="/profile"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-pearl/10"
              >
                <User size={16} aria-hidden="true" /> {t('nav.profile')}
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
              >
                <LogOut size={16} aria-hidden="true" />
                {loggingOut ? t('account.loggingOut') : t('nav.logout')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
