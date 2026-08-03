import { AppShell } from '@/components/app-shell/app-shell'
import { CatalogInit } from '@/components/catalog-init'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppShell>
      <CatalogInit />
      {children}
    </AppShell>
  )
}
