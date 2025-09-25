import type FileMetaData from '../../Typings/fileMetaData';
import type { DirectoryData } from '../types/directory';
import IIMApiClient from './apiClient';
import type {
        AuthResult,
        BulkOperation,
        BulkOperationResult,
        SearchQuery,
        SearchResult,
        VirtualFile,
        Workspace,
} from './types';
import { resolveIntegrationConfig } from './config';

const VIRTUAL_SCHEME = 'workspace://';

interface NormalizedVirtualFile extends VirtualFile {
        normalizedPath: string;
        directoryPath: string;
}

interface WorkspaceCache {
        workspace: Workspace | null;
        files: Map<string, NormalizedVirtualFile>;
        directories: Set<string>;
}

export interface VirtualPathInfo {
        workspaceId: string;
        relativePath: string;
        isRoot: boolean;
}

export class VirtualWorkspaceService {
        private readonly apiClient: IIMApiClient;
        private readonly workspaceCache: Map<string, WorkspaceCache> = new Map();

        constructor(apiClient?: IIMApiClient) {
                this.apiClient = apiClient ?? new IIMApiClient(resolveIntegrationConfig());
        }

        get client(): IIMApiClient {
                return this.apiClient;
        }

        isVirtualPath(path: string): boolean {
                return path.startsWith(VIRTUAL_SCHEME);
        }

        parseVirtualPath(virtualPath: string): VirtualPathInfo {
                if (!this.isVirtualPath(virtualPath)) {
                        throw new Error(`Invalid virtual path: ${virtualPath}`);
                }

                const withoutScheme = virtualPath.slice(VIRTUAL_SCHEME.length);
                const [workspaceId, ...rest] = withoutScheme.split('/');
                if (!workspaceId) {
                        throw new Error(`Virtual path missing workspace identifier: ${virtualPath}`);
                }

                const relativePath = this.normalizeFolderPath(rest.join('/'));
                const isRoot = relativePath === '/';

                return { workspaceId, relativePath, isRoot };
        }

        async listDirectory(virtualPath: string): Promise<DirectoryData> {
                const info = this.parseVirtualPath(virtualPath);
                const cache = await this.ensureWorkspaceCache(info.workspaceId);
                const entries: FileMetaData[] = [];
                const seenDirectories = new Set<string>();

                cache.files.forEach((file) => {
                        if (!this.isDescendant(file.normalizedPath, info.relativePath)) return;
                        const relativePath = this.toRelativePath(file.normalizedPath, info.relativePath);
                        if (!relativePath) return;
                        const segments = relativePath.split('/').filter(Boolean);
                        if (segments.length === 0) return;

                        if (segments.length === 1) {
                                entries.push(this.toFileMeta(info.workspaceId, file));
                        } else {
                                const directoryKey = this.joinPaths(info.relativePath, segments[0]);
                                if (!seenDirectories.has(directoryKey)) {
                                        entries.push(this.toDirectoryMeta(info.workspaceId, directoryKey, segments[0]));
                                        seenDirectories.add(directoryKey);
                                }
                        }
                });

                cache.directories.forEach((directory) => {
                        if (!this.isDescendant(directory, info.relativePath)) return;
                        if (directory === info.relativePath) return;
                        const relativePath = this.toRelativePath(directory, info.relativePath);
                        if (!relativePath) return;
                        const [segment] = relativePath.split('/').filter(Boolean);
                        if (!segment) return;
                        const directoryKey = this.joinPaths(info.relativePath, segment);
                        if (!seenDirectories.has(directoryKey)) {
                                entries.push(this.toDirectoryMeta(info.workspaceId, directoryKey, segment));
                                seenDirectories.add(directoryKey);
                        }
                });

                return {
                        files: this.sortEntries(entries),
                        number_of_files: entries.length,
                        skipped_files: [],
                        lnk_files: [],
                };
        }

        async pathExists(virtualPath: string): Promise<boolean> {
                const info = this.parseVirtualPath(virtualPath);
                const cache = await this.ensureWorkspaceCache(info.workspaceId);

                if (info.relativePath === '/') return true;

                if (cache.files.has(info.relativePath)) return true;
                if (cache.directories.has(info.relativePath)) return true;

                return false;
        }

