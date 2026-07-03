import { CUENTAS, CUENTA_DEFAULT } from '../../lib/catalogs/cuentas'
import { CATEGORIAS, CATEGORIA_DEFAULT } from '../../lib/catalogs/categorias'

export const CAMPOS = {
  MONTO: 'monto',
  DESCRIPCION: 'descripcion',
  FECHA: 'fecha',
  HORA: 'hora',
  CUENTA_ID: 'cuenta_id',
  CATEGORIA_ID: 'categoria_id',
  MSI_ID: 'msi_id',
  TRANSFERENCIA_ID: 'transferencia_id',
  ES_TRANSFERENCIA: 'es_transferencia',
  ES_AJUSTE: 'es_ajuste',
  FUENTE: 'fuente',
  NOTAS: 'notas',
}

export const FUENTES = {
  MANUAL: 'manual',
  AUTOMATICO: 'automatico',
  TRANSFERENCIA: 'transferencia',
}

const MOVIMIENTO_DEFAULT = {
  monto: 0,
  descripcion: '',
  fecha: new Date().toISOString().split('T')[0],
  hora: null,
  cuenta_id: CUENTA_DEFAULT.id,
  categoria_id: CATEGORIA_DEFAULT.id,
  msi_id: null,
  transferencia_id: null,
  es_transferencia: false,
  es_ajuste: false,
  fuente: FUENTES.MANUAL,
  notas: null,
}

export function crearMovimiento({ monto, descripcion, fecha, hora, cuenta_id, categoria_id, ...rest }) {
  return {
    ...MOVIMIENTO_DEFAULT,
    monto,
    descripcion,
    fecha: fecha || MOVIMIENTO_DEFAULT.fecha,
    hora: hora || MOVIMIENTO_DEFAULT.hora,
    cuenta_id: cuenta_id || CUENTA_DEFAULT.id,
    categoria_id: categoria_id || CATEGORIA_DEFAULT.id,
    ...rest,
  }
}
