import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { AuthState, User } from '../types';
import { authService } from '../services/auth';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'LOGIN_ERROR' }
  | { type: 'LOGOUT' }
  | { type: 'SET_USER'; payload: User };

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  isLoading: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_START':
      return { ...state, isLoading: true };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
      };
    case 'LOGIN_ERROR':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
      };
    default:
      return state;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const user = await authService.getCurrentUser();
          dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token } });
        } catch (error) {
          localStorage.removeItem('token');
          dispatch({ type: 'LOGIN_ERROR' });
        }
      } else {
        dispatch({ type: 'LOGIN_ERROR' });
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const { user, token } = await authService.login(email, password);
      localStorage.setItem('token', token);
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token } });
    } catch (error) {
      dispatch({ type: 'LOGIN_ERROR' });
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const { user, token } = await authService.register(email, password, name);
      localStorage.setItem('token', token);
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token } });
    } catch (error) {
      dispatch({ type: 'LOGIN_ERROR' });
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    dispatch({ type: 'LOGOUT' });
  };

  const refreshToken = async () => {
    try {
      const { token } = await authService.refreshToken();
      localStorage.setItem('token', token);
      const user = await authService.getCurrentUser();
      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token } });
    } catch (error) {
      logout();
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};