// lib/notifications.ts
// Sumber data notifikasi: Jikan API (MyAnimeList).
// Jikan tidak punya endpoint berita global, jadi berita diambil per-anime
// dari beberapa anime yang sedang tayang lalu digabung + di-cache di localStorage.

import { CONFIG } from './config'

const JIKAN = CONFIG.JIKAN_API
const CACHE_KEY = 'kiranime-notifications-cache-v1'
const SEEN_KEY = 'kiranime-notifications-seen-v1'

// Cache dianggap basi setelah 1 jam.
export const NOTIFICATION_TTL = 60 * 60 * 1000

const SEEN_LIMIT = 400
const NEWS_SOURCE_LIMIT = 5
const NEWS_ITEM_LIMIT = 24
// Jikan membatasi ±3 request/detik; beri jeda antar request berita.
const REQUEST_GAP = 420

export interface NotifAnime {
  id: string
  malId: number
  title: string
  image: string
  score: number | null
  type: string
  episodes: number | null
  airedFrom: string | null
  url: string
}

export interface NotifNews {
  id: string
  malId: number
  animeTitle: string
  title: string
  excerpt: string
  image: string
  date: string
  url: string
}

export interface NotificationBundle {
  anime: NotifAnime[]
  news: NotifNews[]
  fetchedAt: number
}

export interface SeenState {
  ids: string[]
  initialized: boolean
}

interface JikanImage {
  jpg?: { image_url?: string | null; large_image_url?: string | null }
}

interface JikanAnimeRaw {
  mal_id: number
  title: string
  title_english?: string | null
  url?: string
  images?: JikanImage
  score?: number | null
  type?: string | null
  episodes?: number | null
  aired?: { from?: string | null }
}

interface JikanNewsRaw {
  mal_id?: number
  url?: string
  title?: string
  date?: string
  excerpt?: string
  images?: JikanImage
}

interface JikanList<T> {
  data?: T[]
}

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
    (typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError')
  )
}

export { isAbortError }

