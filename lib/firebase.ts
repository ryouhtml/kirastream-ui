// ─── FIREBASE CLIENT ─────────────────────────────────────────
// Firebase + Base64 tricks untuk free tier

import { initializeApp } from 'firebase/app'
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  Auth,
  sendPasswordResetEmail,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth'
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore'

// ─── CONFIG ──────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
}

// ─── INITIALIZATION ──────────────────────────────────────────
// Jangan crash saat env Firebase belum dikonfigurasi (local dev / CI / preview).
// Tanpa config, auth & db bernilai null dan semua operasi Firebase no-op.

const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
)

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null

function createAuth() {
  if (!app || typeof window === 'undefined') return null
  try {
    return getAuth(app)
  } catch {
    return null
  }
}

export const auth = createAuth() as unknown as Auth
export const db = (app ? getFirestore(app) : null) as unknown as Firestore
export const googleProvider = new GoogleAuthProvider()

// ─── AUTH FUNCTIONS ──────────────────────────────────────────

// options.selectAccount = true dipakai saat menambah/mengganti akun, supaya
// Google selalu menampilkan pemilih akun dan tidak langsung memakai akun aktif.
export async function loginWithGoogle(options: { selectAccount?: boolean } = {}) {
  if (!auth) return { success: false, error: 'Firebase belum dikonfigurasi' }
  try {
    googleProvider.setCustomParameters(options.selectAccount ? { prompt: 'select_account' } : {})
    const result = await signInWithPopup(auth, googleProvider)
    await syncUserToFirestore(result.user)
    return { success: true, user: result.user }
  } catch (error) {
    console.error('Google login error:', error)
    return { success: false, error }
  }
}

export async function loginWithEmail(email: string, password: string) {
  if (!auth) return { success: false, error: 'Firebase belum dikonfigurasi' }
  try {
    const result = await signInWithEmailAndPassword(auth, email, password)
    await syncUserToFirestore(result.user)
    return { success: true, user: result.user }
  } catch (error) {
    console.error('Email login error:', error)
    return { success: false, error }
  }
}

export async function registerWithEmail(email: string, password: string, displayName: string) {
  if (!auth) return { success: false, error: 'Firebase belum dikonfigurasi' }
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(result.user, { displayName })
    await syncUserToFirestore(result.user)
    return { success: true, user: result.user }
  } catch (error) {
    console.error('Register error:', error)
    return { success: false, error }
  }
}

export async function logout() {
  if (!auth) return { success: false, error: 'Firebase belum dikonfigurasi' }
  try {
    await signOut(auth)
    return { success: true }
  } catch (error) {
    console.error('Logout error:', error)
    return { success: false, error }
  }
}

export function onAuthChange(callback: (user: User | null) => void) {
  if (!auth) return () => {}
  return onAuthStateChanged(auth, callback)
}

export async function resetPassword(email: string) {
  if (!auth) return { success: false, error: 'Firebase belum dikonfigurasi' }
  try {
    await sendPasswordResetEmail(auth, email)
    return { success: true }
  } catch (error) {
    return { success: false, error }
  }
}

// ─── PHONE NUMBER LOGIN (OTP) ────────────────────────────────
// Butuh Firebase Auth > Sign-in method > "Phone" diaktifkan dulu di Console.
// Catatan: verifikasi nomor HP via SMS ini pakai kuota Firebase yang diatur
// oleh Google — cek limit gratis harian di Firebase Console sebelum rilis publik.

let recaptchaVerifier: RecaptchaVerifier | null = null

// Dipanggil sekali dari halaman login untuk menyiapkan invisible reCAPTCHA.
// containerId harus mengarah ke <div> kosong yang ada di DOM.
export function initRecaptcha(containerId: string) {
  if (!auth || typeof window === 'undefined') return null
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
    })
  }
  return recaptchaVerifier
}

export function resetRecaptcha() {
  recaptchaVerifier?.clear()
  recaptchaVerifier = null
}

