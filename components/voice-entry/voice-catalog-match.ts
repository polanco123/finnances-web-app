import type { CatalogItem } from '@/lib/catalogs/catalog-store'

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export function matchCatalogItem(spokenText: string, catalog: CatalogItem[]): CatalogItem | null {
  const spoken = normalize(spokenText)
  if (!spoken) return null
  let best: CatalogItem | null = null
  let bestLen = Infinity
  for (const item of catalog) {
    const nombre = normalize(item.nombre)
    if (nombre.includes(spoken) || spoken.includes(nombre)) {
      if (nombre.length < bestLen) { best = item; bestLen = nombre.length }
    }
  }
  return best
}
