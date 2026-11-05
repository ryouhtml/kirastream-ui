import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useRouter } from 'next/router'
import { User } from 'firebase/auth'
import {
  auth,
  onAuthChange,
  loginWithGoogle as firebaseLoginWithGoogle,
  loginWithEmail,
  registerWithEmail,
  logout as firebaseLogout,
  updateUserProfile,
  getUserFirestore,
} from '@/lib/firebase'
import {
  SavedAccount,
  accountFromUser,
  getActiveAccountUid,
  loadSavedAccounts,
  removeSavedAccount,
  setAccountsReturnPath,
  setActiveAccountUid,
  subscribeAccounts,
  upsertSavedAccount,
} from '@/lib/accounts'

interface AuthContextType {
  user: User | null
  profile: any | null
  loading: boolean
  // ─── Multi-akun ────────────────────────────────────────────
  accounts: SavedAccount[]
  activeUid: string | null
  addAccount: () => void
  switchAccount: (uid: string) => void
  forgetAccount: (uid: string) => void
  // ─── Auth ──────────────────────────────────────────────────
  loginWithGoogle: (options?: { selectAccount?: boolean }) => Promise<any>
  loginWithEmail: (email: string, password: string) => Promise<any>
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<any>
  logout: () => Promise<any>
  updateProfile: (updates: { displayName?: string; photoURL?: string }) => Promise<any>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  // Daftar akun tersimpan di perangkat ini (metadata saja, tanpa token).
  const [accounts, setAccounts] = useState<SavedAccount[]>([])
  const [activeUid, setActiveUid] = useState<string | null>(null)

  const refreshProfile = useCallback(async () => {
    if (!auth?.currentUser) {
      setProfile(null)
      return
    }
    const data = await getUserFirestore(auth.currentUser.uid)
    setProfile(data)
  }, [])

  // Muat daftar akun dari localStorage lalu ikuti perubahannya
  // (dari tab lain atau dari komponen lain di tab ini).
  useEffect(() => {
    const sync = () => {
      setAccounts(loadSavedAccounts())
      setActiveUid(getActiveAccountUid())
    }

    sync()
    return subscribeAccounts(sync)
  }, [])

  useEffect(() => {
    // Firebase belum dikonfigurasi: tidak ada sesi yang perlu ditunggu,
    // jadi hentikan loading supaya UI (termasuk daftar akun) tetap muncul.
    if (!auth) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthChange(async (nextUser) => {
      setUser(nextUser)
      if (nextUser) {
        // Catat akun ini ke daftar supaya bisa dipilih lagi nanti.
        setAccounts(upsertSavedAccount(accountFromUser(nextUser)))
        setActiveAccountUid(nextUser.uid)
        setActiveUid(nextUser.uid)
        const data = await getUserFirestore(nextUser.uid)
        setProfile(data)
      } else {
        setProfile(null)
        setActiveAccountUid(null)
        setActiveUid(null)
      }
      setLoading(false)
    })

    return unsubscribe
  }, [])

  // Tambah akun: buka login dalam mode "add". Akun yang sekarang tetap
  // tersimpan di daftar, jadi setelah login akun baru kita bisa kembali.
  const addAccount = useCallback(() => {
    setAccountsReturnPath(router.asPath || '/')
    void router.push('/login?add=1')
  }, [router])

  // Ganti akun: Firebase hanya memegang satu sesi, jadi arahkan ke login
  // dengan email terisi otomatis. Password tidak pernah disimpan.
  const switchAccount = useCallback(
    (uid: string) => {
      if (!uid) return
      if (user?.uid === uid) {
        void router.push('/profile')
        return
      }
      setAccountsReturnPath(router.asPath || '/')
      void router.push(`/login?switch=${encodeURIComponent(uid)}`)
    },
    [router, user?.uid]
  )

  // Hapus akun dari daftar perangkat (bukan menghapus akun Firebase-nya).
  const forgetAccount = useCallback((uid: string) => {
    setAccounts(removeSavedAccount(uid))
  }, [])

  const updateProfile = async (updates: { displayName?: string; photoURL?: string }) => {
    if (!user) return { success: false, error: 'No user' }
    const result = await updateUserProfile(user, updates)
    await refreshProfile()
    return result
  }

  const value = {
    user,
    profile,
    loading,
    accounts,
    activeUid,
    addAccount,
    switchAccount,
    forgetAccount,
    loginWithGoogle: firebaseLoginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    logout: firebaseLogout,
    updateProfile,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
