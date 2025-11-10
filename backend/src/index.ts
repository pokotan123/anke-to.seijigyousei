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
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// エラーハンドリング
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    await connectDatabase();
    await connectRedis();
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { io };

