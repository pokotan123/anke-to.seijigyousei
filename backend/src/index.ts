import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { voteRateLimit } from './middleware/security';

import { connectDatabase } from './database/connection';
import { connectRedis } from './database/redis';
import authRoutes from './routes/auth';
import surveyRoutes from './routes/surveys';
import questionRoutes from './routes/questions';
import voteRoutes from './routes/votes';
import analyticsRoutes from './routes/analytics';
import voterRoutes from './routes/voters';
import { setupSocketIO } from './socket';
import { setIO } from './routes/votes';

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);
// CORS用のオリジンリスト（FRONTEND_URLはカンマ区切りで複数指定可）
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(url => url.trim());

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

// 環境変数の確認
console.log('🔍 Environment check:');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? `✅ Set (${process.env.DATABASE_URL.substring(0, 30)}...)` : '❌ Not set');
console.log('  POSTGRES_URL:', process.env.POSTGRES_URL ? '✅ Set' : '❌ Not set');
console.log('  POSTGRES_CONNECTION_STRING:', process.env.POSTGRES_CONNECTION_STRING ? '✅ Set' : '❌ Not set');
console.log('  REDIS_URL:', process.env.REDIS_URL ? `✅ Set (${process.env.REDIS_URL.substring(0, 30)}...)` : '❌ Not set');
console.log('  REDIS_HOST:', process.env.REDIS_HOST || '❌ Not set');
console.log('  REDIS_PORT:', process.env.REDIS_PORT || '❌ Not set (default: 6379)');
console.log('  REDIS_PASSWORD:', process.env.REDIS_PASSWORD ? '✅ Set' : '❌ Not set');
console.log('  JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Not set');
console.log('  FRONTEND_URL:', process.env.FRONTEND_URL || 'http://localhost:3000');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('');
if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.POSTGRES_CONNECTION_STRING) {
  console.error('⚠️  WARNING: No database connection string found!');
  console.error('   Please set DATABASE_URL in Railway environment variables.');
  console.error('   Format: DATABASE_URL=${{PostgreSQL.DATABASE_URL}}');
}
if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
  console.error('⚠️  WARNING: Redis connection information is not set!');
  console.error('   Please set REDIS_URL or REDIS_HOST in Railway environment variables.');
  console.error('   Format: REDIS_URL=${{Redis.REDIS_URL}}');
  console.error('   Or: REDIS_HOST=${{Redis.REDIS_HOST}}, REDIS_PORT=${{Redis.REDIS_PORT}}');
  console.error('   Note: Redis features will not work without this variable.');
}

// ミドルウェア
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// レート制限
app.use('/api/v1/votes', voteRateLimit);

// ルーティング
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/surveys', surveyRoutes);
app.use('/api/v1/questions', questionRoutes);
app.use('/api/v1/votes', voteRoutes);
app.use('/api/v1/admin/analytics', analyticsRoutes);
app.use('/api/v1/voters', voterRoutes);

// Socket.io設定
setupSocketIO(io);
setIO(io);

// ルートパス: API情報を返す
app.get('/', (_req, res) => {
  res.json({
    name: 'アンケート・投票システム API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: {
        auth: '/api/v1/auth',
        surveys: '/api/v1/surveys',
        questions: '/api/v1/questions',
        votes: '/api/v1/votes',
        analytics: '/api/v1/admin/analytics',
        voters: '/api/v1/voters',
      },
    },
    documentation: 'This is the backend API server. Please use the frontend application to access the system.',
  });
});

// ヘルスチェック
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    redis: process.env.REDIS_URL || process.env.REDIS_HOST ? 'configured' : 'not configured',
  });
});

// エラーハンドリング
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});

// サーバー起動
async function startServer() {
  try {
    console.log('🔌 Connecting to database...');
    await connectDatabase();
    
    console.log('🔌 Connecting to Redis...');
    const redis = await connectRedis();
    if (!redis) {
      console.warn('⚠️  Server will start without Redis. Some features may not work.');
    }
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    console.error('\n💡 Troubleshooting:');
    console.error('  1. Check if DATABASE_URL is set in Railway environment variables');
    console.error('     Format: DATABASE_URL=${{PostgreSQL.DATABASE_URL}}');
    console.error('  2. Check if REDIS_URL is set in Railway environment variables');
    console.error('     Format: REDIS_URL=${{Redis.REDIS_URL}}');
    console.error('  3. Ensure PostgreSQL and Redis services are running in Railway');
    console.error('  4. Verify service names match in environment variable references');
    console.error('  5. Check that services are started (green indicator)');
    process.exit(1);
  }
}

startServer();

export { io };
