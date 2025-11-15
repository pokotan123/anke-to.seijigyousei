const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // パスエイリアスの設定
    const srcPath = path.resolve(__dirname, 'src');
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': srcPath,
    };
    
    // モジュール解決の設定
    config.resolve.modules = [
      path.resolve(__dirname, 'src'),
      path.resolve(__dirname, 'node_modules'),
      'node_modules',
    ];
    
    return config;
  },
}

module.exports = nextConfig