async function jikanGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  // Timeout lokal supaya request yang menggantung tidak memblokir notifikasi.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  const forwardAbort = () => controller.abort()

  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', forwardAbort)
  }

  try {
    const res = await fetch(`${JIKAN}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Jikan ${res.status}`)
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

function hashKey(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  return (hash >>> 0).toString(36)
}

function trimExcerpt(value?: string): string {
  if (!value) return ''
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > 150 ? `${clean.slice(0, 147)}…` : clean
}

function mapAnime(raw: JikanAnimeRaw): NotifAnime {
  return {
    id: `a-${raw.mal_id}`,
    malId: raw.mal_id,
    title: raw.title_english || raw.title,
    image: raw.images?.jpg?.large_image_url || raw.images?.jpg?.image_url || '',
    score: typeof raw.score === 'number' ? raw.score : null,
    type: raw.type || 'Anime',
    episodes: typeof raw.episodes === 'number' ? raw.episodes : null,
    airedFrom: raw.aired?.from || null,
    url: raw.url || `https://myanimelist.net/anime/${raw.mal_id}`,
  }
}

function mapNews(raw: JikanNewsRaw, source: JikanAnimeRaw): NotifNews | null {
  const title = (raw.title || '').trim()
  if (!title) return null

  const url = raw.url || 'https://myanimelist.net/news'
  const malId = typeof raw.mal_id === 'number' ? raw.mal_id : 0
  const image =
    raw.images?.jpg?.image_url || source.images?.jpg?.large_image_url || source.images?.jpg?.image_url || ''

  return {
    id: `n-${malId || hashKey(url || `${source.mal_id}-${title}`)}`,
    malId: source.mal_id,
    animeTitle: source.title_english || source.title,
    title,
    excerpt: trimExcerpt(raw.excerpt),
    image,
    date: raw.date || '',
    url,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function dedupeNews(items: NotifNews[]): NotifNews[] {
  const seen = new Set<string>()
  const result: NotifNews[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
  }
  return result
}

export async function fetchNotificationBundle(signal?: AbortSignal): Promise<NotificationBundle> {
  // Dua request awal boleh paralel (masih di bawah rate limit Jikan).
  const [seasonResult, topResult] = await Promise.allSettled([
    jikanGet<JikanList<JikanAnimeRaw>>('/seasons/now?limit=12&sfw', signal),
    jikanGet<JikanList<JikanAnimeRaw>>(
      `/top/anime?filter=airing&limit=${NEWS_SOURCE_LIMIT}&sfw`,
      signal
    ),
  ])

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  if (seasonResult.status === 'rejected' && topResult.status === 'rejected') {
    throw seasonResult.reason instanceof Error
      ? seasonResult.reason
      : new Error('Jikan tidak dapat diakses')
  }

  const seasonItems = seasonResult.status === 'fulfilled' ? seasonResult.value.data || [] : []
  const topItems = topResult.status === 'fulfilled' ? topResult.value.data || [] : []

  const anime = seasonItems.slice(0, 12).map(mapAnime)
  const sources = (topItems.length ? topItems : seasonItems).slice(0, NEWS_SOURCE_LIMIT)

  const news: NotifNews[] = []
  const visited = new Set<number>()

  for (const source of sources) {
    if (visited.has(source.mal_id)) continue
    visited.add(source.mal_id)

    try {
      const result = await jikanGet<JikanList<JikanNewsRaw>>(
        `/anime/${source.mal_id}/news`,
        signal
      )
      for (const raw of result.data || []) {
        const item = mapNews(raw, source)
        if (item) news.push(item)
      }
    } catch (error) {
      // Abaikan satu sumber yang gagal; notifikasi lain tetap tampil.
      if (isAbortError(error)) throw error
    }

    await sleep(REQUEST_GAP)
  }

  const sorted = dedupeNews(news)
    .filter((item) => Boolean(item.date))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .slice(0, NEWS_ITEM_LIMIT)

  return { anime, news: sorted, fetchedAt: Date.now() }
}

export function loadNotificationCache(): NotificationBundle | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<NotificationBundle>
    if (!Array.isArray(parsed.anime) || !Array.isArray(parsed.news)) return null
    return {
      anime: parsed.anime as NotifAnime[],
      news: parsed.news as NotifNews[],
      fetchedAt: typeof parsed.fetchedAt === 'number' ? parsed.fetchedAt : 0,
    }
  } catch {
    return null
  }
}

export function saveNotificationCache(bundle: NotificationBundle): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(bundle))
  } catch {
    // localStorage penuh / diblokir — notifikasi tetap jalan tanpa cache.
  }
}

export function isCacheStale(bundle: NotificationBundle): boolean {
  if (!bundle.fetchedAt) return true
  return Date.now() - bundle.fetchedAt > NOTIFICATION_TTL
}

export function loadSeenState(): SeenState {
  if (typeof window === 'undefined') return { ids: [], initialized: false }
  try {
    const raw = window.localStorage.getItem(SEEN_KEY)
    if (!raw) return { ids: [], initialized: false }
    const parsed = JSON.parse(raw) as Partial<SeenState>
    return {
      ids: Array.isArray(parsed.ids) ? parsed.ids.filter((id): id is string => typeof id === 'string') : [],
      initialized: parsed.initialized === true,
    }
  } catch {
    return { ids: [], initialized: false }
  }
}

export function saveSeenState(state: SeenState): void {
  if (typeof window === 'undefined') return
  try {
    const ids = state.ids.slice(-SEEN_LIMIT)
    window.localStorage.setItem(SEEN_KEY, JSON.stringify({ ids, initialized: state.initialized }))
  } catch {
    // abaikan
  }
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60 * 1000],
  ['month', 30 * 24 * 60 * 60 * 1000],
  ['week', 7 * 24 * 60 * 60 * 1000],
  ['day', 24 * 60 * 60 * 1000],
  ['hour', 60 * 60 * 1000],
  ['minute', 60 * 1000],
]

export function formatRelativeTime(iso: string, lang = 'id'): string {
  const timestamp = Date.parse(iso)
  if (!Number.isFinite(timestamp)) return ''

  const diff = timestamp - Date.now()
  try {
    const formatter = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' })
    for (const [unit, ms] of RELATIVE_UNITS) {
      if (Math.abs(diff) >= ms) {
        return formatter.format(Math.round(diff / ms), unit)
      }
    }
    return formatter.format(0, 'minute')
  } catch {
    return ''
  }
}
