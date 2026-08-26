export interface IconColorOption {
  name: string
  /** `null` means "use the default gray" — persisted as `color: null`. */
  value: string | null
}

export const ICON_COLORS: IconColorOption[] = [
  { name: 'Gris (predeterminado)', value: null },
  { name: 'Rojo', value: '#ef4444' },
  { name: 'Naranja', value: '#f97316' },
  { name: 'Ámbar', value: '#eab308' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Turquesa', value: '#14b8a6' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Índigo', value: '#6366f1' },
  { name: 'Violeta', value: '#a855f7' },
  { name: 'Rosa', value: '#ec4899' },
]

/** Swatch background for the default (`null`) option — matches the app's
 * existing muted icon gray so the tile previews accurately. */
export const ICON_COLOR_DEFAULT_SWATCH = '#9aa0b0'

/** Every icon render site calls this instead of reimplementing the
 * null-means-default fallback: returns `undefined` (inherit CSS) for the
 * default gray, or the stored custom color otherwise. */
export function resolveIconColor(color: string | null | undefined): string | undefined {
  return color ?? undefined
}
