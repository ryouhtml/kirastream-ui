// components/NotificationBell.tsx
// Lonceng notifikasi untuk anime baru + berita terbaru dari Jikan (MyAnimeList).

import { ReactNode, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  CheckCheck,
  Clapperboard,
  ExternalLink,
  Loader2,
  Newspaper,
  RefreshCw,
} from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationContext'
import { useSettings } from '@/contexts/SettingsContext'
import { translate } from '@/lib/i18n'
import { useAnimationsEnabled } from '@/lib/hooks/useAnimations'
import { NotifAnime, NotifNews, formatRelativeTime } from '@/lib/notifications'
import { apiUrl } from '@/lib/apiBase'
import { LiquidGlassCursorButton } from './LiquidGlassCursor'

type Tab = 'anime' | 'news'

function proxiedImage(src: string): string {
  return src ? apiUrl(`/api/proxy?url=${encodeURIComponent(src)}`) : ''
}

function TabButton({
  active,
  label,
  count,
  icon,
  onClick,
}: {
  active: boolean
  label: string
  count: number
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'bg-primary/10 text-primary dark:bg-accent/15 dark:text-accent'
          : 'text-[var(--color-text-muted)] hover:bg-pearl/10'
      }`}
    >
      {icon}
      {label}
      {count > 0 && (
        <span className="min-w-[16px] rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}

function Poster({ src, alt }: { src: string; alt: string }) {
  if (!src) {
    return (
      <span className="flex h-full w-full items-center justify-center text-[var(--color-text-muted)]">
        <Clapperboard size={16} aria-hidden="true" />
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxiedImage(src)}
      alt={alt}
      loading="lazy"
      className="h-full w-full object-cover"
    />
  )
}

function AnimeRow({
  item,
  unread,
  lang,
  onRead,
}: {
  item: NotifAnime
  unread: boolean
  lang: string
  onRead: () => void
}) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onRead}
      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-pearl/10 ${
        unread ? 'bg-primary/5 dark:bg-accent/5' : ''
      }`}
    >
      <span className="h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-pearl/10">
        <Poster src={item.image} alt="" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-xs font-semibold text-[var(--color-text)]">
          {item.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--color-text-muted)]">
          <span>{item.type}</span>
          {item.episodes ? <span>{item.episodes} eps</span> : null}
          {item.score !== null ? <span>&#9733; {item.score}</span> : null}
        </span>
        {item.airedFrom ? (
          <span className="mt-0.5 block text-[11px] text-[var(--color-text-muted)]">
            {formatRelativeTime(item.airedFrom, lang)}
          </span>
        ) : null}
      </span>
      {unread && (
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
      )}
    </a>
  )
}

function NewsRow({
  item,
  unread,
  lang,
  onRead,
}: {
  item: NotifNews
  unread: boolean
  lang: string
  onRead: () => void
}) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onRead}
      className={`flex gap-3 px-4 py-3 transition-colors hover:bg-pearl/10 ${
        unread ? 'bg-primary/5 dark:bg-accent/5' : ''
      }`}
    >
      <span className="h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-pearl/10">
        <Poster src={item.image} alt="" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-xs font-semibold text-[var(--color-text)]">
          {item.title}
        </span>
        {item.excerpt ? (
          <span className="mt-0.5 line-clamp-2 block text-[11px] text-[var(--color-text-muted)]">
            {item.excerpt}
          </span>
        ) : null}
        <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          <span className="truncate">{item.animeTitle}</span>
          {item.date ? <span>&middot; {formatRelativeTime(item.date, lang)}</span> : null}
        </span>
      </span>
      {unread && (
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
      )}
    </a>
  )
}

