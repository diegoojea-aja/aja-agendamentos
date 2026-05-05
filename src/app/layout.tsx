import type { Metadata } from 'next'
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'AJA Forms',
  description: 'Formulários da AJA, em um só lugar.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${instrumentSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col font-sans">
        {children}
      </body>
    </html>
  )
}
