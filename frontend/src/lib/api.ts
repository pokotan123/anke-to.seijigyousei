import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// リクエストインターセプター（トークン追加）
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// レスポンスインターセプター（エラーハンドリング）
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// 認証API
export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// アンケートAPI
export const surveyAPI = {
  getByToken: async (token: string) => {
    const response = await api.get(`/surveys/token/${token}`);
    return response.data;
  },
  list: async () => {
    const response = await api.get('/surveys');
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/surveys/${id}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/surveys', data);
    return response.data;
  },
  update: async (id: number, data: any) => {
    const response = await api.put(`/surveys/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/surveys/${id}`);
    return response.data;
  },
  regenerateToken: async (id: number) => {
    const response = await api.post(`/surveys/${id}/regenerate-token`);
    return response.data;
  },
};

// 質問API
export const questionAPI = {
  list: async (surveyId: number) => {
    const response = await api.get(`/questions?survey_id=${surveyId}`);
    return response.data;
  },
  get: async (id: number) => {
    const response = await api.get(`/questions/${id}`);
    return response.data;
  },
  create: async (data: any) => {
    const response = await api.post('/questions', data);
    return response.data;
  },
  update: async (id: number, data: any) => {
    const response = await api.put(`/questions/${id}`, data);
    return response.data;
  },
  delete: async (id: number) => {
    const response = await api.delete(`/questions/${id}`);
    return response.data;
  },
  createOption: async (questionId: number, data: any) => {
    const response = await api.post(`/questions/${questionId}/options`, data);
    return response.data;
  },
  updateOption: async (optionId: number, data: any) => {
    const response = await api.put(`/questions/options/${optionId}`, data);
    return response.data;
  },
  deleteOption: async (optionId: number) => {
    const response = await api.delete(`/questions/options/${optionId}`);
    return response.data;
  },
};

// 投票API
export const voteAPI = {
  submit: async (data: any, sessionId: string) => {
    const response = await api.post('/votes', data, {
      headers: {
        'X-Session-Id': sessionId,
      },
    });
    return response.data;
  },
  list: async (
    surveyId: number,
    limit?: number,
    offset?: number,
    filters?: {
      questionId?: number;
      search?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) => {
    const params = new URLSearchParams({ survey_id: surveyId.toString() });
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    if (filters?.questionId) params.append('question_id', filters.questionId.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.dateFrom) params.append('date_from', filters.dateFrom);
    if (filters?.dateTo) params.append('date_to', filters.dateTo);
    const response = await api.get(`/votes?${params.toString()}`);
    return response.data;
  },
};

// 分析API
export const analyticsAPI = {
  getRealtime: async (surveyId: number) => {
    const response = await api.get(`/admin/analytics/realtime?survey_id=${surveyId}`);
    return response.data;
  },
  getAggregate: async (surveyId: number, questionId?: number, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams({ survey_id: surveyId.toString() });
    if (questionId) params.append('question_id', questionId.toString());
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const response = await api.get(`/admin/analytics/aggregate?${params.toString()}`);
    return response.data;
  },
  getCrosstab: async (questionId1: number, questionId2: number) => {
    const response = await api.get(
      `/admin/analytics/crosstab?question_id1=${questionId1}&question_id2=${questionId2}`
    );
    return response.data;
  },
  getHeatmap: async (surveyId: number, questionId: number) => {
    const response = await api.get(
      `/admin/analytics/heatmap?survey_id=${surveyId}&question_id=${questionId}`
    );
    return response.data;
  },
};

