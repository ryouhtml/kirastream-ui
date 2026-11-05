import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Phone, Mail as MailIcon, UserPlus, Users } from 'lucide-react'
import type { ConfirmationResult } from 'firebase/auth'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { sendPhoneOtp, confirmPhoneOtp } from '@/lib/firebase'
import { translate } from '@/lib/i18n'
import { clearAccountsReturnPath, getAccountsReturnPath, sanitizeReturnPath } from '@/lib/accounts'

export default function LoginPage() {
  const router = useRouter()
  const { loginWithGoogle, loginWithEmail, registerWithEmail, accounts } = useAuth()
  const { language } = useSettings()
  const t = (key: string) => translate(language, key)
  
  const [method, setMethod] = useState<'email' | 'phone'>('email')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ─── Phone (OTP) state ───────────────────────────────────
  const [phoneNumber, setPhoneNumber] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)

  // ─── Mode multi-akun (?add=1 / ?switch=<uid>) ────────────
  // add    : login akun baru, akun lama tetap tersimpan
  // switch : login ulang ke akun yang sudah tersimpan (email diisi otomatis)
  const [accountMode, setAccountMode] = useState<'none' | 'add' | 'switch'>('none')
  const [targetUid, setTargetUid] = useState('')
  const prefilledUidRef = useRef<string | null>(null)

  useEffect(() => {
    if (!router.isReady) return

    const add = router.query.add === '1'
    const switchId = typeof router.query.switch === 'string' ? router.query.switch : ''

    if (switchId) {
      setAccountMode('switch')
      setTargetUid(switchId)
      setMode('login')
      // Prefill email sekali saja, jangan menimpa ketikan pengguna.
      const saved = accounts.find((item) => item.uid === switchId)
      if (saved?.email && prefilledUidRef.current !== switchId) {
        setEmail(saved.email)
        setMethod('email')
        prefilledUidRef.current = switchId
      } else if (saved && !saved.email && saved.providerId === 'phone') {
        // Akun nomor HP tidak punya email — langsung tampilkan form OTP.
        setMethod('phone')
      }
    } else if (add) {
      setAccountMode('add')
      setTargetUid('')
      // Kalau sebelumnya sedang mode ganti akun, kosongkan email bawaan.
      if (prefilledUidRef.current) {
        setEmail('')
        prefilledUidRef.current = null
      }
    } else {
      setAccountMode('none')
      setTargetUid('')
    }
  }, [router.isReady, router.query.add, router.query.switch, accounts])

  const switchTarget = targetUid ? accounts.find((item) => item.uid === targetUid) || null : null
  const switchName = switchTarget?.displayName || switchTarget?.email || ''

  // Setelah berhasil login (atau batal), kembali ke halaman asal bila ada.
  const goToReturnPath = () => {
    const target = sanitizeReturnPath(getAccountsReturnPath() || '/')
    clearAccountsReturnPath()
    void router.push(target)
  }

  // Menormalkan input nomor HP Indonesia ke format E.164 (+62...)
  const normalizePhoneNumber = (input: string) => {
    const v = input.trim().replace(/[\s-()]/g, '')
    if (v.startsWith('+')) return v
    if (v.startsWith('62')) return `+${v}`
    if (v.startsWith('0')) return `+62${v.slice(1)}`
    return `+62${v}`
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await loginWithGoogle({ selectAccount: accountMode !== 'none' })
      if (result.success) {
        goToReturnPath()
      } else {
        setError(t('login.googleFail'))
      }
    } catch {
      setError(t('login.genericError'))
    } finally {
      setLoading(false)
    }
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (mode === 'login') {
        const result = await loginWithEmail(email, password)
        if (result.success) {
          goToReturnPath()
        } else {
          setError(t('login.invalidCredentials'))
        }
      } else {
        if (!displayName.trim()) {
          setError(t('login.nameRequired'))
          setLoading(false)
          return
        }
        const result = await registerWithEmail(email, password, displayName)
        if (result.success) {
          goToReturnPath()
        } else {
          setError(t('login.registerFail'))
        }
      }
    } catch {
      setError(t('login.systemError'))
    } finally {
      setLoading(false)
    }
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const formatted = normalizePhoneNumber(phoneNumber)
      const result = await sendPhoneOtp(formatted, 'recaptcha-container')
      if (result.success && result.confirmationResult) {
        setConfirmationResult(result.confirmationResult)
        setOtpSent(true)
      } else {
        setError(t('login.otpSendFail'))
      }
    } catch {
      setError(t('login.serverError'))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirmationResult) return
    setLoading(true)
    setError('')

    try {
      const result = await confirmPhoneOtp(confirmationResult, otpCode)
      if (result.success) {
        goToReturnPath()
      } else {
        setError(t('login.otpInvalid'))
      }
    } catch {
      setError(t('login.otpVerifyFail'))
    } finally {
      setLoading(false)
    }
  }

  const resetPhoneFlow = () => {
    setOtpSent(false)
    setOtpCode('')
    setConfirmationResult(null)
    setError('')
  }

  return (
    <>
      <Head>
        <title>
          {accountMode === 'add'
            ? t('account.addTitle')
            : accountMode === 'switch'
              ? t('account.switchTitle')
              : method === 'phone'
                ? t('login.phoneTitle')
                : mode === 'login'
                  ? t('login.title')
                  : t('login.register')}{' '}
          - KiraStream
        </title>
      </Head>

      <div className="min-h-[80vh] flex items-center justify-center py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="card p-8">
            {/* Logo */}
            <div className="text-center mb-8">
              <Image
                src="/logo-title.png"
                alt="KiraStream"
                width={180}
                height={60}
                className="h-12 w-auto object-contain mx-auto mb-2"
                priority
              />
              <p className="text-[var(--color-text-muted)]">
                {method === 'phone'
                  ? t('login.phoneSubtitle')
                  : mode === 'login' ? t('login.subtitle') : t('login.registerSubtitle')}
              </p>
            </div>

            {/* Banner tambah / ganti akun */}
            {accountMode !== 'none' && (
              <div className="mb-6 rounded-xl border border-ocean/25 bg-ocean/5 p-4">
                <div className="flex items-start gap-3">
                  {accountMode === 'add' ? (
                    <UserPlus size={18} className="mt-0.5 shrink-0 text-ocean" aria-hidden="true" />
                  ) : (
                    <Users size={18} className="mt-0.5 shrink-0 text-ocean" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--color-text)]">
                      {accountMode === 'add' ? t('account.addTitle') : t('account.switchTitle')}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
                      {accountMode === 'add'
                        ? t('account.addBanner')
                        : switchName
                          ? t('account.switchHint').replace('{name}', switchName)
                          : t('account.switchGeneric')}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={goToReturnPath}
                        className="rounded-lg bg-pearl/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-pearl/20"
                      >
                        {t('account.cancel')}
                      </button>
                      <Link
                        href="/accounts"
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-ocean transition-colors hover:bg-ocean/10"
                      >
                        {t('account.manage')}
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Pilih akun lain saat mode ganti akun */}
            {accountMode === 'switch' && accounts.length > 1 && (
              <div className="mb-6">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                  {t('account.saved')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {accounts.map((account) => {
                    const isTarget = account.uid === targetUid
                    return (
                      <button
                        key={account.uid}
                        type="button"
                        onClick={() => {
                          setTargetUid(account.uid)
                          setMode('login')
                          setError('')
                          prefilledUidRef.current = account.uid
                          if (account.email) {
                            setEmail(account.email)
                            setMethod('email')
                          } else {
                            setEmail('')
                            if (account.providerId === 'phone') setMethod('phone')
                          }
                        }}
                        aria-pressed={isTarget}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                          isTarget
                            ? 'border-ocean bg-ocean/10 text-ocean'
                            : 'border-pearl/15 text-[var(--color-text-muted)] hover:bg-pearl/10 hover:text-[var(--color-text)]'
                        }`}
                      >
                        <span className="max-w-[9rem] truncate">
                          {account.displayName || account.email || 'KiraFan'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Method Tabs */}
            <div className="flex mb-6 rounded-xl bg-surface-card p-1">
              <button
                type="button"
                onClick={() => { setMethod('email'); resetPhoneFlow() }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  method === 'email' ? 'bg-ocean text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <MailIcon size={15} /> {t('login.email')}
              </button>
              <button
                type="button"
                onClick={() => { setMethod('phone'); setError('') }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  method === 'phone' ? 'bg-ocean text-white' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                <Phone size={15} /> {t('login.phone')}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <AnimatePresence mode="wait">
              {method === 'email' ? (
                <motion.div
                  key="email-method"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Google Login */}
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full py-3 bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)] font-medium rounded-lg transition-colors flex items-center justify-center gap-3 mb-6 disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {t('login.google')}
                  </button>

                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-ocean/20" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-surface-card text-[var(--color-text-muted)]">{t('login.or')}</span>
                    </div>
                  </div>

                  {/* Email Form */}
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    {mode === 'register' && (
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                          {t('login.fullName')}
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="input-field"
                          placeholder={t('login.namePlaceholder')}
                          required
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                        {t('login.email')}
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="input-field"
                        placeholder="email@example.com"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                        {t('login.password')}
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-field"
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full btn-primary disabled:opacity-50"
                    >
                      {loading ? t('common.loading') : mode === 'login' ? t('login.title') : t('login.register')}
                    </button>
                  </form>

                  {/* Toggle Mode (disembunyikan saat login ulang akun tersimpan) */}
                  {accountMode !== 'switch' && (
                    <div className="mt-6 text-center">
                      <button
                        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                        className="text-sm text-ocean hover:text-oceanAccent-secondary transition-colors"
                      >
                        {mode === 'login' ? t('login.toRegister') : t('login.toLogin')}
                      </button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="phone-method"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {!otpSent ? (
                    <form onSubmit={handleSendOtp} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                          {t('login.phoneNumber')}
                        </label>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="input-field"
                          placeholder="08123456789"
                          required
                        />
                        <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                          {t('login.phoneExample')}
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !phoneNumber.trim()}
                        className="w-full btn-primary disabled:opacity-50"
                      >
                        {loading ? t('login.sendingOtp') : t('login.sendOtp')}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                          {t('login.otp')}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          className="input-field tracking-[0.5em] text-center"
                          placeholder="123456"
                          maxLength={6}
                          required
                        />
                        <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                          {t('login.otpSentTo').replace('{number}', normalizePhoneNumber(phoneNumber))}
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || otpCode.length < 6}
                        className="w-full btn-primary disabled:opacity-50"
                      >
                        {loading ? t('login.verifying') : t('login.verifyLogin')}
                      </button>

                      <button
                        type="button"
                        onClick={resetPhoneFlow}
                        className="w-full text-sm text-ocean hover:text-oceanAccent-secondary transition-colors"
                      >
                        {t('login.changePhone')}
                      </button>
                    </form>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Container reCAPTCHA (invisible) — wajib ada di DOM untuk login nomor HP */}
            <div id="recaptcha-container" />

            {/* Back to Home */}
            <div className="mt-4 text-center">
              <button
                onClick={() => router.push('/')}
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> {t('login.backHome')}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  )
}
