import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { voteRateLimit, apiRateLimit } from './middleware/security';

import { connectDatabase } from './database/connection';
import { connectRedis } from './database/redis';
import authRoutes from './routes/auth';
import surveyRoutes from './routes/surveys';
import questionRoutes from './routes/questions';
import voteRoutes from './routes/votes';
import analyticsRoutes from './routes/analytics';
import { setupSocketIO } from './socket';
import { setIO } from './routes/votes';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

// 環境変数の確認
console.log('🔍 Environment check:');
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? `✅ Set (${process.env.DATABASE_URL.substring(0, 30)}...)` : '❌ Not set');
console.log('  POSTGRES_URL:', process.env.POSTGRES_URL ? '✅ Set' : '❌ Not set');
console.log('  POSTGRES_CONNECTION_STRING:', process.env.POSTGRES_CONNECTION_STRING ? '✅ Set' : '❌ Not set');
console.log('  REDIS_URL:', process.env.REDIS_URL ? '✅ Set' : '❌ Not set');
console.log('  JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Not set');
console.log('  FRONTEND_URL:', process.env.FRONTEND_URL || 'http://localhost:3000');
console.log('  NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('');
if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL && !process.env.POSTGRES_CONNECTION_STRING) {
  console.error('⚠️  WARNING: No database connection string found!');
  console.error('   Please set DATABASE_URL in Railway environment variables.');
  console.error('   Format: DATABASE_URL=${{PostgreSQL.DATABASE_URL}}');
}

// ミドルウェア
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// レート制限
app.use('/api/v1/votes', voteRateLimit);
app.use('/api/', apiRateLimit);

// ルーティング
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/surveys', surveyRoutes);
app.use('/api/v1/questions', questionRoutes);
app.use('/api/v1/votes', voteRoutes);
app.use('/api/v1/admin/analytics', analyticsRoutes);

// Socket.io設定
setupSocketIO(io);
setIO(io);

// ヘルスチェック
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'configured' : 'not configured',
    redis: process.env.REDIS_URL ? 'configured' : 'not configured',
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
    await connectRedis();
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    console.error('\n💡 Troubleshooting:');
    console.error('  1. Check if DATABASE_URL is set in Railway environment variables');
    console.error('  2. Check if REDIS_URL is set in Railway environment variables');
    console.error('  3. Ensure PostgreSQL and Redis services are running in Railway');
    console.error('  4. Verify service names match in environment variable references');
    process.exit(1);
  }
}

startServer();

export { io };
