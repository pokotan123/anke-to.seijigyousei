import { Server, Socket } from 'socket.io';
import { VoteModel } from './models/Vote';
import { redisClient } from './database/redis';

export function setupSocketIO(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // アンケートのリアルタイム更新を購読
    socket.on('subscribe:survey', async (surveyId: number) => {
      socket.join(`survey:${surveyId}`);
      console.log(`Client ${socket.id} subscribed to survey ${surveyId}`);

      // 初期データを送信
      try {
        const cacheKey = `analytics:survey:${surveyId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          socket.emit('survey:data', JSON.parse(cached));
        }
      } catch (error) {
        console.error('Error sending initial data:', error);
      }
    });

    // アンケートの購読解除
    socket.on('unsubscribe:survey', (surveyId: number) => {
      socket.leave(`survey:${surveyId}`);
      console.log(`Client ${socket.id} unsubscribed from survey ${surveyId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
}

// 投票が作成されたときにリアルタイム更新をブロードキャストする関数
export async function broadcastVoteUpdate(io: Server, surveyId: number, questionId: number) {
  try {
    // 集計データを再計算
    const aggregate = await VoteModel.getAggregateByQuestion(questionId);
    const totalVotes = await VoteModel.getTotalCount(surveyId);

    // キャッシュを無効化
    await redisClient.del(`analytics:survey:${surveyId}`);

    // 購読しているクライアントに送信
    io.to(`survey:${surveyId}`).emit('survey:update', {
      question_id: questionId,
      aggregate,
      total_votes: totalVotes,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Error broadcasting vote update:', error);
  }
}

