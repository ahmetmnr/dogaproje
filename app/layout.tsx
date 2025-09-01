import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'DOĞA - Sıfır Atık Sesli Bilgi Yarışması',
  description: 'Emine Erdoğan Hanımefendi himayelerinde Sıfır Atık Projesi sesli bilgi yarışması. Çevre bilincini artıran eğlenceli ve öğretici deneyim.',
  keywords: 'sıfır atık, çevre, geri dönüşüm, emine erdoğan, bilgi yarışması, doğa',
  authors: [{ name: 'DOĞA Projesi' }],
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌿</text></svg>" />
      </head>
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-emerald-50">
          {children}
        </div>
      </body>
    </html>
  )
}

