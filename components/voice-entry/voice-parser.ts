import { CUENTAS, CATEGORIAS } from '@/lib/catalogs/catalog-store'
import { matchCatalogItem } from './voice-catalog-match'

export type Tipo = 'gasto' | 'ingreso' | 'transferencia'

export interface ParsedMovimiento {
  tipo: Tipo
  cantidad: number | null
  cuentaId: string | null
  cuentaOrigenId: string | null
  cuentaDestinoId: string | null
  categoriaId: string | null
  notas: string | null
  unmatchedCuentaText?: string
  unmatchedCategoriaText?: string
}

export class VoiceParseError extends Error {
  constructor(public reason: 'no-trigger-word' | 'no-cantidad') { super(reason) }
}

const TRIGGER_RE = /^\s*registra\s+/i
const TIPO_PATTERNS: Array<{ tipo: Tipo; re: RegExp }> = [
  { tipo: 'transferencia', re: /\btransferencia\b/i },
  { tipo: 'ingreso', re: /\bingreso\b/i },
  { tipo: 'gasto', re: /\bgasto\b/i },
]
const NOTAS_RE = /\s*(?:y\s+)?en\s+notas\s+escribe\s+(.+)$/i
const CANTIDAD_WITH_DE_RE = /\bde\s+(\d+(?:\.\d+)?)\b(?:\s+pesos?\b)?/i
const CANTIDAD_BARE_RE = /\b(\d+(?:\.\d+)?)\b(?:\s+pesos?\b)?/i
const CUENTA_CATEGORIA_RE = /\ben\s+(.+?)\s+de\s+(.+)$/i
const CATEGORIA_ONLY_RE = /\bde\s+(.+)$/i
const ORIGEN_DESTINO_RE = /\bde\s+(.+?)\s+a\s+(.+)$/i

const collapse = (s: string) => s.trim().replace(/\s+/g, ' ')

export function parseVoiceCommand(transcript: string): ParsedMovimiento {
  if (!TRIGGER_RE.test(transcript)) throw new VoiceParseError('no-trigger-word')
  let working = transcript.replace(TRIGGER_RE, '').trim()

  let tipo: Tipo = 'gasto'
  for (const { tipo: t, re } of TIPO_PATTERNS) {
    if (re.test(working)) {
      tipo = t
      working = collapse(working.replace(new RegExp(`\\b(?:(?:un|una)\\s+)?${t}\\b`, 'i'), ''))
      break
    }
  }

  let notas: string | null = null
  const notasMatch = working.match(NOTAS_RE)
  if (notasMatch?.index !== undefined) {
    notas = notasMatch[1].trim()
    working = working.slice(0, notasMatch.index).trim()
  }

  const cantMatch = working.match(CANTIDAD_WITH_DE_RE) ?? working.match(CANTIDAD_BARE_RE)
  if (!cantMatch || cantMatch.index === undefined) throw new VoiceParseError('no-cantidad')
  const cantidad = Number(cantMatch[1])
  working = collapse(working.slice(0, cantMatch.index) + working.slice(cantMatch.index + cantMatch[0].length))

  if (tipo === 'transferencia') {
    const m = working.match(ORIGEN_DESTINO_RE)
    const origenText = m?.[1]?.trim() ?? null
    const destinoText = m?.[2]?.trim() ?? null
    const origen = origenText ? matchCatalogItem(origenText, CUENTAS) : null
    const destino = destinoText ? matchCatalogItem(destinoText, CUENTAS) : null
    return {
      tipo, cantidad, cuentaId: null,
      cuentaOrigenId: origen?.id ?? null,
      cuentaDestinoId: destino?.id ?? null,
      categoriaId: null, notas,
      unmatchedCuentaText: (origenText && !origen) || (destinoText && !destino)
        ? (origenText && !origen ? origenText : destinoText!) : undefined,
    }
  }

  let cuentaText: string | null = null
  let categoriaText: string | null = null
  const both = working.match(CUENTA_CATEGORIA_RE)
  if (both) { cuentaText = both[1].trim(); categoriaText = both[2].trim() }
  else { const c = working.match(CATEGORIA_ONLY_RE); if (c) categoriaText = c[1].trim() }

  const cuenta = cuentaText ? matchCatalogItem(cuentaText, CUENTAS) : null
  const categoria = categoriaText ? matchCatalogItem(categoriaText, CATEGORIAS) : null

  return {
    tipo, cantidad,
    cuentaId: cuenta?.id ?? null,
    cuentaOrigenId: null, cuentaDestinoId: null,
    categoriaId: categoria?.id ?? null,
    notas,
    unmatchedCuentaText: cuentaText && !cuenta ? cuentaText : undefined,
    unmatchedCategoriaText: categoriaText && !categoria ? categoriaText : undefined,
  }
}
