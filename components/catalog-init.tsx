'use client'

import { useEffect } from 'react'
import { initCatalogs } from '@/lib/catalogs/catalog-store'

/**
 * Side-effect-only component: initializes the catalog store (cuentas,
 * categorías) on client mount. Renders nothing.
 */
export function CatalogInit() {
  useEffect(() => {
    initCatalogs()
  }, [])

  return null
}
