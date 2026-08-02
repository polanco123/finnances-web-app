import { JetBrains_Mono, Inter } from 'next/font/google'

// Scoped locally to the Patrimonio page's component tree only — deliberately
// NOT added to app/layout.tsx, which stays on Geist for the rest of the app.
export const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains-mono',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

export const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})
