'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import './app-shell.css'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

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
