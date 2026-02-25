import type { Metadata } from 'next'
import { Noto_Sans_JP } from 'next/font/google'
import './globals.css'

const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'アンケート・投票システム',
  description: 'リアルタイム可視化対応のアンケートシステム',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className={`${notoSansJP.className} antialiased bg-gray-50 text-slate-800`}>
        {children}
      </body>
    </html>
  )
}
