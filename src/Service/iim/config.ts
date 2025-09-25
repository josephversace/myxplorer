import type { IIMApiClientOptions } from './types';

const DEFAULT_BASE_URL = ((): string => {
        if (typeof window !== 'undefined') {
                const globalBase = (window as unknown as { __IIM_API_BASE_URL__?: string }).__IIM_API_BASE_URL__;
                if (globalBase) return globalBase;
        }
        if (typeof globalThis !== 'undefined') {
                const globalBase = (globalThis as { __IIM_API_BASE_URL__?: string }).__IIM_API_BASE_URL__;
                if (globalBase) return globalBase;
        }
        return 'https://api.iim.local';
})();

const DEFAULT_MOCK_MODE = ((): boolean => {
        if (typeof window !== 'undefined') {
                const flag = (window as unknown as { __IIM_API_MOCK_MODE__?: boolean }).__IIM_API_MOCK_MODE__;
                if (typeof flag === 'boolean') return flag;
        }
        if (typeof globalThis !== 'undefined') {
                const flag = (globalThis as { __IIM_API_MOCK_MODE__?: boolean }).__IIM_API_MOCK_MODE__;
                if (typeof flag === 'boolean') return flag;
        }
        return true;
})();

export type IIMIntegrationConfig = IIMApiClientOptions;

export const DEFAULT_IIM_INTEGRATION_CONFIG: IIMIntegrationConfig = {
        baseUrl: DEFAULT_BASE_URL,
        mockMode: DEFAULT_MOCK_MODE,
};

export const resolveIntegrationConfig = (
        options?: Partial<IIMIntegrationConfig>
): IIMIntegrationConfig => ({
        ...DEFAULT_IIM_INTEGRATION_CONFIG,
        ...options,
});
