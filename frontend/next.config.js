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
    // Vercelでは、Root Directoryがfrontendに設定されているため、process.cwd()はfrontendディレクトリを指す
    const currentDir = process.cwd();
    const srcPath = path.resolve(currentDir, 'src');
    
    // パスエイリアスの設定
    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }
    config.resolve.alias['@'] = srcPath;
    
    // モジュール解決の設定を追加
    if (!config.resolve.modules) {
      config.resolve.modules = [];
    }
    // 既存のmodulesを保持しつつ、srcディレクトリを追加
    const existingModules = Array.isArray(config.resolve.modules) 
      ? config.resolve.modules 
      : [config.resolve.modules].filter(Boolean);
    
    config.resolve.modules = [
      srcPath,
      ...existingModules,
      path.resolve(currentDir, 'node_modules'),
      'node_modules',
    ];
    
    return config;
  },
}

module.exports = nextConfig