        async isDirectory(virtualPath: string): Promise<boolean> {
                const info = this.parseVirtualPath(virtualPath);
                if (info.relativePath === '/') return true;
                const cache = await this.ensureWorkspaceCache(info.workspaceId);
                if (cache.directories.has(info.relativePath)) return true;
                if (cache.files.has(info.relativePath)) return false;
                return false;
        }

        async getSize(virtualPath: string): Promise<number> {
                const info = this.parseVirtualPath(virtualPath);
                const cache = await this.ensureWorkspaceCache(info.workspaceId);

                const matched = cache.files.get(info.relativePath);
                if (matched) {
                        return matched.fileSize;
                }

                let total = 0;
                cache.files.forEach((file) => {
                        if (this.isDescendant(file.normalizedPath, info.relativePath)) {
                                total += file.fileSize;
                        }
                });
                return total;
        }

        async search(virtualPath: string, pattern: string): Promise<FileMetaData[]> {
                const info = this.parseVirtualPath(virtualPath);
                const query: SearchQuery = {
                        query: pattern,
                        page: 1,
                        pageSize: 200,
                        sortBy: 'fileName',
                        sortDirection: 'asc',
                };
                const result: SearchResult = await this.apiClient.searchFiles(info.workspaceId, query);
                return result.files
                        .map((file) => this.normalizeFile(file))
                        .filter((file) =>
                                info.relativePath === '/'
                                        ? true
                                        : this.isDescendant(file.normalizedPath, info.relativePath) ||
                                          file.normalizedPath === info.relativePath
                        )
                        .map((file) => this.toFileMeta(info.workspaceId, file));
        }

        async bulkOperation(operation: BulkOperation): Promise<BulkOperationResult> {
                return this.apiClient.bulkOperation(operation);
        }

        async authenticate(username: string, password: string): Promise<AuthResult> {
                const result = await this.apiClient.authenticate(username, password);
                this.workspaceCache.clear();
                return result;
        }

        clearCache(): void {
                this.workspaceCache.clear();
        }

        private async ensureWorkspaceCache(workspaceId: string): Promise<WorkspaceCache> {
                const existing = this.workspaceCache.get(workspaceId);
                if (existing) return existing;

                const [workspace, files] = await Promise.all([
                        this.apiClient.getWorkspaceAsync(workspaceId),
                        this.apiClient.getFilesAsync(workspaceId),
                ]);

                const normalizedFiles = new Map<string, NormalizedVirtualFile>();
                const directories = new Set<string>(['/']);

                files.forEach((file) => {
                        const normalized = this.normalizeFile(file);
                        normalizedFiles.set(normalized.normalizedPath, normalized);
                        this.collectDirectories(normalized.directoryPath, directories);
                });

                const cache: WorkspaceCache = {
                        workspace: workspace ?? null,
                        files: normalizedFiles,
                        directories,
                };

                this.workspaceCache.set(workspaceId, cache);
                return cache;
        }

        private normalizeFile(file: VirtualFile): NormalizedVirtualFile {
                const normalizedPath = this.normalizeFilePath(file.path || file.fileName);
                const directoryPath = this.getDirectoryPath(normalizedPath);

                return {
                        ...file,
                        createdAt: new Date(file.createdAt),
                        updatedAt: file.updatedAt ? new Date(file.updatedAt) : undefined,
                        collectionDate: new Date(file.collectionDate),
                        processedVersions: file.processedVersions?.map((processed) => ({
                                ...processed,
                                processedAt: new Date(processed.processedAt),
                        })),
                        chainOfCustody: file.chainOfCustody?.map((entry) => ({
                                ...entry,
                                timestamp: new Date(entry.timestamp),
                        })),
                        normalizedPath,
                        directoryPath,
                };
        }

        private collectDirectories(path: string, directories: Set<string>): void {
                        if (!path) return;
                        let current = path;
                        while (current && !directories.has(current)) {
                                directories.add(current);
                                if (current === '/') break;
                                current = this.getDirectoryPath(current);
                        }
        }

