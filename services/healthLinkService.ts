import api from './api';
import { HealthProvider } from './healthService';

export type HealthStatus = {
  appleHealth?: {
    linked?: boolean;
    autoImport?: boolean;
    lastSyncAt?: string;
    permissions?: string[];
  };
  healthConnect?: {
    linked?: boolean;
    autoImport?: boolean;
    lastSyncAt?: string;
    permissions?: string[];
  };
};

export const healthLinkService = {
  getHealthStatus: async (): Promise<HealthStatus> => {
    const response = await api.get('/users/health');
    return response?.data?.data?.health ?? {};
  },

  updateHealthStatus: async (payload: {
    provider: HealthProvider;
    linked?: boolean;
    autoImport?: boolean;
    permissions?: string[];
    lastSyncAt?: string;
  }): Promise<HealthStatus> => {
    const response = await api.put('/users/health', payload);
    return response?.data?.data?.health ?? {};
  },
};
