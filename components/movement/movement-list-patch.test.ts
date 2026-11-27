import { describe, expect, it } from 'vitest'
import {
  appendNewRows,
  compareMovimiento,
  insertSorted,
  removeByIds,
  replaceRows,
} from './movement-list-patch'
import type { Movimiento, MovimientoCursor } from './movement-service'

const row = (id: string, over: Partial<Movimiento> = {}): Movimiento => ({
  id,
  monto: -10,
  fecha: '2026-11-10',
  hora: '12:00:00',
  cuenta_id: 'A',
  categoria_id: 'c',
  created_at: '2026-11-10T12:00:00Z',
  ...over,
})

const ids = (rows: Movimiento[]) => rows.map((r) => r.id)

describe('compareMovimiento (fecha desc, hora desc nulls last, created_at desc, id desc)', () => {
  it('sorts later fecha first', () => {
    expect(compareMovimiento(row('a', { fecha: '2026-11-11' }), row('b'))).toBeLessThan(0)
    expect(compareMovimiento(row('a'), row('b', { fecha: '2026-11-11' }))).toBeGreaterThan(0)
  })

  it('sorts later hora first within the same fecha', () => {
    expect(compareMovimiento(row('a', { hora: '13:00:00' }), row('b'))).toBeLessThan(0)
  })

  it('places null hora after non-null hora', () => {
    expect(compareMovimiento(row('a', { hora: null }), row('b'))).toBeGreaterThan(0)
    expect(compareMovimiento(row('a'), row('b', { hora: null }))).toBeLessThan(0)
  })

  it('falls back to created_at desc then id desc', () => {
    expect(
      compareMovimiento(row('a', { created_at: '2026-11-10T12:00:05Z' }), row('b')),
    ).toBeLessThan(0)
    expect(compareMovimiento(row('b'), row('a'))).toBeLessThan(0)
    expect(compareMovimiento(row('a'), row('a'))).toBe(0)
  })
})

describe('removeByIds', () => {
  it('removes only the given ids and keeps order', () => {
    const rows = [row('1'), row('2'), row('3')]
    expect(ids(removeByIds(rows, ['1', '3']))).toEqual(['2'])
  })

  it('returns equal content when no id matches', () => {
    const rows = [row('1'), row('2')]
    expect(ids(removeByIds(rows, ['9']))).toEqual(['1', '2'])
  })
})

describe('replaceRows', () => {
  it('replaces by id in place keeping order', () => {
    const rows = [row('1'), row('2'), row('3')]
    const out = replaceRows(rows, [row('2', { monto: -99 })])
    expect(ids(out)).toEqual(['1', '2', '3'])
    expect(out[1].monto).toBe(-99)
    expect(out[0].monto).toBe(-10)
  })

  it('replaces both legs and ignores unknown ids', () => {
    const rows = [row('1'), row('2')]
    const out = replaceRows(rows, [row('1', { monto: -1 }), row('2', { monto: 1 }), row('zz')])
    expect(out.map((r) => r.monto)).toEqual([-1, 1])
    expect(out).toHaveLength(2)
  })
})

describe('insertSorted', () => {
  const page = [
    row('a', { fecha: '2026-11-12' }),
    row('b', { fecha: '2026-11-11' }),
    row('c', { fecha: '2026-11-10', hora: '12:00:00' }),
    row('d', { fecha: '2026-11-10', hora: null }),
  ]
  const noMore = { cursor: null, hasMore: false }

  it('inserts at the position given by the query order', () => {
    const out = insertSorted(page, [row('x', { fecha: '2026-11-11', created_at: '2026-11-11T00:00:00Z' })], noMore)
    expect(ids(out)).toEqual(['a', 'x', 'b', 'c', 'd'])
  })

  it('inserts a newest row at the top', () => {
    const out = insertSorted(page, [row('x', { fecha: '2026-11-13' })], noMore)
    expect(ids(out)).toEqual(['x', 'a', 'b', 'c', 'd'])
  })

  it('places a non-null hora before a null hora on the same fecha', () => {
    const out = insertSorted(page, [row('x', { fecha: '2026-11-10', hora: '09:00:00' })], noMore)
    expect(ids(out)).toEqual(['a', 'b', 'c', 'x', 'd'])
  })

  it('places a null-hora row after non-null rows of the same fecha', () => {
    const out = insertSorted(page, [row('x', { fecha: '2026-11-10', hora: null, created_at: '2026-11-10T13:00:00Z' })], noMore)
    expect(ids(out)).toEqual(['a', 'b', 'c', 'x', 'd'])
  })

  it('inserts both legs of a transfer', () => {
    const out = insertSorted(
      page,
      [row('x1', { fecha: '2026-11-13' }), row('x2', { fecha: '2026-11-13', id: 'x2' })],
      noMore,
    )
    expect(ids(out)).toEqual(['x2', 'x1', 'a', 'b', 'c', 'd'])
  })

  const cursor: MovimientoCursor = {
    fecha: '2026-11-10',
    hora: null,
    createdAt: '2026-11-10T12:00:00Z',
    id: 'd',
  }

  it('skips rows past the cursor when more pages exist', () => {
    const out = insertSorted(page, [row('old', { fecha: '2026-11-01' })], { cursor, hasMore: true })
    expect(ids(out)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('appends rows past the end when there are no more pages', () => {
    const out = insertSorted(page, [row('old', { fecha: '2026-11-01' })], { cursor: null, hasMore: false })
    expect(ids(out)).toEqual(['a', 'b', 'c', 'd', 'old'])
  })

  it('re-inserts the cursor row itself (restored last item) even when hasMore', () => {
    const without = page.slice(0, 3)
    const out = insertSorted(without, [row('d', { fecha: '2026-11-10', hora: null })], { cursor, hasMore: true })
    expect(ids(out)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('does not duplicate a row that is already present', () => {
    const out = insertSorted(page, [row('b', { fecha: '2026-11-11' })], noMore)
    expect(ids(out)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('appendNewRows', () => {
  it('appends rows that are not in the list yet, keeping page order', () => {
    const out = appendNewRows([row('a'), row('b')], [row('c'), row('d')])
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('skips ids already present (overlap, restored or patched rows)', () => {
    const out = appendNewRows([row('a'), row('b')], [row('b'), row('c')])
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('keeps the list row (patched value) over the fetched duplicate', () => {
    const patched = row('b', { monto: -999 })
    const out = appendNewRows([row('a'), patched], [row('b')])
    expect(out[1]).toBe(patched)
  })
})