export default function NotificationBell() {
  const { language, liquidGlass } = useSettings()
  const t = (key: string) => translate(language, key)
  const {
    anime,
    news,
    loading,
    refreshing,
    error,
    unreadCount,
    unreadAnime,
    unreadNews,
    lastUpdated,
    isRead,
    markRead,
    markAllRead,
    refresh,
  } = useNotifications()

  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('anime')
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const reduceMotion = useAnimationsEnabled()

  useEffect(() => {
    if (!open) return

    const handlePointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const ariaLabel =
    unreadCount > 0
      ? `${t('notif.open')} (${t('notif.unread').replace('{n}', String(unreadCount))})`
      : t('notif.open')

  const items = tab === 'anime' ? anime : news
  const isEmpty = !loading && !error && items.length === 0

  return (
    <div ref={rootRef} className="relative">
      {liquidGlass ? (
        <LiquidGlassCursorButton
          ref={buttonRef}
          onClick={() => setOpen((value) => !value)}
          className="!rounded-full text-[var(--color-text)]"
          iconOnly
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Bell size={20} aria-hidden="true" />
        </LiquidGlassCursorButton>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg bg-surface p-2 text-[var(--color-text)] transition-colors hover:bg-pearl/10 dark:bg-surface-dark"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <Bell size={20} aria-hidden="true" />
        </button>
      )}

      {unreadCount > 0 && (
        <span
          className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm"
          aria-hidden="true"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label={t('notif.title')}
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }}
            className="absolute right-0 top-full z-[60] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-pearl/10 bg-surface shadow-2xl dark:bg-surface-dark"
          >
            <div className="flex items-center justify-between gap-2 border-b border-pearl/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-primary dark:text-accent" aria-hidden="true" />
                <h2 className="text-sm font-bold text-[var(--color-text)]">{t('notif.title')}</h2>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-500">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void refresh()}
                  disabled={refreshing}
                  className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-pearl/10 hover:text-[var(--color-text)] disabled:opacity-50"
                  aria-label={t('notif.refresh')}
                  title={t('notif.refresh')}
                >
                  {refreshing ? (
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw size={15} aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={unreadCount === 0}
                  className="rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-pearl/10 hover:text-[var(--color-text)] disabled:opacity-40"
                  aria-label={t('notif.markAllRead')}
                  title={t('notif.markAllRead')}
                >
                  <CheckCheck size={15} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex gap-1 border-b border-pearl/10 px-3 py-2">
              <TabButton
                active={tab === 'anime'}
                label={t('notif.tabAnime')}
                count={unreadAnime}
                icon={<Clapperboard size={14} aria-hidden="true" />}
                onClick={() => setTab('anime')}
              />
              <TabButton
                active={tab === 'news'}
                label={t('notif.tabNews')}
                count={unreadNews}
                icon={<Newspaper size={14} aria-hidden="true" />}
                onClick={() => setTab('news')}
              />
            </div>

            <div className="custom-scrollbar max-h-[min(70vh,30rem)] overflow-y-auto overscroll-contain">
              {loading ? (
                <div className="space-y-3 p-4">
                  <p className="sr-only">{t('notif.loading')}</p>
                  {[0, 1, 2].map((item) => (
                    <div key={item} className="flex gap-3">
                      <div className="h-16 w-11 shrink-0 animate-pulse rounded-lg bg-pearl/10" />
                      <div className="flex-1 space-y-2 pt-1">
                        <div className="h-3 w-4/5 animate-pulse rounded bg-pearl/10" />
                        <div className="h-3 w-2/5 animate-pulse rounded bg-pearl/10" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error && items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  <Bell size={24} className="text-[var(--color-text-muted)]" aria-hidden="true" />
                  <p className="text-xs text-[var(--color-text-muted)]">{t('notif.error')}</p>
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    className="mt-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 dark:bg-accent/15 dark:text-accent"
                  >
                    {t('notif.refresh')}
                  </button>
                </div>
              ) : isEmpty ? (
                <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                  {tab === 'anime' ? (
                    <Clapperboard size={24} className="text-[var(--color-text-muted)]" aria-hidden="true" />
                  ) : (
                    <Newspaper size={24} className="text-[var(--color-text-muted)]" aria-hidden="true" />
                  )}
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {t(tab === 'anime' ? 'notif.emptyAnime' : 'notif.emptyNews')}
                  </p>
                </div>
              ) : tab === 'anime' ? (
                anime.map((item) => (
                  <AnimeRow
                    key={item.id}
                    item={item}
                    unread={!isRead(item.id)}
                    lang={language}
                    onRead={() => markRead(item.id)}
                  />
                ))
              ) : (
                news.map((item) => (
                  <NewsRow
                    key={item.id}
                    item={item}
                    unread={!isRead(item.id)}
                    lang={language}
                    onRead={() => markRead(item.id)}
                  />
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-pearl/10 px-4 py-2 text-[10px] text-[var(--color-text-muted)]">
              <span className="inline-flex items-center gap-1">
                <ExternalLink size={11} aria-hidden="true" />
                {t('notif.source')}
              </span>
              {lastUpdated ? (
                <span>
                  {t('notif.updated').replace(
                    '{time}',
                    formatRelativeTime(new Date(lastUpdated).toISOString(), language)
                  )}
                </span>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