// phoneNumber harus format E.164, contoh: +6281234567890
export async function sendPhoneOtp(phoneNumber: string, containerId: string) {
  if (!auth) return { success: false, error: 'Firebase belum dikonfigurasi' }
  try {
    const verifier = initRecaptcha(containerId)
    if (!verifier) throw new Error('Recaptcha tidak tersedia')
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier)
    return { success: true, confirmationResult }
  } catch (error) {
    // Reset verifier biar widget reCAPTCHA nggak nyangkut di state error
    resetRecaptcha()
    return { success: false, error }
  }
}

export async function confirmPhoneOtp(confirmationResult: ConfirmationResult, code: string) {
  try {
    const result = await confirmationResult.confirm(code)
    await syncUserToFirestore(result.user)
    return { success: true, user: result.user }
  } catch (error) {
    return { success: false, error }
  }
}

export async function updateUserProfile(user: User, updates: { displayName?: string; photoURL?: string }) {
  try {
    // Catatan: field photoURL di Firebase Auth punya batas panjang string (~2KB),
    // jadi base64 avatar TIDAK dikirim ke sana — cukup disimpan di Firestore saja.
    // Firestore document limit 1MB jauh lebih longgar untuk base64 image kecil.
    if (updates.displayName) {
      await updateProfile(user, { displayName: updates.displayName })
    }
    if (updates.displayName) {
      await updateUserFirestore(user.uid, {
        displayName: updates.displayName,
        searchName: updates.displayName.toLowerCase(),
        keywords: buildUserSearchTokens(updates.displayName, user.email || ''),
      })
    }
    if (updates.photoURL) {
      await updateUserFirestore(user.uid, { photoURL: updates.photoURL })
    }
    return { success: true }
  } catch (error) {
    return { success: false, error }
  }
}

// ─── FIRESTORE FUNCTIONS ─────────────────────────────────────

// Token pencarian untuk user: dipakai query `array-contains` di Firestore.
// Contoh: "Budi Santoso" => ["budi", "santoso", "budi santoso", "budi@gmail.com", ...]
function buildUserSearchTokens(displayName: string, email: string): string[] {
  const tokens = new Set<string>()
  const name = (displayName || email?.split('@')[0] || 'kirafan').trim().toLowerCase()
  tokens.add(name)
  name.split(/\s+/).filter(Boolean).forEach((w) => tokens.add(w))
  const emailLower = (email || '').trim().toLowerCase()
  if (emailLower) {
    tokens.add(emailLower)
    const local = emailLower.split('@')[0]
    if (local) tokens.add(local)
  }
  return Array.from(tokens)
}

export async function syncUserToFirestore(user: User) {
  const userRef = doc(db, 'users', user.uid)
  const userSnap = await getDoc(userRef)
  
  if (!userSnap.exists()) {
    // User baru
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'KiraFan',
      searchName: (user.displayName || user.email?.split('@')[0] || 'kirafan').toLowerCase(),
      keywords: buildUserSearchTokens(user.displayName || '', user.email || ''),
      photoURL: user.photoURL || '',
      role: 'user',
      createdAt: serverTimestamp(),
      provider: user.providerData?.[0]?.providerId || 'email',
      bio: '',
      bannerURL: '',
      bannerColor: 'linear-gradient(135deg, #1a237e, #5B88B2, #A8C7FA)',
      stats: {
        watchedEpisodes: 0,
        totalHours: 0,
        averageScore: 0,
        watchlistCount: 0,
      },
    })
  } else {
    // Update data lama
    const updates: any = {}
    const data = userSnap.data()
    
    if (user.email && data.email !== user.email) updates.email = user.email
    if (user.displayName && !data.displayName) updates.displayName = user.displayName
    if (user.photoURL && !data.photoURL) updates.photoURL = user.photoURL
    if (!data.searchName) {
      updates.searchName = (user.displayName || user.email?.split('@')[0] || 'kirafan').toLowerCase()
    }
    // Backfill keywords buat user lama yang belum punya (biar bisa ketemu saat dicari).
    if (!data.keywords) {
      updates.keywords = buildUserSearchTokens(user.displayName || '', user.email || '')
    }
    
    if (Object.keys(updates).length > 0) {
      await updateDoc(userRef, updates)
    }
  }
}

