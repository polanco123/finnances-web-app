import { CUENTA_DEFAULT } from '../../lib/catalogs/cuentas'
import { CATEGORIA_DEFAULT } from '../../lib/catalogs/categorias'

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

const TRANSFERENCIA_CATEGORIA_ID = '32151dbb-6732-45a7-befd-9057dc9f935a'

export function crearMovimientoTransferencia({ monto, fecha, hora, cuentaOrigenId, cuentaDestinoId, notas }) {
  const montoAbs = Math.abs(Number(monto))

  const base = {
    fecha: fecha || MOVIMIENTO_DEFAULT.fecha,
    hora: hora || MOVIMIENTO_DEFAULT.hora,
    categoria_id: TRANSFERENCIA_CATEGORIA_ID,
    es_transferencia: true,
    es_ajuste: false,
    descripcion: '',
    msi_id: null,
    notas: notas || null,
    transferencia_id: crypto.randomUUID(),
  }

  const origen = {
    ...base,
    monto: -montoAbs,
    cuenta_id: cuentaOrigenId,
  }

  const destino = {
    ...base,
    monto: montoAbs,
    cuenta_id: cuentaDestinoId,
  }

  return { origen, destino }
}
