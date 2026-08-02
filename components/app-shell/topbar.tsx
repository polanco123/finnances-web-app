'use client'

import { Menu, Bell } from 'lucide-react'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { LogoutButton } from '@/components/logout-button'
import './topbar.css'

interface TopbarProps {
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

export function Topbar({ isSidebarOpen, onToggleSidebar }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <button
          type="button"
          className="topbar__toggle"
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <Menu size={20} />
        </button>
      </div>
      <div className="topbar__right">
        <button
          type="button"
          className="topbar__icon-btn"
          aria-label="Notifications"
        >
          <Bell size={20} />
        </button>
        <ThemeSwitcher />
        <LogoutButton />
      </div>
    </header>
  )
}
