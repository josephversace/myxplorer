export interface ChainOfCustodyEntry {
        action: string;
        actor: string;
        timestamp: Date | string;
        details: string;
}

export interface ProcessedFile {
        id: string;
        processType: string;
        processedAt: Date | string;
        processedBy: string;
        outputPath: string;
        metadata: Record<string, unknown>;
}

export interface VirtualFile {
        id: string;
        workspaceId: string;
        fileName: string;
        path: string;
        fileSize: number;
        status: 'pending' | 'uploading' | 'uploaded' | 'processing' | 'complete' | 'error';
        storedFileHash: string;
        createdAt: Date | string;
        updatedAt?: Date | string;
        createdBy: string;
        collectedBy: string;
        collectionDate: Date | string;
        collectedLocation: string;
        customMetadata: Record<string, string>;
        chainOfCustody: ChainOfCustodyEntry[];
        processedVersions: ProcessedFile[];
        dataSensitivity: 'public' | 'internal' | 'confidential' | 'secret';
        tags?: string[];
        description: string;
}

export interface ClassificationTag {
        id: string;
        name: string;
        category: string;
        confidence: number;
}

export interface StoredFile {
        hash: string;
        fileSize: number;
        mimeType: string;
        classificationTags: ClassificationTag[];
        virtualFiles: VirtualFile[];
}

export interface WorkspaceUser {
        id: string;
        workspaceId: string;
        userId: string;
        role: string;
}

export interface InvestigationSession {
        id: string;
        workspaceId: string;
        name: string;
        startedAt: Date | string;
        endedAt?: Date | string;
        status: string;
}

export interface Workspace {
        id: string;
        name: string;
        description: string;
        type: 'investigation' | 'training' | 'research';
        createdAt: Date | string;
        updatedAt: Date | string;
        createdBy: string;
        isDeleted: boolean;
        isPublic: boolean;
        users: WorkspaceUser[];
        files: VirtualFile[];
        sessions: InvestigationSession[];
}

export interface WorkspaceSummary {
        id: string;
        name: string;
        type: string;
        updatedAt: Date | string;
        fileCount: number;
        activeSessions: number;
}

export interface WorkspaceStatistics {
        totalFiles: number;
        totalFileSize: number;
        totalSessions: number;
        activeSessions: number;
        totalReports: number;
        totalFindings: number;
        totalTime: string;
        filesByType: Record<string, number>;
        filesBySeverity: Record<string, number>;
}

export interface VirtualFolder {
        name: string;
        path: string;
        files: VirtualFile[];
        subFolders: VirtualFolder[];
}

export interface InitiateFileUploadResponse {
        isDuplicate: boolean;
        transactionId?: string;
        uploadUrl?: string;
        virtualFile?: VirtualFile;
}

export interface CreateWorkspaceRequest {
        name: string;
        description: string;
        type: 'investigation' | 'training' | 'research';
        ownerId?: string;
}

export interface SearchWorkspacesRequest {
        query?: string;
        page: number;
        pageSize: number;
}

export interface UploadRequest {
        workspaceId: string;
        fileName: string;
        requiresQuarantine: boolean;
}

export interface UploadResponse {
        uploadUrl: string;
        bucket: string;
        objectKey: string;
        expiresAt: Date | string;
}

export interface SearchQuery {
        query?: string;
        tags?: string[];
        sensitivityLevels?: string[];
        fileTypes?: string[];
        uploadedBy?: string;
        dateRange?: {
                from: Date | string;
                to: Date | string;
        };
        page: number;
        pageSize: number;
        sortBy: 'fileName' | 'fileSize' | 'createdAt' | 'updatedAt';
        sortDirection: 'asc' | 'desc';
}

export interface SearchResult {
        files: VirtualFile[];
        totalCount: number;
        page: number;
        pageSize: number;
}

export interface BulkOperation {
        operation: 'tag' | 'move' | 'delete' | 'setSensitivity';
        fileIds: string[];
        parameters: Record<string, unknown>;
}

export interface BulkOperationResult {
        success: boolean;
        processedCount: number;
        failedCount: number;
        errors: { fileId: string; error: string }[];
}

export interface AuthResult {
        success: boolean;
        token: string;
        refreshToken: string;
        expiresAt: Date;
        user: User;
        error?: string;
}

export interface User {
        id: string;
        username: string;
        email: string;
        role: 'admin' | 'investigator' | 'analyst' | 'viewer';
        permissions: string[];
        workspaces: string[];
}

export interface IIMApiClientOptions {
        baseUrl: string;
        mockMode?: boolean;
}
