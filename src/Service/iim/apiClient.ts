import {
        AuthResult,
        BulkOperation,
        BulkOperationResult,
        CreateWorkspaceRequest,
        IIMApiClientOptions,
        InitiateFileUploadResponse,
        SearchQuery,
        SearchResult,
        UploadRequest,
        UploadResponse,
        VirtualFile,
        Workspace,
        WorkspaceUser,
} from './types';
import MockApiService from './mockService';
import { resolveIntegrationConfig } from './config';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
        body?: unknown;
        retry?: boolean;
}

class IIMApiClient {
        private baseUrl: string;
        private token: string | null = null;
        private refreshToken: string | null = null;
        private refreshTimeout: ReturnType<typeof setTimeout> | null = null;
        private readonly isMockMode: boolean;
        private readonly mockService: MockApiService;

        constructor(options?: Partial<IIMApiClientOptions>) {
                const config = resolveIntegrationConfig(options);
                this.baseUrl = config.baseUrl.replace(/\/$/, '');
                this.isMockMode = Boolean(config.mockMode);
                this.mockService = new MockApiService();
        }

        async authenticate(username: string, password: string): Promise<AuthResult> {
                if (this.isMockMode) {
                        const result = await this.mockService.authenticate(username, password);
                        this.applyAuthResult(result);
                        return result;
                }

                const response = await this.post<AuthResult>('/api/auth/login', { username, password });
                this.applyAuthResult(response);
                return response;
        }

        async refreshAuthToken(): Promise<string> {
                if (!this.refreshToken) {
                        throw new Error('No refresh token available');
                }

                if (this.isMockMode) {
                        const token = await this.mockService.refreshToken();
                        this.token = token;
                        return token;
                }

                const response = await this.post<AuthResult>('/api/auth/refresh', {
                        refreshToken: this.refreshToken,
                });
                this.applyAuthResult(response);
                return response.token;
        }

        async logout(): Promise<void> {
                if (this.isMockMode) {
                        await this.mockService.logout();
                } else {
                        await this.post('/api/auth/logout', {});
                }
                this.token = null;
                this.refreshToken = null;
                this.clearRefreshTimeout();
        }

        async getWorkspacesAsync(): Promise<Workspace[]> {
                        if (this.isMockMode) {
                                return this.mockService.getWorkspaces();
                        }
                        return this.get<Workspace[]>('/api/workspaces');
        }

        async getWorkspaceAsync(workspaceId: string): Promise<Workspace | null> {
                if (this.isMockMode) {
                        return this.mockService.getWorkspace(workspaceId);
                }
                return this.get<Workspace | null>(`/api/workspaces/${workspaceId}`);
        }

        async createWorkspace(request: CreateWorkspaceRequest): Promise<Workspace> {
                if (this.isMockMode) {
                        return this.mockService.createWorkspace(request);
                }
                return this.post<Workspace>('/api/workspaces', request);
        }

        async getFilesAsync(workspaceId: string): Promise<VirtualFile[]> {
                if (this.isMockMode) {
                        return this.mockService.getFiles(workspaceId);
                }
                return this.get<VirtualFile[]>(`/api/workspaces/${workspaceId}/files`);
        }

        async getFileAsync(fileId: string): Promise<VirtualFile | null> {
                if (this.isMockMode) {
                        return this.mockService.getFile(fileId);
                }
                return this.get<VirtualFile | null>(`/api/files/${fileId}`);
        }

        async initiateFileUploadAsync(
                workspaceId: string,
                path: string,
                fileName: string,
                fileSize: number,
                fileHash: string
        ): Promise<InitiateFileUploadResponse> {
                if (this.isMockMode) {
                        return this.mockService.initiateFileUpload(workspaceId, path, fileName, fileSize, fileHash);
                }

                return this.post<InitiateFileUploadResponse>('/api/files/initiate-upload', {
                        workspaceId,
                        path,
                        fileName,
                        fileSize,
                        fileHash,
                });
        }

        async confirmFileUploadAsync(transactionId: string): Promise<VirtualFile | null> {
                if (this.isMockMode) {
                        return this.mockService.confirmFileUpload(transactionId);
                }

                return this.post<VirtualFile | null>('/api/files/confirm-upload', { transactionId });
        }

        async uploadFileWithProgress(
                request: UploadRequest,
                formData: FormData,
                onProgress?: (progress: number) => void
        ): Promise<UploadResponse> {
                if (this.isMockMode) {
                        const response: UploadResponse = {
                                uploadUrl: `https://mock-s3.amazonaws.com/upload/${Date.now()}`,
                                bucket: 'mock-bucket',
                                objectKey: `${request.workspaceId}/${request.fileName}`,
                                expiresAt: new Date(Date.now() + 3600000),
                        };
                        return response;
                }

                return this.uploadWithProgress('/api/files/upload', formData, onProgress);
        }

        async searchFiles(workspaceId: string, query: SearchQuery): Promise<SearchResult> {
                if (this.isMockMode) {
                        return this.mockService.searchFiles(workspaceId, query);
                }
                return this.post<SearchResult>(`/api/workspaces/${workspaceId}/search`, query);
        }

        async downloadFile(fileId: string): Promise<string> {
                if (this.isMockMode) {
                        return this.mockService.downloadFile(fileId);
                }
                const response = await this.get<{ presignedUrl: string }>(`/api/files/${fileId}/download`);
                return response.presignedUrl;
        }

