import { CATEGORIAS, CATEGORIA_DEFAULT } from '@/lib/catalogs/catalog-store'

export interface Categoria {
  id: string
  nombre: string
  tipo: string
  es_diversion: boolean
  activa: boolean
  icono: string | null
  color: string | null
}

export { CATEGORIAS, CATEGORIA_DEFAULT }

export const GASTO_TIPOS = ['compromiso', 'discrecional', 'suscripcion', 'trabajo', 'hogar'] as const

export function esCategoriaDeGasto(tipo: string): boolean {
  return (GASTO_TIPOS as readonly string[]).includes(tipo)
}
