'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { createClient } from '@/lib/supabase/client'
import './app-shell.css'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const router = useRouter()

  // Client-side auth gate: proxy.ts (middleware) does not run on a static
  // export (GitHub Pages has no server), so this is the real enforcement
  // point for every route rendered inside AppShell.
  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/auth/login')
        return
      }
      setAuthChecked(true)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace('/auth/login')
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [router])

  if (!authChecked) {
    return null
  }

  return (
    <div className="app-shell">
      <Sidebar isOpen={isSidebarOpen} />
      <div className="app-shell__main">
        <Topbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((v) => !v)}
        />
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  )
}