        private normalizeFolderPath(path: string): string {
                if (!path || path === '.') return '/';
                const normalized = this.normalizeFilePath(path);
                if (normalized === '') return '/';
                return normalized;
        }

        private normalizeFilePath(path: string): string {
                let normalized = path.replace(/\\/g, '/');
                if (!normalized.startsWith('/')) {
                        normalized = '/' + normalized;
                }
                normalized = normalized.replace(/\/+/g, '/');
                if (normalized.length > 1 && normalized.endsWith('/')) {
                        normalized = normalized.slice(0, -1);
                }
                return normalized;
        }

        private getDirectoryPath(path: string): string {
                if (path === '/' || path === '') return '/';
                const trimmed = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
                const index = trimmed.lastIndexOf('/');
                if (index <= 0) return '/';
                return trimmed.slice(0, index);
        }

        private joinPaths(base: string, segment: string): string {
                if (base === '/') return `/${segment}`;
                return `${base}/${segment}`;
        }

        private isDescendant(path: string, parent: string): boolean {
                if (parent === '/') return path !== '';
                if (path === parent) return false;
                return path.startsWith(parent.endsWith('/') ? parent : `${parent}/`);
        }

        private toRelativePath(path: string, parent: string): string {
                if (parent === '/') {
                        return path.slice(1);
                }
                const prefix = parent.endsWith('/') ? parent : `${parent}/`;
                if (!path.startsWith(prefix)) return '';
                return path.slice(prefix.length);
        }

        private toFileMeta(workspaceId: string, file: NormalizedVirtualFile): FileMetaData {
                return {
                        file_path: `${VIRTUAL_SCHEME}${workspaceId}${file.normalizedPath}`,
                        basename: file.fileName,
                        file_type: this.getFileType(file.fileName),
                        is_trash: false,
                        is_dir: false,
                        is_file: true,
                        size: file.fileSize,
                        last_modified: this.toSystemTime(file.updatedAt || file.createdAt),
                        created: this.toSystemTime(file.createdAt),
                };
        }

        private toDirectoryMeta(workspaceId: string, path: string, name: string): FileMetaData {
                return {
                        file_path: `${VIRTUAL_SCHEME}${workspaceId}${path}`,
                        basename: name,
                        file_type: 'Directory',
                        is_trash: false,
                        is_dir: true,
                        is_file: false,
                };
        }

        private sortEntries(entries: FileMetaData[]): FileMetaData[] {
                return entries.sort((a, b) => {
                        const aDir = Boolean(a.is_dir);
                        const bDir = Boolean(b.is_dir);
                        if (aDir && !bDir) return -1;
                        if (!aDir && bDir) return 1;
                        return a.basename.localeCompare(b.basename, undefined, { sensitivity: 'base' });
                });
        }

        private getFileType(fileName: string): string {
                const dotIndex = fileName.lastIndexOf('.');
                if (dotIndex === -1 || dotIndex === fileName.length - 1) {
                        return 'File';
                }
                return `${fileName.slice(dotIndex + 1).toUpperCase()} File`;
        }

        private toSystemTime(date: Date | string | undefined): FileMetaData['created'] {
                if (!date) return undefined;
                const normalizedDate = date instanceof Date ? date : new Date(date);
                const time = normalizedDate.getTime();
                const seconds = Math.floor(time / 1000);
                const nanos = (time - seconds * 1000) * 1e6;
                return {
                        secs_since_epoch: seconds,
                        nanos_since_epoch: Math.round(nanos),
                };
        }
}

let defaultService: VirtualWorkspaceService | null = null;

export const getVirtualWorkspaceService = (): VirtualWorkspaceService => {
        if (!defaultService) {
                defaultService = new VirtualWorkspaceService();
        }
        return defaultService;
};

export const setVirtualWorkspaceService = (service: VirtualWorkspaceService): void => {
        defaultService = service;
};

export const isVirtualPath = (path: string): boolean => path.startsWith(VIRTUAL_SCHEME);

export { VIRTUAL_SCHEME };
