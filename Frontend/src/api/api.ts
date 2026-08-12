import axios, { AxiosError } from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
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
    }
  },
};

export default api;
