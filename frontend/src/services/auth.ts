import type { User } from '../types';
import { api } from './api';

interface LoginResponse {
  token: string;
  user: User;
}

interface RegisterResponse {
  token: string;
  user: User;
}

class AuthService {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  }

  async register(email: string, password: string, name: string): Promise<RegisterResponse> {
    const response = await api.post('/auth/register', { email, password, name });
    return response.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await api.get('/auth/me');
    return response.data;
  }

  async refreshToken(): Promise<{ token: string }> {
    const response = await api.post('/auth/refresh-token');
    return response.data;
  }
}

export const authService = new AuthService();