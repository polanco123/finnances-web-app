import { CUENTAS, CUENTA_DEFAULT } from '@/lib/catalogs/catalog-store'

export interface Cuenta {
  id: string
  nombre: string
  tipo: string
  saldo_calculado: number
  saldo_real: number
  frecuencia_revision: string
  es_default: boolean
  activa: boolean
  limite_credito: number | null
  dia_corte: number | null
  dia_pago: number | null
  icono: string | null
}

export { CUENTAS, CUENTA_DEFAULT }