        async getFilePreview(fileId: string): Promise<string> {
                if (this.isMockMode) {
                        return this.mockService.getFilePreview(fileId);
                }
                const response = await this.get<{ previewUrl: string }>(`/api/files/${fileId}/preview`);
                return response.previewUrl;
        }

        async bulkOperation(operation: BulkOperation): Promise<BulkOperationResult> {
                if (this.isMockMode) {
                        return this.mockService.bulkOperation(operation);
                }
                return this.post<BulkOperationResult>('/api/files/bulk', operation);
        }

        async addTags(fileIds: string[], tags: string[]): Promise<void> {
                if (this.isMockMode) {
                        return this.mockService.addTags(fileIds, tags);
                }
                await this.post<void>('/api/files/tags/add', { fileIds, tags });
        }

        async removeTags(fileIds: string[], tags: string[]): Promise<void> {
                if (this.isMockMode) {
                        return this.mockService.removeTags(fileIds, tags);
                }
                await this.post<void>('/api/files/tags/remove', { fileIds, tags });
        }

        async getWorkspaceUsers(workspaceId: string): Promise<WorkspaceUser[]> {
                if (this.isMockMode) {
                        return this.mockService.getWorkspaceUsers(workspaceId);
                }
                return this.get<WorkspaceUser[]>(`/api/workspaces/${workspaceId}/users`);
        }

        async inviteUser(workspaceId: string, email: string, role: string): Promise<void> {
                if (this.isMockMode) {
                        return this.mockService.inviteUser(workspaceId, email, role);
                }
                await this.post<void>(`/api/workspaces/${workspaceId}/users/invite`, { email, role });
        }

        setTokens(token: string, refreshToken?: string, expiresAt?: Date): void {
                this.token = token;
                if (refreshToken) {
                        this.refreshToken = refreshToken;
                }
                if (expiresAt) {
                        this.scheduleTokenRefresh(expiresAt);
                }
        }

        dispose(): void {
                this.clearRefreshTimeout();
        }

        private applyAuthResult(result: AuthResult): void {
                this.token = result.token;
                this.refreshToken = result.refreshToken;
                this.scheduleTokenRefresh(result.expiresAt);
        }

        private async get<T>(endpoint: string): Promise<T> {
                return this.request<T>('GET', endpoint);
        }

        private async post<T>(endpoint: string, body: unknown): Promise<T> {
                return this.request<T>('POST', endpoint, { body });
        }

        private async request<T>(method: HttpMethod, endpoint: string, options: RequestOptions = {}): Promise<T> {
                if (this.isMockMode) {
                        throw new Error('HTTP request should not be called in mock mode');
                }

                const response = await this.performRequest(method, endpoint, options.body);

                if (response.status === 401 && !options.retry && this.refreshToken) {
                        try {
                                await this.refreshAuthToken();
                                return this.request<T>(method, endpoint, { ...options, retry: true });
                        } catch (error) {
                                throw new Error('Authentication required');
                        }
                }

                if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`API Error: ${errorText}`);
                }

                if (response.status === 204) {
                        return undefined as unknown as T;
                }

                return response.json() as Promise<T>;
        }

        private performRequest(method: HttpMethod, endpoint: string, body?: unknown): Promise<Response> {
                const headers: Record<string, string> = {
                        'Content-Type': 'application/json',
                };

                if (this.token) {
                        headers['Authorization'] = `Bearer ${this.token}`;
                }

                const init: RequestInit = {
                        method,
                        headers,
                };

                if (body !== undefined) {
                        init.body = JSON.stringify(body);
                }

                return fetch(`${this.baseUrl}${endpoint}`, init);
        }

        private uploadWithProgress(
                endpoint: string,
                formData: FormData,
                onProgress?: (progress: number) => void
        ): Promise<UploadResponse> {
                return new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        if (onProgress) {
                                xhr.upload.addEventListener('progress', (event) => {
                                        if (event.lengthComputable) {
                                                const percentage = Math.round((event.loaded / event.total) * 100);
                                                onProgress(percentage);
                                        }
                                });
                        }

                        xhr.addEventListener('load', () => {
                                if (xhr.status >= 200 && xhr.status < 300) {
                                        try {
                                                const parsed: UploadResponse = JSON.parse(xhr.responseText);
                                                resolve(parsed);
                                        } catch (error) {
                                                reject(error);
                                        }
                                } else {
                                        reject(new Error(`Upload failed: ${xhr.statusText}`));
                                }
                        });

                        xhr.addEventListener('error', () => reject(new Error('Upload failed')));

                        xhr.open('POST', `${this.baseUrl}${endpoint}`);
                        if (this.token) {
                                xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
                        }
                        xhr.send(formData);
                });
        }

        private scheduleTokenRefresh(expiresAt: Date): void {
                this.clearRefreshTimeout();
                const refreshTime = expiresAt.getTime() - Date.now() - 5 * 60 * 1000;
                if (refreshTime > 0) {
                        this.refreshTimeout = setTimeout(() => {
                                this.refreshAuthToken().catch(() => {
                                        this.token = null;
                                        this.refreshToken = null;
                                });
                        }, refreshTime);
                }
        }

        private clearRefreshTimeout(): void {
                if (this.refreshTimeout) {
                        clearTimeout(this.refreshTimeout);
                        this.refreshTimeout = null;
                }
        }
}

export default IIMApiClient;
