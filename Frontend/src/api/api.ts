import axios, { AxiosError } from 'axios';
import type { Meeting, MeetingListItem } from '../types/meeting';
import type { QueryResponse } from '../types/summary';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('amm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('amm_token');
      localStorage.removeItem('amm_user');
    }
    return Promise.reject(error);
  }
);

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}
export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
    return data;
  },

  signup: async (name: string, email: string, password: string) => {
    const { data } = await api.post<AuthResponse>('/auth/signup', { name, email, password });
    return data;
  },

  me: async () => {
    const { data } = await api.get<{ user: AuthUser }>('/auth/me');
    return data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // logout should never block the UI — token is cleared client-side regardless
    }
  },
};

export const meetingApi = {
  // GET /api/meetings — list view, no rawTranscript
  getAll: async () => {
    const { data } = await api.get<MeetingListItem[]>('/meetings');
    return data;
  },

  // GET /api/meetings/:id — full document
  getById: async (id: string) => {
    const { data } = await api.get<Meeting>(`/meetings/${id}`);
    return data;
  },
};

export const queryApi = {
  // POST /api/query — meetingId omitted = cross-meeting search, provided = scoped to one meeting
  ask: async (question: string, meetingId?: string) => {
    const { data } = await api.post<QueryResponse>('/query', { question, meetingId });
    return data;
  },
};

export default api;
