import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          アンケート・投票システム
        </h1>
        <p className="text-gray-600 mb-8">
          リアルタイム可視化対応のWebアプリケーション
        </p>
        <div className="space-x-4">
          <Link
            href="/admin/login"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            管理画面へ
          </Link>
        </div>
      </div>
    </main>
  )
}

