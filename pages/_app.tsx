import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import Script from 'next/script'
import { ReactNode, useEffect } from 'react'
import { Noto_Sans_JP, Plus_Jakarta_Sans } from 'next/font/google'
import { MotionConfig } from 'framer-motion'
import Layout from '@/components/Layout'
import SmoothScroll from '@/components/SmoothScroll'
import { AuthProvider } from '@/contexts/AuthContext'
import { LoadingProvider } from '@/contexts/LoadingContext'
import { NotificationProvider } from '@/contexts/NotificationContext'
import { SettingsProvider, useSettings } from '@/contexts/SettingsContext'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
})

const notoJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-noto-jp',
})

const APP_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');var dark=t?t==='dark':true;if(dark)document.documentElement.classList.add('dark');var m=document.getElementById('theme-color-meta');if(m)m.setAttribute('content',dark?'#000000':'#F5F5F7');var s=localStorage.getItem('kiranime-settings');if(s){var o=JSON.parse(s);var r=document.documentElement;if(o.accent)r.setAttribute('data-accent',o.accent);r.setAttribute('data-animations',o.animations===false?'off':'on');r.setAttribute('data-liquid-glass',o.liquidGlass===false?'off':'on');}}catch(e){}})();`

function AppShell({ children }: { children: ReactNode }) {
  const { animations } = useSettings()
  return (
    <MotionConfig reducedMotion={animations ? 'never' : 'always'}>
      <SmoothScroll>
        <Layout>{children}</Layout>
      </SmoothScroll>
    </MotionConfig>
  )
}

export default function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .catch((err) => console.error('Gagal mendaftarkan service worker:', err))
    }

    window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])

  return (
    <div className={`${jakarta.variable} ${notoJP.variable}`}>
      <AuthProvider>
        <SettingsProvider>
          <NotificationProvider>
            <LoadingProvider>
              <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
                <meta name="theme-color" content="#000000" id="theme-color-meta" />
              </Head>
              <Script id="app-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: APP_INIT_SCRIPT }} />
              <AppShell>
                <Component {...pageProps} />
              </AppShell>
            </LoadingProvider>
          </NotificationProvider>
        </SettingsProvider>
      </AuthProvider>
    </div>
  )
}
