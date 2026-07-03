interface Cuenta {
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
}

const raw: Cuenta[] = [
  { id: "386d3c00-307a-4dc3-ae82-0c20b8256dcd", nombre: "Klar TDC", tipo: "deuda", saldo_calculado: 0.00, saldo_real: 0.00, frecuencia_revision: "mensual", es_default: false, activa: true, limite_credito: null, dia_corte: 17, dia_pago: 27 },
  { id: "3d07a16e-277a-46e2-b196-5da54180c5ed", nombre: "Prestadero inversión", tipo: "retiro", saldo_calculado: 0.00, saldo_real: 19480.00, frecuencia_revision: "trimestral", es_default: false, activa: true, limite_credito: null, dia_corte: null, dia_pago: null },
  { id: "492551ee-9d48-49e1-a5f6-58e7132e51ee", nombre: "Nu Apartados PERSONALES", tipo: "ingreso", saldo_calculado: -2256.00, saldo_real: 26347.00, frecuencia_revision: "semanal", es_default: false, activa: true, limite_credito: null, dia_corte: null, dia_pago: null },
  { id: "49d4ed23-26c2-4cd5-aab3-bf15fbefc97a", nombre: "Yo te presto", tipo: "retiro", saldo_calculado: 0.00, saldo_real: 1214.00, frecuencia_revision: "trimestral", es_default: false, activa: true, limite_credito: null, dia_corte: null, dia_pago: null },
  { id: "54394f82-ec96-4574-8df7-f7447c77dec3", nombre: "Caja chica", tipo: "efectivo", saldo_calculado: -468.00, saldo_real: 150.00, frecuencia_revision: "semanal", es_default: false, activa: true, limite_credito: null, dia_corte: null, dia_pago: null },
  { id: "5927363d-9afc-4c7e-be08-7102860c4202", nombre: "Banamex TDC Oro", tipo: "deuda", saldo_calculado: -579.00, saldo_real: -3047.00, frecuencia_revision: "mensual", es_default: false, activa: true, limite_credito: null, dia_corte: 8, dia_pago: 28 },
  { id: "7807092b-2a37-42ab-b761-489d653f4893", nombre: "Didi Card", tipo: "deuda", saldo_calculado: -5552.00, saldo_real: -9568.00, frecuencia_revision: "mensual", es_default: false, activa: true, limite_credito: null, dia_corte: 12, dia_pago: 27 },
  { id: "8f7278c1-d2fa-4963-81ce-eb73bbbe9346", nombre: "Bankaya", tipo: "ingreso", saldo_calculado: 0.00, saldo_real: 0.00, frecuencia_revision: "mensual", es_default: false, activa: true, limite_credito: null, dia_corte: null, dia_pago: null },
  { id: "902ff995-e82a-4b51-ba67-4c76baea1225", nombre: "GBM", tipo: "retiro", saldo_calculado: 0.00, saldo_real: 27381.00, frecuencia_revision: "trimestral", es_default: false, activa: true, limite_credito: null, dia_corte: null, dia_pago: null },
  { id: "96326e38-832b-4cf0-9e66-86295474f944", nombre: "Suburbia", tipo: "deuda", saldo_calculado: 0.00, saldo_real: -1003.00, frecuencia_revision: "mensual", es_default: false, activa: true, limite_credito: null, dia_corte: 24, dia_pago: 24 },
  { id: "9815669a-066b-4753-829e-2eeff34602cd", nombre: "BBVA débito", tipo: "ingreso", saldo_calculado: 718.00, saldo_real: 420.00, frecuencia_revision: "semanal", es_default: false, activa: true, limite_credito: null, dia_corte: null, dia_pago: null },
  { id: "af6f5218-3c4b-4bc4-b134-b5f6d273e5c5", nombre: "Efectivo", tipo: "efectivo", saldo_calculado: -3708.00, saldo_real: 500.00, frecuencia_revision: "semanal", es_default: true, activa: true, limite_credito: null, dia_corte: null, dia_pago: null },
  { id: "b27c6aee-e438-4b87-b2de-c653595deba5", nombre: "Coinbase Wallet", tipo: "retiro", saldo_calculado: 0.00, saldo_real: 499.00, frecuencia_revision: "trimestral", es_default: false, activa: true, limite_credito: null, dia_corte: null, dia_pago: null },
  { id: "ba5263ef-2295-4fe8-a395-934ffa077e14", nombre: "Invex TDC", tipo: "deuda", saldo_calculado: 0.00, saldo_real: -20155.00, frecuencia_revision: "mensual", es_default: false, activa: true, limite_credito: null, dia_corte: 26, dia_pago: 15 },
  { id: "be3affb9-e9ce-405c-985c-f3c8bc61a831", nombre: "Fintual PPR", tipo: "retiro", saldo_calculado: 0.00, saldo_real: 42204.00, frecuencia_revision: "trimestral", es_default: false, activa: true, limite_credito: null, dia_corte: null, dia_pago: null },
  { id: "cfdd8197-cf79-4ec9-a5b8-c0ddc4d31594", nombre: "CETES Directo", tipo: "retiro", saldo_calculado: 0.00, saldo_real: 20151.00, frecuencia_revision: "trimestral", es_default: false, activa: true, limite_credito: null, dia_corte: null, dia_pago: null },
  { id: "da173b83-8ef4-4c24-97e8-1f11125a0401", nombre: "Klar", tipo: "ingreso", saldo_calculado: -1301.00, saldo_real: 1702.00, frecuencia_revision: "semanal", es_default: false, activa: true, limite_credito: null, dia_corte: null, dia_pago: null },
  { id: "de73bdac-7cdb-4577-b9f6-2c17f9701167", nombre: "Banamex Préstamo personal", tipo: "deuda", saldo_calculado: 3100.00, saldo_real: -33008.00, frecuencia_revision: "mensual", es_default: false, activa: true, limite_credito: null, dia_corte: null, dia_pago: null },
  { id: "e0b0d841-2ad9-4920-b5a3-6d9ae83ab130", nombre: "Banamex TDC Teleton", tipo: "deuda", saldo_calculado: -705.00, saldo_real: -18685.00, frecuencia_revision: "mensual", es_default: false, activa: true, limite_credito: null, dia_corte: 10, dia_pago: 30 },
  { id: "eaf61119-d528-49e1-8354-b18c4af53f4e", nombre: "Afore", tipo: "retiro", saldo_calculado: 0.00, saldo_real: 164168.00, frecuencia_revision: "trimestral", es_default: false, activa: true, limite_credito: null, dia_corte: null, dia_pago: null },
  { id: "f45ebe82-d244-4e26-88ca-294692d3ba32", nombre: "Banamex débito", tipo: "ingreso", saldo_calculado: 0.00, saldo_real: 0.00, frecuencia_revision: "mensual", es_default: false, activa: true, limite_credito: null, dia_corte: null, dia_pago: null },
]

const activas = raw.filter((c) => c.activa === true)

export const CUENTAS = activas
  .map(({ id, nombre, tipo }) => ({ id, nombre, tipo }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre))

export const CUENTA_DEFAULT = (() => {
  const def = raw.find((c) => c.es_default === true)
  return def ? { id: def.id, nombre: def.nombre, tipo: def.tipo } : CUENTAS[0]
})()
