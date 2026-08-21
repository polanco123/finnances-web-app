'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Gamepad2,
  Wallet,
  Tags,
  BarChart3,
  Settings,
  MinusCircle,
  Target,
} from 'lucide-react'
import './sidebar.css'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number }>
  comingSoon?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { href: '/diversion', label: 'Diversión', icon: Gamepad2 },
  { href: '/cuentas', label: 'Cuentas', icon: Wallet },
  { href: '/deudas', label: 'Deudas', icon: MinusCircle },
  { href: '/metas', label: 'Metas', icon: Target },
  { href: '/categorias', label: 'Categorías', icon: Tags },
  { href: '/reportes', label: 'Reportes', icon: BarChart3 },
  { href: '/configuracion', label: 'Configuración', icon: Settings, comingSoon: true },
]

interface SidebarProps {
  isOpen: boolean
}

export function Sidebar({ isOpen }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
      <nav className="sidebar__nav">
        <div className="sidebar__brand">
          <img src="/logo.png" alt="Finances web app" className="sidebar__logo" />
        </div>
        <ul className="sidebar__list">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`sidebar__link${isActive ? ' sidebar__link--active' : ''}${item.comingSoon ? ' sidebar__link--coming-soon' : ''}`}
                >
                  <item.icon size={20} />
                  <span className="sidebar__label">{item.label}</span>
                  {item.comingSoon && (
                    <span className="sidebar__badge">Próximamente</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
