import type { Client, AdSite, Advertisement, Site } from '../types';
import { api } from './api';

class AdminService {
  // Client management
  async getClients(): Promise<Client[]> {
    try {
      const response = await api.get('/admin/clients');
      return response.data;
    } catch (error) {
      return api.handleError(error);
    }
  }

  async createClient(data: {
    email: string;
    password: string;
    name: string;
    customCpm?: number;
  }): Promise<Client> {
    try {
      const response = await api.post('/admin/clients', data);
      return response.data;
    } catch (error) {
      return api.handleError(error);
    }
  }

  async updateClient(id: number, data: {
    name: string;
    email: string;
    customCpm: number;
  }): Promise<void> {
    try {
      await api.put(`/admin/clients/${id}`, data);
    } catch (error) {
      return api.handleError(error);
    }
  }

  async deleteClient(id: number): Promise<void> {
    try {
      await api.delete(`/admin/clients/${id}`);
    } catch (error) {
      return api.handleError(error);
    }
  }

  // AdSite management
  async getAdSites(): Promise<AdSite[]> {
    try {
      const response = await api.get('/admin/adsites');
      return response.data;
    } catch (error) {
      return api.handleError(error);
    }
  }

  async createAdSite(data: {
    name: string;
    url: string;
    wpApiUrl?: string;
    wpToken?: string;
  }): Promise<AdSite> {
    try {
      const response = await api.post('/admin/adsites', data);
      return response.data;
    } catch (error) {
      return api.handleError(error);
    }
  }

  async updateAdSite(id: number, data: {
    name: string;
    url: string;
    wpApiUrl?: string;
    wpToken?: string;
    status?: string;
  }): Promise<void> {
    try {
      await api.put(`/admin/adsites/${id}`, data);
    } catch (error) {
      return api.handleError(error);
    }
  }

  async deleteAdSite(id: number): Promise<void> {
    try {
      await api.delete(`/admin/adsites/${id}`);
    } catch (error) {
      return api.handleError(error);
    }
  }

  // Advertisement management
  async getAdvertisements(adsiteId?: number): Promise<Advertisement[]> {
    try {
      const params = adsiteId ? { adsiteId } : {};
      const response = await api.get('/admin/advertisements', { params });
      return response.data;
    } catch (error) {
      return api.handleError(error);
    }
  }

  async createAdvertisement(data: {
    adsiteId: number;
    type: string;
    content: string;
    redirectUrl?: string;
    step: number;
    position?: number;
  }): Promise<Advertisement> {
    try {
      const response = await api.post('/admin/advertisements', data);
      return response.data;
    } catch (error) {
      return api.handleError(error);
    }
  }

  async updateAdvertisement(id: number, data: {
    type: string;
    content: string;
    redirectUrl?: string;
    step: number;
    position: number;
    status?: string;
  }): Promise<void> {
    try {
      await api.put(`/admin/advertisements/${id}`, data);
    } catch (error) {
      return api.handleError(error);
    }
  }

  async deleteAdvertisement(id: number): Promise<void> {
    try {
      await api.delete(`/admin/advertisements/${id}`);
    } catch (error) {
      return api.handleError(error);
    }
  }

  // Site-AdSite management
  async updateSiteAdSites(siteId: number, adsiteIds: number[]): Promise<void> {
    try {
      await api.post(`/admin/sites/${siteId}/adsites`, { adsiteIds });
    } catch (error) {
      return api.handleError(error);
    }
  }

  // Get all sites for admin
  async getAllSites(): Promise<Site[]> {
    try {
      const response = await api.get('/client/sites');
      return response.data;
    } catch (error) {
      return api.handleError(error);
    }
  }

  // Banner configuration management
  async getBannerConfigs(adsiteId: number, step?: number): Promise<any[]> {
    try {
      const params = step ? { step } : {};
      const response = await api.get(`/admin/banner-configs/${adsiteId}`, { params });
      return response.data;
    } catch (error) {
      return api.handleError(error);
    }
  }

  async saveBannerConfig(data: {
    adsiteId: number;
    step: number;
    banners: {
      '300x250': string[];
      '728x90': string[];
      '300x600': string[];
    };
  }): Promise<void> {
    try {
      await api.post('/admin/banner-configs', data);
    } catch (error) {
      return api.handleError(error);
    }
  }

  async updateBannerConfig(id: number, data: {
    code: string;
    active: boolean;
  }): Promise<void> {
    try {
      await api.put(`/admin/banner-configs/${id}`, data);
    } catch (error) {
      return api.handleError(error);
    }
  }

  async deleteBannerConfig(id: number): Promise<void> {
    try {
      await api.delete(`/admin/banner-configs/${id}`);
    } catch (error) {
      return api.handleError(error);
    }
  }

  // Client Sites Management
  async getClientSites(clientId?: number): Promise<any[]> {
    try {
      const params = clientId ? { clientId } : {};
      const response = await api.get('/admin/client-sites', { params });
      return response.data;
    } catch (error) {
      return api.handleError(error);
    }
  }

  async createClientSite(data: {
    userId: number;
    name: string;
    url: string;
    assignedAdsiteId?: number | null;
    magnetIntercept?: boolean;
  }): Promise<any> {
    try {
      const response = await api.post('/admin/client-sites', data);
      return response.data;
    } catch (error) {
      return api.handleError(error);
    }
  }

  async updateClientSite(id: number, data: {
    name?: string;
    url?: string;
    assignedAdsiteId?: number | null;
    magnetIntercept?: boolean;
    status?: string;
  }): Promise<void> {
    try {
      await api.put(`/admin/client-sites/${id}`, data);
    } catch (error) {
      return api.handleError(error);
    }
  }

  async deleteClientSite(id: number): Promise<void> {
    try {
      await api.delete(`/admin/client-sites/${id}`);
    } catch (error) {
      return api.handleError(error);
    }
  }
}

export const adminService = new AdminService();