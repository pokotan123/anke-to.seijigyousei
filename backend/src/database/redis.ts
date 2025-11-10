import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Railway環境変数の確認
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.warn('⚠️  REDIS_URL environment variable is not set!');
  console.warn('Redis features may not work correctly.');
}

const redisClient = createClient({
  url: redisUrl || 'redis://localhost:6379',
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error:', err);
});

export async function connectRedis() {
  try {
    await redisClient.connect();
    console.log('✅ Redis connected');
    return redisClient;
  } catch (error) {
    console.error('❌ Redis connection error:', error);
    throw error;
  }
}

export { redisClient };