export async function getUserFirestore(uid: string) {
  const userRef = doc(db, 'users', uid)
  const userSnap = await getDoc(userRef)
  return userSnap.exists() ? userSnap.data() : null
}

export async function updateUserFirestore(uid: string, updates: any) {
  const userRef = doc(db, 'users', uid)
  await updateDoc(userRef, { ...updates, updatedAt: serverTimestamp() })
}

// ─── BASE64 TRICK FUNCTIONS ──────────────────────────────────
// Trick untuk menyimpan data di Firestore free tier tanpa biaya read/write

export function encodeData(data: any): string {
  try {
    const json = JSON.stringify(data)
    const base64 = btoa(encodeURIComponent(json))
    return base64
  } catch {
    return ''
  }
}

export function decodeData(encoded: string): any {
  try {
    const json = decodeURIComponent(atob(encoded))
    return JSON.parse(json)
  } catch {
    return null
  }
}

// Gunakan Base64 untuk menyimpan data besar (seperti history) di localStorage
export const LOCAL_STORAGE_KEYS = {
  HISTORY: 'kira-history',
  FAVORITES: 'kira-favorites',
  WATCHLIST: 'kira-watchlist',
  CONTINUE_WATCHING: 'kira-continue',
}

export function saveToLocal(key: string, data: any) {
  try {
    const encoded = encodeData(data)
    localStorage.setItem(key, encoded)
    return true
  } catch {
    return false
  }
}

export function loadFromLocal(key: string) {
  try {
    const encoded = localStorage.getItem(key)
    return encoded ? decodeData(encoded) : null
  } catch {
    return null
  }
}

export function clearLocal(key: string) {
  localStorage.removeItem(key)
}

// ─── USER COLLECTIONS ────────────────────────────────────────

export type ContentType = 'anime' | 'manga' | 'webtoon' | 'novel'

export async function saveHistory(data: any, type: ContentType = 'anime') {
  const user = auth?.currentUser
  if (!user) return null

  // Backward compatible doc ID: anime keeps legacy ID (encodeURIComponent(slug));
  // other types are namespaced to avoid slug collisions across content types.
  const docId = type === 'anime'
    ? encodeURIComponent(data.slug)
    : encodeURIComponent(`${type}:${data.slug}`)

  const historyRef = doc(db, 'users', user.uid, 'history', docId)
  await setDoc(historyRef, {
    ...data,
    type,
    timestamp: serverTimestamp(),
    lastWatchedAt: Date.now(),
    progress: data.progress || 0,
  })
  
  // Simpan juga di localStorage sebagai backup (dedupe by type:slug, cap 50)
  const localHistory = loadFromLocal(LOCAL_STORAGE_KEYS.HISTORY) || []
  const key = `${type}:${data.slug}`
  const existingIndex = localHistory.findIndex(
    (h: any) => `${h.type || 'anime'}:${h.slug}` === key
  )
  if (existingIndex >= 0) localHistory.splice(existingIndex, 1)
  localHistory.unshift({
    ...data,
    type,
    timestamp: Date.now(),
    progress: data.progress || 0,
  })
  saveToLocal(LOCAL_STORAGE_KEYS.HISTORY, localHistory.slice(0, 50))
  
  return historyRef
}

