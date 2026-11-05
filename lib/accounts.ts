// lib/accounts.ts
// Daftar akun yang pernah login di perangkat ini (multi-akun).
//
// Yang disimpan HANYA metadata (uid, email, nama, foto, provider). Token dan
// password tidak pernah ditulis ke sini — sesi tetap dipegang Firebase Auth.
// Karena Firebase hanya menyimpan satu sesi aktif per waktu, berpindah akun
// tetap perlu login ulang (email + password, atau pilih akun Google).

import type { User } from 'firebase/auth'

export interface SavedAccount {
  uid: string
  email: string
  displayName: string
  photoURL: string
  providerId: string
  lastUsedAt: number
}

const ACCOUNTS_KEY = 'kiranime-accounts-v1'
const ACTIVE_KEY = 'kiranime-accounts-active-v1'
const RETURN_KEY = 'kiranime-accounts-return-v1'

// Event lokal supaya semua komponen (navbar, halaman akun) ikut ter-update
// tanpa perlu reload saat daftar akun berubah.
export const ACCOUNTS_EVENT = 'kiranime-accounts-changed'

// Batasi jumlah akun supaya dropdown tetap ringan.
export const MAX_SAVED_ACCOUNTS = 8

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

function emitChange(): void {
  if (!isBrowser()) return
  try {
    window.dispatchEvent(new Event(ACCOUNTS_EVENT))
  } catch {
    // abaikan
  }
}

function isSavedAccount(value: unknown): value is SavedAccount {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<SavedAccount>
  return typeof candidate.uid === 'string' && candidate.uid.length > 0
}

export function accountFromUser(user: User): SavedAccount {
  const providerId = user.providerData?.[0]?.providerId || (user.email ? 'password' : 'phone')
  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'KiraFan',
    photoURL: user.photoURL || '',
    providerId,
    lastUsedAt: Date.now(),
  }
}

export function loadSavedAccounts(): SavedAccount[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(isSavedAccount)
      .map((item) => ({
        uid: item.uid,
        email: typeof item.email === 'string' ? item.email : '',
        displayName: typeof item.displayName === 'string' ? item.displayName : '',
        photoURL: typeof item.photoURL === 'string' ? item.photoURL : '',
        providerId: typeof item.providerId === 'string' ? item.providerId : 'password',
        lastUsedAt: typeof item.lastUsedAt === 'number' ? item.lastUsedAt : 0,
      }))
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, MAX_SAVED_ACCOUNTS)
  } catch {
    return []
  }
}

function persistAccounts(accounts: SavedAccount[]): SavedAccount[] {
  if (!isBrowser()) return accounts
  const trimmed = accounts.slice(0, MAX_SAVED_ACCOUNTS)
  try {
    window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(trimmed))
  } catch {
    // localStorage penuh/diblokir — daftar akun tetap jalan di memori.
  }
  emitChange()
  return trimmed
}

// Simpan/refresh satu akun dan taruh paling atas (paling baru dipakai).
export function upsertSavedAccount(account: SavedAccount): SavedAccount[] {
  const rest = loadSavedAccounts().filter((item) => item.uid !== account.uid)
  return persistAccounts([{ ...account, lastUsedAt: Date.now() }, ...rest])
}

export function removeSavedAccount(uid: string): SavedAccount[] {
  const next = loadSavedAccounts().filter((item) => item.uid !== uid)
  if (getActiveAccountUid() === uid) setActiveAccountUid(null)
  return persistAccounts(next)
}

export function getActiveAccountUid(): string | null {
  if (!isBrowser()) return null
  try {
    return window.localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

export function setActiveAccountUid(uid: string | null): void {
  if (!isBrowser()) return
  try {
    if (uid) window.localStorage.setItem(ACTIVE_KEY, uid)
    else window.localStorage.removeItem(ACTIVE_KEY)
  } catch {
    // abaikan
  }
  emitChange()
}

// Dipakai untuk tahu harus kembali ke halaman mana setelah tambah/ganti akun.
export function sanitizeReturnPath(path: string | null | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/'
  // Jangan kembali ke halaman login (bisa loop).
  if (path === '/login' || path.startsWith('/login?')) return '/'
  return path
}

export function setAccountsReturnPath(path: string): void {
  if (!isBrowser()) return
  try {
    window.sessionStorage.setItem(RETURN_KEY, sanitizeReturnPath(path))
  } catch {
    // abaikan
  }
}

export function getAccountsReturnPath(): string | null {
  if (!isBrowser()) return null
  try {
    return window.sessionStorage.getItem(RETURN_KEY)
  } catch {
    return null
  }
}

export function clearAccountsReturnPath(): void {
  if (!isBrowser()) return
  try {
    window.sessionStorage.removeItem(RETURN_KEY)
  } catch {
    // abaikan
  }
}

export function subscribeAccounts(listener: () => void): () => void {
  if (!isBrowser()) return () => {}
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === ACCOUNTS_KEY ||
      event.key === ACTIVE_KEY ||
      event.key === null
    ) {
      listener()
    }
  }
  window.addEventListener(ACCOUNTS_EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(ACCOUNTS_EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function providerLabelKey(providerId: string): string {
  if (providerId === 'google.com') return 'account.providerGoogle'
  if (providerId === 'phone') return 'account.providerPhone'
  return 'account.providerEmail'
}

export function accountInitial(account: SavedAccount): string {
  const source = account.displayName || account.email || '?'
  return source.trim().charAt(0).toUpperCase() || '?'
}
