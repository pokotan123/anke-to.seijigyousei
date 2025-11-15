const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // 現在のディレクトリを取得（Vercel環境でも正しく動作するように）
    const currentDir = process.cwd();
    const srcPath = path.resolve(currentDir, 'src');
    
    // パスエイリアスの設定
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': srcPath,
    };
    
    // モジュール解決の設定
    if (!config.resolve.modules) {
      config.resolve.modules = [];
    }
    config.resolve.modules = [
      ...config.resolve.modules,
      path.resolve(currentDir, 'src'),
      path.resolve(currentDir, 'node_modules'),
    ];
    
    return config;
  },
}

module.exports = nextConfig