export async function getHistory(limitCount = 20) {
  const user = auth?.currentUser
  if (!user) return []
  
  try {
    const historyRef = collection(db, 'users', user.uid, 'history')
    const q = query(historyRef, orderBy('timestamp', 'desc'), limit(limitCount))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch {
    // Fallback ke localStorage
    const localHistory = loadFromLocal(LOCAL_STORAGE_KEYS.HISTORY) || []
    return localHistory.slice(0, limitCount)
  }
}

export async function toggleFavorite(animeData: any) {
  const user = auth?.currentUser
  if (!user) return { success: false, isFavorited: false }
  
  const favRef = doc(db, 'users', user.uid, 'favorites', encodeURIComponent(animeData.slug))
  const favSnap = await getDoc(favRef)
  
  if (favSnap.exists()) {
    await deleteDoc(favRef)
    return { success: true, isFavorited: false }
  } else {
    await setDoc(favRef, {
      ...animeData,
      timestamp: serverTimestamp(),
      addedAt: Date.now(),
    })
    return { success: true, isFavorited: true }
  }
}

export async function getFavorites() {
  const user = auth?.currentUser
  if (!user) return []
  
  try {
    const favRef = collection(db, 'users', user.uid, 'favorites')
    const q = query(favRef, orderBy('timestamp', 'desc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch {
    // Fallback ke localStorage
    const localFavs = loadFromLocal(LOCAL_STORAGE_KEYS.FAVORITES) || []
    return localFavs
  }
}

export async function checkFavorite(slug: string) {
  const user = auth?.currentUser
  if (!user) return false
  
  const favRef = doc(db, 'users', user.uid, 'favorites', encodeURIComponent(slug))
  const favSnap = await getDoc(favRef)
  return favSnap.exists()
}

// ─── WATCHLIST ───────────────────────────────────────────────

export type WatchlistStatus = 'planning' | 'watching' | 'completed' | 'dropped'

export interface WatchlistItem {
  slug: string
  title: string
  image: string
  status: WatchlistStatus
  progress?: number
  totalEpisodes?: number
  score?: number
  notes?: string
  addedAt: number
  updatedAt: number
}

export async function addToWatchlist(item: Omit<WatchlistItem, 'addedAt' | 'updatedAt'>) {
  const user = auth?.currentUser
  if (!user) return false
  
  const watchlistRef = doc(db, 'users', user.uid, 'watchlist', encodeURIComponent(item.slug))
  await setDoc(watchlistRef, {
    ...item,
    addedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  
  // Simpan di localStorage juga
  const localWatchlist = loadFromLocal(LOCAL_STORAGE_KEYS.WATCHLIST) || []
  const existingIndex = localWatchlist.findIndex((w: any) => w.slug === item.slug)
  
  if (existingIndex >= 0) {
    localWatchlist[existingIndex] = {
      ...item,
      addedAt: Date.now(),
      updatedAt: Date.now(),
    }
  } else {
    localWatchlist.push({
      ...item,
      addedAt: Date.now(),
      updatedAt: Date.now(),
    })
  }
  
  saveToLocal(LOCAL_STORAGE_KEYS.WATCHLIST, localWatchlist)
  return true
}

export async function updateWatchlistStatus(slug: string, status: WatchlistStatus) {
  const user = auth?.currentUser
  if (!user) return false
  
  const watchlistRef = doc(db, 'users', user.uid, 'watchlist', encodeURIComponent(slug))
  await updateDoc(watchlistRef, {
    status,
    updatedAt: serverTimestamp(),
  })
  return true
}

export async function getWatchlistByStatus(status?: WatchlistStatus) {
  const user = auth?.currentUser
  if (!user) return []
  
  try {
    const watchlistRef = collection(db, 'users', user.uid, 'watchlist')
    let q = query(watchlistRef, orderBy('addedAt', 'desc'))
    
    if (status) {
      q = query(watchlistRef, where('status', '==', status), orderBy('addedAt', 'desc'))
    }
    
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch {
    // Fallback ke localStorage
    const localWatchlist = loadFromLocal(LOCAL_STORAGE_KEYS.WATCHLIST) || []
    if (status) {
      return localWatchlist.filter((item: any) => item.status === status)
    }
    return localWatchlist
  }
}

// ─── CONTINUE WATCHING ───────────────────────────────────────

export async function saveContinueWatching(slug: string, episodeSlug: string, progress: number) {
  const user = auth?.currentUser
  if (!user) return false
  
  const continueRef = doc(db, 'users', user.uid, 'continue', encodeURIComponent(slug))
  await setDoc(continueRef, {
    slug,
    episodeSlug,
    progress,
    timestamp: serverTimestamp(),
    lastWatched: Date.now(),
  })
  
  // Simpan di localStorage juga
  const localContinue = loadFromLocal(LOCAL_STORAGE_KEYS.CONTINUE_WATCHING) || []
  const existingIndex = localContinue.findIndex((c: any) => c.slug === slug)
  
  if (existingIndex >= 0) {
    localContinue[existingIndex] = { slug, episodeSlug, progress, lastWatched: Date.now() }
  } else {
    localContinue.push({ slug, episodeSlug, progress, lastWatched: Date.now() })
  }
  
  saveToLocal(LOCAL_STORAGE_KEYS.CONTINUE_WATCHING, localContinue)
  return true
}

export async function getContinueWatching() {
  const user = auth?.currentUser
  if (!user) return []
  
  try {
    const continueRef = collection(db, 'users', user.uid, 'continue')
    const q = query(continueRef, orderBy('timestamp', 'desc'), limit(10))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
  } catch {
    // Fallback ke localStorage
    return loadFromLocal(LOCAL_STORAGE_KEYS.CONTINUE_WATCHING) || []
  }
}

// ─── AVATAR/BANNER: BASE64 (tanpa Firebase Storage) ──────────
// Gambar di-resize + dikompres di browser (canvas) sebelum diubah ke Base64,
// lalu disimpan langsung sebagai field di dokumen Firestore user. Ini menghindari
// biaya/kebutuhan Firebase Storage sepenuhnya — cocok untuk free tier.
// Firestore document limit ~1MB, jadi avatar dibatasi resolusi kecil (aman jauh di bawah itu).

export function resizeAndCompressImage(
  file: File,
  maxDimension: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File harus berupa gambar'))
      return
    }

    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Gagal membaca file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Gagal memuat gambar'))
      img.onload = () => {
        let { width, height } = img
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas tidak didukung'))
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

const MAX_AVATAR_BASE64_BYTES = 400 * 1024 // ~400KB, aman jauh di bawah limit dokumen 1MB

export async function uploadAvatarBase64(file: File, uid: string) {
  try {
    // Coba beberapa level kompresi sampai ukurannya cukup kecil untuk Firestore
    const attempts: [number, number][] = [
      [256, 0.8],
      [256, 0.6],
      [192, 0.5],
      [128, 0.4],
    ]

    let base64 = ''
    for (const [dimension, quality] of attempts) {
      base64 = await resizeAndCompressImage(file, dimension, quality)
      if (base64.length <= MAX_AVATAR_BASE64_BYTES) break
    }

    if (base64.length > MAX_AVATAR_BASE64_BYTES) {
      return { success: false, error: 'Gambar terlalu besar, coba foto lain ya~' }
    }

    await updateUserFirestore(uid, { photoURL: base64 })
    return { success: true, url: base64 }
  } catch (error) {
    return { success: false, error }
  }
}

export async function uploadBannerBase64(file: File, uid: string) {
  try {
    const attempts: [number, number][] = [
      [800, 0.7],
      [600, 0.6],
      [480, 0.5],
    ]

    let base64 = ''
    for (const [dimension, quality] of attempts) {
      base64 = await resizeAndCompressImage(file, dimension, quality)
      if (base64.length <= MAX_AVATAR_BASE64_BYTES * 2) break
    }

    if (base64.length > MAX_AVATAR_BASE64_BYTES * 2) {
      return { success: false, error: 'Gambar terlalu besar, coba foto lain ya~' }
    }

    await updateUserFirestore(uid, { bannerURL: base64 })
    return { success: true, url: base64 }
  } catch (error) {
    return { success: false, error }
  }
}

// ─── STATS ───────────────────────────────────────────────────

export async function updateStats(updates: {
  watchedEpisodes?: number
  totalHours?: number
  averageScore?: number
  watchlistCount?: number
}) {
  const user = auth?.currentUser
  if (!user) return false
  
  const userRef = doc(db, 'users', user.uid)
  const userSnap = await getDoc(userRef)
  
  if (!userSnap.exists()) return false
  
  const currentStats = userSnap.data().stats || {}
  const newStats = { ...currentStats, ...updates }
  
  await updateDoc(userRef, { stats: newStats })
  return true
}
