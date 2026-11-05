import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState, FormEvent, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAnimationsEnabled } from '@/lib/hooks/useAnimations'
import {
  Search,
  Moon,
  Sun,
  Menu,
  X,
  LogIn,
  Home,
  BookOpen,
  ScrollText,
  BookMarked,
  Clapperboard,
  LogOut,
  UserPlus,
  Newspaper,
  Users,
  MessageCircle,
  Settings,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { translate } from '@/lib/i18n'
import { motionTokens, adaptiveDuration } from '@/lib/motionTokens'
import { LiquidGlassCursorButton, LiquidGlassCursorLink } from './LiquidGlassCursor'
import NotificationBell from './NotificationBell'
import AccountMenu from './AccountMenu'

interface NavItem {
  label: string
  href: string
  icon: ReactNode
}

const MotionLink = motion(Link)

export default function TopNavbar() {
  const router = useRouter()
  const { user, profile, accounts, loading: authLoading, logout, addAccount } = useAuth()
  const { language, liquidGlass } = useSettings()
  const t = (key: string) => translate(language, key)
  // Glass nav pills always use the cursor-following liquid glass effect.
  const GlassButton = LiquidGlassCursorButton
  const GlassLink = LiquidGlassCursorLink

  const NAV_LINKS: NavItem[] = [
    { label: t('nav.home'), href: '/', icon: <Home size={16} /> },
    { label: t('nav.anime'), href: '/anime', icon: <Clapperboard size={16} /> },
    { label: t('nav.manga'), href: '/manga', icon: <BookOpen size={16} /> },
    { label: t('nav.webtoon'), href: '/webtoon', icon: <ScrollText size={16} /> },
    { label: t('nav.novel'), href: '/novel', icon: <BookMarked size={16} /> },
    { label: t('nav.news'), href: '/news', icon: <Newspaper size={16} /> },
  ]

  const SOCIAL_LINKS: NavItem[] = [
    { label: t('nav.friends'), href: '/friends', icon: <Users size={16} /> },
    { label: t('nav.groups'), href: '/groups', icon: <MessageCircle size={16} /> },
  ]

  const [isDark, setIsDark] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const reduceMotion = useAnimationsEnabled()
  const navRef = useRef<HTMLElement | null>(null)

  const drawerContainerVariants = {
    hidden: {},
    visible: {
      transition: reduceMotion
        ? { staggerChildren: 0, delayChildren: 0 }
        : { staggerChildren: 0.05, delayChildren: 0.05 },
    },
  }

  const drawerItemVariants = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : motionTokens.distance.sm },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reduceMotion ? 0 : adaptiveDuration(motionTokens.duration.fast),
        ease: motionTokens.easing.smooth,
      },
    },
  }

  const themeIconInitial = reduceMotion ? { opacity: 0 } : { rotate: -90, scale: 0.5, opacity: 0 }
  const themeIconAnimate = { rotate: 0, scale: 1, opacity: 1 }
  const themeIconExit = reduceMotion ? { opacity: 0 } : { rotate: 90, scale: 0.5, opacity: 0 }
  const themeIconTransition = {
    duration: adaptiveDuration(motionTokens.duration.normal),
    ease: motionTokens.easing.smooth,
  }
  const drawerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  useEffect(() => {
    setDrawerOpen(false)
    setSearchOpen(false)
  }, [router.pathname, router.asPath])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setDrawerOpen(false)
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    const drawer = drawerRef.current
    if (!drawer) return

    const focusables = drawer.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const previouslyFocused = document.activeElement as HTMLElement | null
    first?.focus()

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false)
        previouslyFocused?.focus()
        return
      }
      if (e.key !== 'Tab' || focusables.length === 0) return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [drawerOpen])

  const toggleTheme = () => {
    const root = document.documentElement
    const next = root.classList.contains('dark') ? 'light' : 'dark'
    root.classList.toggle('dark', next === 'dark')
    localStorage.setItem('theme', next)
    setIsDark(next === 'dark')
    document.getElementById('theme-color-meta')?.setAttribute('content', next === 'dark' ? '#000000' : '#F5F5F7')
  }

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
      setSearchOpen(false)
      setSearchQuery('')
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      router.push('/')
    } finally {
      setLoggingOut(false)
    }
  }

  const isActive = (href: string) => {
    if (href === '/') return router.pathname === '/'
    return router.pathname === href || router.pathname.startsWith(`${href}/`)
  }

  return (
    <header
      ref={navRef}
      className="site-header fixed top-0 left-0 right-0 z-50"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Main Bar */}
      <div className="h-16 bg-surface/85 dark:bg-surface-dark/85 backdrop-blur-md border-b border-pearl/10 shadow-sm">
        <div className="mx-auto max-w-[1600px] h-full px-4 md:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Left: Logo + mobile menu */}
          <div className="flex items-center gap-3">
            {liquidGlass ? (
              <GlassButton
                onClick={() => setDrawerOpen(!drawerOpen)}
                className="lg:hidden !rounded-full text-[var(--color-text)]"
                iconOnly
                aria-label={t('nav.openMenu')}
              >
                {drawerOpen ? <X size={22} /> : <Menu size={22} />}
              </GlassButton>
            ) : (
              <button
                onClick={() => setDrawerOpen(!drawerOpen)}
                className="lg:hidden p-2 rounded-lg bg-surface dark:bg-surface-dark text-[var(--color-text)] hover:bg-pearl/10 transition-colors"
                aria-label={t('nav.openMenu')}
              >
                {drawerOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            )}
            <Link href="/" className="flex items-center gap-2 transition-transform hover:scale-105">
              <Image src="/icons/icon-96x96.png" alt="" width={32} height={32} className="rounded-lg" />
              <Image src="/logo-title.png" alt="KiraStream" width={110} height={36} className="h-7 w-auto object-contain" priority />
            </Link>
          </div>

          {/* Center: Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {NAV_LINKS.map((link) =>
              liquidGlass && isActive(link.href) ? (
                <GlassLink
                  key={link.href}
                  href={link.href}
                  className="group !rounded-full !px-3.5 !py-2"
                  labelClassName="!text-primary dark:!text-accent"
                >
                  {link.icon} {link.label}
                </GlassLink>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative z-0 flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isActive(link.href)
                      ? 'text-primary dark:text-accent'
                      : 'text-[var(--color-text-muted)] hover:text-primary dark:hover:text-accent'
                  }`}
                >
                  {isActive(link.href) && (
                    <motion.span
                      layoutId="nav-active-pill"
                      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 32 }}
                      className="absolute inset-0 -z-10 rounded-lg bg-primary/10 dark:bg-accent/15 pointer-events-none"
                      aria-hidden="true"
                    />
                  )}
                  {link.icon} {link.label}
                </Link>
              )
            )}
            {SOCIAL_LINKS.map((link) =>
              liquidGlass && isActive(link.href) ? (
                <GlassLink
                  key={link.href}
                  href={link.href}
                  className="group !rounded-full !px-3.5 !py-2"
                  labelClassName="!text-primary dark:!text-accent"
                >
                  {link.icon} {link.label}
                </GlassLink>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative z-0 flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isActive(link.href)
                      ? 'text-primary dark:text-accent'
                      : 'text-[var(--color-text-muted)] hover:text-primary dark:hover:text-accent'
                  }`}
                >
                  {isActive(link.href) && (
                    <motion.span
                      layoutId="nav-active-pill"
                      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 350, damping: 32 }}
                      className="absolute inset-0 -z-10 rounded-lg bg-primary/10 dark:bg-accent/15 pointer-events-none"
                      aria-hidden="true"
                    />
                  )}
                  {link.icon} {link.label}
                </Link>
              )
            )}
          </nav>

          {/* Right: Actions */}
          <div className="flex items-center gap-1.5">
            {liquidGlass ? (
              <GlassButton
                onClick={() => setSearchOpen(!searchOpen)}
                className="!rounded-full text-[var(--color-text)]"
                iconOnly
                aria-label={t('nav.search')}
              >
                <Search size={20} aria-hidden="true" />
              </GlassButton>
            ) : (
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="p-2 rounded-lg bg-surface dark:bg-surface-dark text-[var(--color-text)] hover:bg-pearl/10 transition-colors"
                aria-label={t('nav.search')}
              >
                <Search size={20} aria-hidden="true" />
              </button>
            )}

            {liquidGlass ? (
              <GlassButton
                onClick={toggleTheme}
                className="!rounded-full text-[var(--color-text)]"
                iconOnly
                aria-label={t('nav.toggleTheme')}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isDark ? (
                    <motion.span
                      key="theme-sun"
                      initial={themeIconInitial}
                      animate={themeIconAnimate}
                      exit={themeIconExit}
                      transition={themeIconTransition}
                      className="flex"
                    >
                      <Sun size={20} aria-hidden="true" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="theme-moon"
                      initial={themeIconInitial}
                      animate={themeIconAnimate}
                      exit={themeIconExit}
                      transition={themeIconTransition}
                      className="flex"
                    >
                      <Moon size={20} aria-hidden="true" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </GlassButton>
            ) : (
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-surface dark:bg-surface-dark text-[var(--color-text)] hover:bg-pearl/10 transition-colors"
                aria-label={t('nav.toggleTheme')}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isDark ? (
                    <motion.span
                      key="theme-sun"
                      initial={themeIconInitial}
                      animate={themeIconAnimate}
                      exit={themeIconExit}
                      transition={themeIconTransition}
                      className="flex"
                    >
                      <Sun size={20} aria-hidden="true" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="theme-moon"
                      initial={themeIconInitial}
                      animate={themeIconAnimate}
                      exit={themeIconExit}
                      transition={themeIconTransition}
                      className="flex"
                    >
                      <Moon size={20} aria-hidden="true" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )}

            <NotificationBell />

            {liquidGlass ? (
              <GlassLink
                href="/settings"
                className="!rounded-full"
                iconOnly
                aria-label={t('nav.settings')}
              >
                <Settings size={20} aria-hidden="true" />
              </GlassLink>
            ) : (
              <Link
                href="/settings"
                className="p-2 rounded-lg bg-surface dark:bg-surface-dark text-[var(--color-text)] hover:bg-pearl/10 transition-colors"
                aria-label={t('nav.settings')}
              >
                <Settings size={20} aria-hidden="true" />
              </Link>
            )}

            {authLoading ? (
              <div className="hidden sm:block w-9 h-9 rounded-full bg-pearl/10 animate-pulse" />
            ) : user ? (
              <AccountMenu />
            ) : (
              <>
                {accounts.length > 0 && (
                  <Link
                    href="/accounts"
                    className="hidden sm:inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:bg-pearl/10 hover:text-[var(--color-text)]"
                    aria-label={t('account.manage')}
                    title={t('account.manage')}
                  >
                    <Users size={16} aria-hidden="true" />
                    <span className="hidden xl:inline">{t('account.manage')}</span>
                  </Link>
                )}
                <Link
                  href="/login"
                  className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold bg-primary dark:bg-accent text-white dark:text-noir hover:opacity-90 transition-opacity"
                >
                  <LogIn size={16} aria-hidden="true" /> {t('nav.login')}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.15 }}
            className="mx-auto max-w-[1600px] px-4 md:px-6 lg:px-8 pt-2"
          >
            <form
              onSubmit={handleSearch}
              className="rounded-2xl border border-pearl/10 bg-surface dark:bg-surface-dark shadow-xl p-3 flex items-center gap-2"
            >
              <Search size={20} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
              <input
                type="search"
                name="q"
                autoComplete="off"
                aria-label={t('hero.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('hero.searchPlaceholder')}
                className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button type="submit" className="btn-primary text-xs shrink-0">
                {t('nav.search')}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : undefined}
              className="fixed inset-0 bg-noir/50 backdrop-blur-sm lg:hidden"
              onClick={() => setDrawerOpen(false)}
              aria-label={t('nav.closeMenu')}
            />
            <motion.aside
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label={t('a11y.drawerMenu')}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={reduceMotion ? { duration: 0 } : { type: 'spring', damping: 28, stiffness: 260 }}
              className="fixed top-[calc(4rem+env(safe-area-inset-top))] bottom-0 left-0 w-72 bg-surface dark:bg-surface-dark z-50 lg:hidden overflow-y-auto overscroll-contain custom-scrollbar border-r border-pearl/10 shadow-xl"
            >
              <motion.nav
                className="p-4 space-y-1"
                initial="hidden"
                animate="visible"
                variants={drawerContainerVariants}
              >
                {NAV_LINKS.map((link) => (
                  <MotionLink
                    key={link.href}
                    href={link.href}
                    variants={drawerItemVariants}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                      isActive(link.href)
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'text-[var(--color-text-muted)] hover:bg-pearl/10 hover:text-primary dark:hover:text-accent'
                    }`}
                  >
                    {link.icon} {link.label}
                  </MotionLink>
                ))}

                {/* Sosial */}
                <motion.div variants={drawerItemVariants} className="pt-3 mt-3 border-t border-pearl/10 space-y-1">
                  <p className="px-4 py-1 text-[11px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">{t('nav.social')}</p>
                  {SOCIAL_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                        isActive(link.href)
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'text-[var(--color-text-muted)] hover:bg-pearl/10 hover:text-primary dark:hover:text-accent'
                      }`}
                    >
                      {link.icon} {link.label}
                    </Link>
                  ))}
                </motion.div>

                {/* Settings */}
                <motion.div variants={drawerItemVariants} className="pt-3 mt-3 border-t border-pearl/10 space-y-1">
                  <Link
                    href="/settings"
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                      isActive('/settings')
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'text-[var(--color-text-muted)] hover:bg-pearl/10 hover:text-primary dark:hover:text-accent'
                    }`}
                  >
                    <Settings size={18} aria-hidden="true" /> {t('nav.settings')}
                  </Link>
                </motion.div>

                {/* Account */}
                <motion.div variants={drawerItemVariants} className="pt-3 mt-3 border-t border-pearl/10 space-y-2">
                  {authLoading ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-pearl/5 animate-pulse">
                      <div className="w-9 h-9 rounded-full bg-pearl/10 shrink-0" />
                      <div className="h-3 w-24 rounded bg-pearl/10" />
                    </div>
                  ) : user ? (
                    <>
                      <Link href="/profile" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-pearl/5 hover:bg-pearl/10 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-primary dark:bg-accent shrink-0 flex items-center justify-center overflow-hidden">
                          {profile?.photoURL ? (
                            <img src={profile.photoURL} alt={profile?.displayName || 'Avatar'} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm font-bold text-white">
                              {(profile?.displayName || user.displayName || user.email || '?')[0].toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{profile?.displayName || user.displayName || 'KiraFan'}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{t('nav.viewProfile')}</p>
                        </div>
                      </Link>
                      <button
                        onClick={() => {
                          setDrawerOpen(false)
                          addAccount()
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[var(--color-text-muted)] hover:bg-pearl/10 hover:text-[var(--color-text)] transition-colors"
                      >
                        <UserPlus size={18} aria-hidden="true" />
                        {t('account.add')}
                      </button>
                      <Link
                        href="/accounts"
                        onClick={() => setDrawerOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                          isActive('/accounts')
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'text-[var(--color-text-muted)] hover:bg-pearl/10 hover:text-[var(--color-text)]'
                        }`}
                      >
                        <Users size={18} aria-hidden="true" />
                        {t('account.manage')}
                      </Link>
                      <button
                        onClick={handleLogout}
                        disabled={loggingOut}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      >
                        <LogOut size={18} aria-hidden="true" />
                        {loggingOut ? 'Logging out\u2026' : t('nav.logout')}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary dark:text-accent font-medium border border-primary/20"
                      >
                        <LogIn size={18} aria-hidden="true" />
                        {t('nav.loginRegister')}
                      </Link>
                      {accounts.length > 0 && (
                        <Link
                          href="/accounts"
                          onClick={() => setDrawerOpen(false)}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-[var(--color-text-muted)] hover:bg-pearl/10 hover:text-[var(--color-text)] transition-colors"
                        >
                          <Users size={18} aria-hidden="true" />
                          {t('account.manage')}
                        </Link>
                      )}
                    </>
                  )}
                </motion.div>
              </motion.nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  )
}
