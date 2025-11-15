import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Railway環境変数の確認
// Railwayでは、Redisサービスを追加すると自動的にREDIS_URLが設定されます
// バックエンドサービスで、${{Redis.REDIS_URL}}として参照する必要があります
// または、REDIS_HOST + REDIS_PORT + REDIS_PASSWORD の組み合わせでも設定可能
const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT || '6379';
const redisPassword = process.env.REDIS_PASSWORD;

// Redis接続URLを構築
let finalRedisUrl: string | null = null;

if (redisUrl) {
  // REDIS_URLが設定されている場合（推奨）
  finalRedisUrl = redisUrl;
} else if (redisHost) {
  // REDIS_HOSTが設定されている場合、URLを構築
  if (redisPassword) {
    finalRedisUrl = `redis://:${redisPassword}@${redisHost}:${redisPort}`;
  } else {
    finalRedisUrl = `redis://${redisHost}:${redisPort}`;
  }
}

if (!finalRedisUrl) {
  console.error('❌ Redis接続情報が設定されていません！');
  console.error('');
  console.error('📋 Railwayでの設定方法:');
  console.error('  1. Redisサービスを追加（まだの場合）');
  console.error('     「New」→「Database」→「Add Redis」をクリック');
  console.error('');
  console.error('  2. バックエンドサービスの「Variables」タブを開く');
  console.error('');
  console.error('  3. 以下のいずれかの方法で環境変数を設定:');
  console.error('');
  console.error('     【方法1】REDIS_URLを使用（推奨）:');
  console.error('       Name: REDIS_URL');
  console.error('       Value: ${{Redis.REDIS_URL}}');
  console.error('       ※「Redis」の部分は、実際のサービス名に置き換えてください');
  console.error('');
  console.error('     【方法2】個別の環境変数を使用:');
  console.error('       Name: REDIS_HOST');
  console.error('       Value: ${{Redis.REDIS_HOST}}');
  console.error('       Name: REDIS_PORT');
  console.error('       Value: ${{Redis.REDIS_PORT}}');
  console.error('       Name: REDIS_PASSWORD（必要な場合）');
  console.error('       Value: ${{Redis.REDIS_PASSWORD}}');
  console.error('');
  console.error('  4. 環境変数を設定後、サービスを再デプロイしてください');
  console.error('');
  console.error('⚠️  Redis接続をスキップします。Redis機能は動作しません。');
}

// Redisクライアントは、接続URLが設定されている場合のみ作成
let redisClient: ReturnType<typeof createClient> | null = null;

if (finalRedisUrl) {
  redisClient = createClient({
    url: finalRedisUrl,
  });

  redisClient.on('error', (err) => {
    console.error('❌ Redis Client Error:', err);
  });
}

export async function connectRedis() {
  if (!finalRedisUrl || !redisClient) {
    console.warn('⚠️  REDIS_URLまたはREDIS_HOSTが設定されていないため、Redis接続をスキップします');
    return null;
  }

  try {
    // デバッグ情報
    // パスワードをマスクして表示
    const maskedUrl = finalRedisUrl.replace(/:[^:@]+@/, ':****@');
    console.log('🔗 Attempting to connect to Redis:', maskedUrl);

    await redisClient.connect();
    console.log('✅ Redis connected successfully');
    return redisClient;
  } catch (error: any) {
    console.error('❌ Redis connection error:', error);
    console.error('');
    console.error('🔍 Debug information:');
    console.error('  REDIS_URL:', process.env.REDIS_URL ? 'Set (length: ' + process.env.REDIS_URL.length + ')' : 'NOT SET');
    console.error('  REDIS_HOST:', process.env.REDIS_HOST || 'NOT SET');
    console.error('  REDIS_PORT:', process.env.REDIS_PORT || 'NOT SET (default: 6379)');
    console.error('  REDIS_PASSWORD:', process.env.REDIS_PASSWORD ? 'Set' : 'NOT SET');
    console.error('  NODE_ENV:', process.env.NODE_ENV || 'not set');
    console.error('');
    console.error('💡 Railwayでの設定確認:');
    console.error('  1. バックエンドサービスの「Variables」タブを確認');
    console.error('  2. REDIS_URLまたはREDIS_HOSTが設定されているか確認');
    console.error('  3. 値が ${{Redis.REDIS_URL}} または ${{Redis.REDIS_HOST}} の形式か確認');
    console.error('  4. Redisサービスの名前が正確か確認');
    console.error('  5. Redisサービスが起動しているか確認（緑色のインジケーター）');
    throw error;
  }
}

export { redisClient };

