import { createClient } from '@/lib/supabase/client'

export interface CatalogItem {
  id: string
  nombre: string
  tipo: string
  es_diversion?: boolean
}

const CUENTAS_KEY = 'finanzas:catalog:cuentas'
const CATEGORIAS_KEY = 'finanzas:catalog:categorias'

const EMPTY_DEFAULT: CatalogItem = { id: '', nombre: 'Sin seleccionar', tipo: '' }

let _cuentas: CatalogItem[] = []
let _categorias: CatalogItem[] = []

export let CUENTAS: CatalogItem[] = []
export let CATEGORIAS: CatalogItem[] = []
export let CUENTA_DEFAULT: CatalogItem = EMPTY_DEFAULT
export let CATEGORIA_DEFAULT: CatalogItem = EMPTY_DEFAULT

function loadFromStorage<T>(key: string): T[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch (error) {
    console.warn(`[catalog-store] Failed to read "${key}" from localStorage`, error)
    return []
  }
}

function saveToStorage<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.warn(`[catalog-store] Failed to write "${key}" to localStorage`, error)
  }
}

async function fetchCuentasFromSupabase(): Promise<CatalogItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('cuenta')
    .select('id, nombre, tipo')
    .eq('activa', true)
    .order('nombre')

  if (error) throw error
  return data ?? []
}

async function fetchCategoriasFromSupabase(): Promise<CatalogItem[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('categoria')
    .select('id, nombre, tipo, es_diversion')
    .eq('activa', true)
    .order('nombre')

  if (error) throw error
  return data ?? []
}

function applyCuentas(data: CatalogItem[]): void {
  _cuentas = data
  CUENTAS = _cuentas
  CUENTA_DEFAULT = _cuentas[0] ?? EMPTY_DEFAULT
}

function applyCategorias(data: CatalogItem[]): void {
  _categorias = data
  CATEGORIAS = _categorias
  CATEGORIA_DEFAULT = _categorias[0] ?? EMPTY_DEFAULT
}

/**
 * Loads catalogs from `localStorage`. If either catalog is missing from the
 * cache, fetches it from Supabase, writes it back to `localStorage`, and
 * populates the in-memory state. Safe to call on every app mount — it is a
 * no-op (besides the sync `localStorage` reads) once the cache is populated.
 */
export async function initCatalogs(): Promise<void> {
  const cachedCuentas = loadFromStorage<CatalogItem>(CUENTAS_KEY)
  if (cachedCuentas.length > 0) {
    applyCuentas(cachedCuentas)
  } else {
    try {
      const fetched = await fetchCuentasFromSupabase()
      saveToStorage(CUENTAS_KEY, fetched)
      applyCuentas(fetched)
    } catch (error) {
      console.warn('[catalog-store] Failed to fetch cuentas from Supabase', error)
    }
  }

  const cachedCategorias = loadFromStorage<CatalogItem>(CATEGORIAS_KEY)
  if (cachedCategorias.length > 0) {
    applyCategorias(cachedCategorias)
  } else {
    try {
      const fetched = await fetchCategoriasFromSupabase()
      saveToStorage(CATEGORIAS_KEY, fetched)
      applyCategorias(fetched)
    } catch (error) {
      console.warn('[catalog-store] Failed to fetch categorias from Supabase', error)
    }
  }
}

/** Forces a fresh fetch of cuentas from Supabase and updates cache + memory. */
export async function syncCuentas(): Promise<CatalogItem[]> {
  const fetched = await fetchCuentasFromSupabase()
  saveToStorage(CUENTAS_KEY, fetched)
  applyCuentas(fetched)
  return fetched
}

/** Forces a fresh fetch of categorías from Supabase and updates cache + memory. */
export async function syncCategorias(): Promise<CatalogItem[]> {
  const fetched = await fetchCategoriasFromSupabase()
  saveToStorage(CATEGORIAS_KEY, fetched)
  applyCategorias(fetched)
  return fetched
}

/** Synchronous read for non-React consumers. */
export function getCuentas(): CatalogItem[] {
  return CUENTAS
}

/** Synchronous read for non-React consumers. */
export function getCategorias(): CatalogItem[] {
  return CATEGORIAS
}
