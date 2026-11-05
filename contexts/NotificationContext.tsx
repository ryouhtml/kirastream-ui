// contexts/NotificationContext.tsx
// Menyimpan notifikasi anime baru + berita (Jikan API), cache 1 jam,
// dan status "sudah dibaca" di localStorage.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react'
import {
  NotificationBundle,
  NotifAnime,
  NotifNews,
  fetchNotificationBundle,
  isAbortError,
  isCacheStale,
  loadNotificationCache,
  loadSeenState,
  saveNotificationCache,
  saveSeenState,
} from '@/lib/notifications'

interface LoadOptions {
  force?: boolean
  silent?: boolean
}

interface NotificationContextType {
  anime: NotifAnime[]
  news: NotifNews[]
  loading: boolean
  refreshing: boolean
  error: boolean
  unreadCount: number
  unreadAnime: number
  unreadNews: number
  lastUpdated: number | null
  isRead: (id: string) => boolean
  markRead: (id: string) => void
  markAllRead: () => void
  refresh: () => Promise<void>
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [bundle, setBundle] = useState<NotificationBundle | null>(null)
  const [seenIds, setSeenIds] = useState<Set<string>>(() => new Set())
  const [initialized, setInitialized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(false)

  const bundleRef = useRef<NotificationBundle | null>(null)
  const seenRef = useRef<Set<string>>(new Set())
  const initializedRef = useRef(false)
  const mountedRef = useRef(true)
  const requestIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const commitSeen = useCallback((ids: Set<string>, isInitialized: boolean) => {
    const list = Array.from(ids)
    const next = new Set(list)
    seenRef.current = next
    initializedRef.current = isInitialized
    setSeenIds(next)
    setInitialized(isInitialized)
    saveSeenState({ ids: list, initialized: isInitialized })
  }, [])

  const load = useCallback(
    async (options: LoadOptions = {}) => {
      const { force = false, silent = false } = options
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (force) setRefreshing(true)
      else if (!silent) setLoading(true)
      setError(false)

      try {
        const next = await fetchNotificationBundle(controller.signal)
        if (!mountedRef.current || requestId !== requestIdRef.current || controller.signal.aborted) {
          return
        }

        bundleRef.current = next
        setBundle(next)
        saveNotificationCache(next)

        // Kunjungan pertama: anggap semua item yang sudah ada sebagai baseline
        // supaya badge tidak langsung membludak. Item baru setelah ini dihitung unread.
        if (!initializedRef.current) {
          const ids = new Set(seenRef.current)
          next.anime.forEach((item) => ids.add(item.id))
          next.news.forEach((item) => ids.add(item.id))
          commitSeen(ids, true)
        }
      } catch (err) {
        if (isAbortError(err) || !mountedRef.current || requestId !== requestIdRef.current) return
        // Kalau sudah ada cache, biarkan data lama tetap tampil tanpa pesan error.
        if (!bundleRef.current) setError(true)
      } finally {
        if (mountedRef.current && requestId === requestIdRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [commitSeen]
  )

  useEffect(() => {
    mountedRef.current = true

    const storedSeen = loadSeenState()
    seenRef.current = new Set(storedSeen.ids)
    initializedRef.current = storedSeen.initialized
    setSeenIds(new Set(storedSeen.ids))
    setInitialized(storedSeen.initialized)

    const cached = loadNotificationCache()
    if (cached) {
      bundleRef.current = cached
      setBundle(cached)
    }

    if (cached && !isCacheStale(cached)) {
      setLoading(false)
    } else {
      void load({ silent: Boolean(cached) })
    }

    return () => {
      mountedRef.current = false
      requestIdRef.current += 1
      abortRef.current?.abort()
      abortRef.current = null
    }
  }, [load])

  useEffect(() => {
    // Cek berkala saat tab kembali aktif / setelah 15 menit.
    const checkStale = () => {
      const cached = loadNotificationCache()
      if (!cached || isCacheStale(cached)) void load({ silent: Boolean(cached) })
    }

    const interval = window.setInterval(checkStale, 15 * 60 * 1000)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkStale()
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [load])

  const markRead = useCallback(
    (id: string) => {
      if (!id || seenRef.current.has(id)) return
      const ids = new Set(seenRef.current)
      ids.add(id)
      commitSeen(ids, true)
    },
    [commitSeen]
  )

  const markAllRead = useCallback(() => {
    const ids = new Set(seenRef.current)
    bundleRef.current?.anime.forEach((item) => ids.add(item.id))
    bundleRef.current?.news.forEach((item) => ids.add(item.id))
    commitSeen(ids, true)
  }, [commitSeen])

  const refresh = useCallback(async () => {
    await load({ force: true })
  }, [load])

  const isRead = useCallback(
    (id: string) => !initializedRef.current || seenRef.current.has(id),
    []
  )

  const anime = bundle?.anime ?? []
  const news = bundle?.news ?? []
  const unreadAnime = initialized ? anime.filter((item) => !seenIds.has(item.id)).length : 0
  const unreadNews = initialized ? news.filter((item) => !seenIds.has(item.id)).length : 0
  const unreadCount = unreadAnime + unreadNews

  return (
    <NotificationContext.Provider
      value={{
        anime,
        news,
        loading,
        refreshing,
        error,
        unreadCount,
        unreadAnime,
        unreadNews,
        lastUpdated: bundle?.fetchedAt ?? null,
        isRead,
        markRead,
        markAllRead,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
