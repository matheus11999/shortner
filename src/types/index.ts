export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'client';
  customCpm?: number;
  apiToken?: string;
  createdAt?: string;
  siteCount?: number;
}

export interface Client extends User {
  role: 'client';
  customCpm: number;
  siteCount: number;
}

export interface Site {
  id: number;
  name: string;
  url: string;
  userId: number;
  integrationCode: string;
  status: 'active' | 'inactive';
  createdAt: string;
  urlCount?: number;
  totalClicks?: number;
}

export interface AdSite {
  id: number;
  name: string;
  url: string;
  apiToken: string;
  bannerCode?: string;
  forcedClick?: boolean;
  timerDuration?: number;
  wpApiUrl?: string;
  wpToken?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  adCount?: number;
}

export interface Advertisement {
  id: number;
  adsiteId: number;
  adsiteName?: string;
  type: 'banner' | 'text' | 'html' | 'video';
  content: string;
  redirectUrl?: string;
  step: 1 | 2;
  position: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface ShortUrl {
  id: number;
  originalUrl: string;
  shortCode: string;
  shortUrl: string;
  userId: number;
  siteId: number;
  siteName?: string;
  clicks: number;
  createdAt: string;
}

export interface Analytics {
  totalClicks: number;
  uniqueClicks: number;
  completedClicks: number;
  conversionRate: string;
  topCountries: Array<{ country: string; count: number }>;
  clicksByDate: Array<{ date: string; clicks: number; unique_clicks?: number }>;
  topUrls?: Array<{ short_code: string; original_url: string; clicks: number }>;
  adsitePerformance?: Array<{ adsite_name: string; clicks: number; conversions: number }>;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  error?: string;
  message?: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}