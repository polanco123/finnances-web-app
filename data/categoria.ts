interface Categoria {
  id: string
  nombre: string
  tipo: string
  es_diversion: boolean
  activa: boolean
}

const raw: Categoria[] = [
  { id: "0783f2ac-a181-4753-9584-17c7f0cbdb05", nombre: "Intereses", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "0e93f9d8-8c87-4aa0-b11e-46d80b6a4902", nombre: "Gustos pareja", tipo: "discrecional", es_diversion: false, activa: true },
  { id: "100df484-a63c-4d2d-aa20-1fc4ed68253b", nombre: "Claude / IA", tipo: "suscripcion", es_diversion: false, activa: true },
  { id: "10705f79-ad04-4214-9f2a-d4a56c322d00", nombre: "Microsoft 365", tipo: "suscripcion", es_diversion: false, activa: true },
  { id: "11b68ede-631e-4c56-8ef8-c791ebd8e9d7", nombre: "Renta", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "12d7496b-b8c2-4e6b-b387-205f6f6830d4", nombre: "Tecnología", tipo: "trabajo", es_diversion: false, activa: true },
  { id: "1834f2cf-5bc6-427e-a07e-841e001decef", nombre: "Seguro", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "1b586dbe-3b35-43d7-ab2b-f69c954e5db7", nombre: "Mascotas", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "246a448e-ad05-4c6f-8cbc-0bc5e0d205d2", nombre: "Ropa", tipo: "discrecional", es_diversion: false, activa: true },
  { id: "32151dbb-6732-45a7-befd-9057dc9f935a", nombre: "Transferencia", tipo: "sistema", es_diversion: false, activa: true },
  { id: "33cc6ec7-b41f-4775-9ffa-0576d89ef84d", nombre: "Sueldo", tipo: "ingreso", es_diversion: false, activa: true },
  { id: "343bbab7-1edd-4178-bd2c-629415de04da", nombre: "Hotel / Viaje", tipo: "discrecional", es_diversion: false, activa: true },
  { id: "3a526d10-b498-44f8-a96b-cd253c0c050d", nombre: "Spotify", tipo: "suscripcion", es_diversion: false, activa: true },
  { id: "3b745b8d-b3a0-4c30-aeb4-32bbad880df4", nombre: "Otras suscripciones", tipo: "suscripcion", es_diversion: false, activa: true },
  { id: "40ee3a6e-529b-4da6-8fbd-7bb2eb7d8898", nombre: "Despensa", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "41ee404c-a40b-4442-99d9-57fc6e5183c2", nombre: "Autopista", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "4aafe697-17e7-407d-83f0-576de9745f18", nombre: "Disney+", tipo: "suscripcion", es_diversion: false, activa: true },
  { id: "4e5a6691-898e-4764-851e-345b5c5f284f", nombre: "Electrodomésticos", tipo: "hogar", es_diversion: false, activa: true },
  { id: "575ef6b7-e644-4475-9726-20b578c3190c", nombre: "Mercancía", tipo: "hogar", es_diversion: false, activa: true },
  { id: "59944eed-cbae-4294-bbcc-cfd5e78b4b8a", nombre: "Familia", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "6e77584c-2cc2-4e0d-aa80-3716f8d5aa96", nombre: "Agua", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "703de664-b36b-45d3-ac59-cbbcf9f1703f", nombre: "Transporte", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "719c68ee-5177-4fde-9797-19e74ba1ba5f", nombre: "Personales", tipo: "discrecional", es_diversion: false, activa: true },
  { id: "72287606-6f4c-4bd5-9a2c-b0183b119393", nombre: "Casa — Mantenimiento", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "7b91b747-0d0e-4df2-bd52-a3f17c194aeb", nombre: "Educación", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "7c033aae-42f8-447d-b623-26f77ddb3d8c", nombre: "Internet", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "86dcdaca-684e-40f1-a3af-14331d7f2750", nombre: "Cashback / Puntos", tipo: "ingreso", es_diversion: false, activa: true },
  { id: "89e8ab6a-c0a9-4a51-b941-a615a0d955b5", nombre: "Pago recibido", tipo: "ingreso", es_diversion: false, activa: true },
  { id: "9492849e-08d1-4b13-bb70-8e24cacbf04b", nombre: "Golosinas", tipo: "discrecional", es_diversion: false, activa: true },
  { id: "97503133-b1a1-4dbe-92ab-1f0770e925fc", nombre: "Luz", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "99f63c53-a7b3-4e99-a763-0d785849b70d", nombre: "Amazon Prime", tipo: "suscripcion", es_diversion: false, activa: true },
  { id: "9bc80a1d-639c-4b77-abfc-ab1738017165", nombre: "Ventas", tipo: "ingreso", es_diversion: false, activa: true },
  { id: "a5c00a5b-9933-4bc5-85f7-bd1076d9a667", nombre: "Préstamo / Crédito", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "a7a5128b-e347-4401-b9c6-81fe14ade9d2", nombre: "Coche", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "af6b676c-04db-4fda-b9f7-349123d75e1a", nombre: "Diversión personal", tipo: "discrecional", es_diversion: true, activa: true },
  { id: "b9dfa136-b309-4333-a6eb-0cf23b9a31db", nombre: "Trabajo", tipo: "trabajo", es_diversion: false, activa: true },
  { id: "c0139d5b-23ee-4452-95f4-5126c03547ee", nombre: "Gasolina", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "c124cb8e-e5a9-48b4-9e99-6393258c5603", nombre: "Artículos hogar", tipo: "hogar", es_diversion: false, activa: true },
  { id: "c12b579c-c1f3-4da8-9f8e-e91864fb9d66", nombre: "Salud", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "c420fc73-4e8f-4824-8dab-8e26bab5e8ec", nombre: "Ajuste", tipo: "sistema", es_diversion: false, activa: true },
  { id: "cb0f8e0f-697e-46b0-9a8b-2a4518b8dfaa", nombre: "Comida / Bebidas", tipo: "discrecional", es_diversion: false, activa: true },
  { id: "cc0b48b4-ea3c-4b02-8a8e-5ea72ee8209b", nombre: "Rendimientos", tipo: "ingreso", es_diversion: false, activa: true },
  { id: "cd570628-8b76-409c-9e8b-358fa849a2d1", nombre: "Recargas", tipo: "compromiso", es_diversion: false, activa: true },
  { id: "cddffe30-fe99-489e-8bf9-f798db1ff540", nombre: "Restaurante", tipo: "discrecional", es_diversion: false, activa: true },
  { id: "d439e9ac-3725-4587-ab7e-573947f27b9e", nombre: "Netflix", tipo: "suscripcion", es_diversion: false, activa: true },
  { id: "dd83069f-4172-4289-8003-b092557ff3c3", nombre: "Gas", tipo: "compromiso", es_diversion: false, activa: true },
]

export const CATEGORIAS = raw
  .map(({ id, nombre, tipo, es_diversion }) => ({ id, nombre, tipo, es_diversion }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre))

export const CATEGORIA_DEFAULT = CATEGORIAS[0]

export const GASTO_TIPOS = ['compromiso', 'discrecional', 'suscripcion', 'trabajo', 'hogar'] as const

export function esCategoriaDeGasto(tipo: string): boolean {
  return (GASTO_TIPOS as readonly string[]).includes(tipo)
}
