import {
	AuthResult,
	BulkOperation,
	BulkOperationResult,
	CreateWorkspaceRequest,
	InitiateFileUploadResponse,
	SearchQuery,
	SearchResult,
	User,
	VirtualFile,
	Workspace,
	WorkspaceUser,
} from './types';

interface UploadTransaction {
	workspaceId: string;
	path: string;
	fileName: string;
	fileSize: number;
	fileHash: string;
	status: 'pending' | 'confirmed';
}

class MockApiService {
	private mockWorkspaces: Workspace[] = [];
	private mockFiles: VirtualFile[] = [];
	private mockUsers: User[] = [];
	private mockTransactions: Map<string, UploadTransaction> = new Map();

	constructor() {
		this.initializeMockData();
	}

	async authenticate(_username: string, _password: string): Promise<AuthResult> {
		await this.simulateDelay();
		return {
			success: true,
			token: 'mock-jwt-token-' + Date.now(),
			refreshToken: 'mock-refresh-token-' + Date.now(),
			expiresAt: new Date(Date.now() + 3600000),
			user: this.mockUsers[0],
		};
	}

	async refreshToken(): Promise<string> {
		await this.simulateDelay(200);
		return 'refreshed-token-' + Date.now();
	}

	async logout(): Promise<void> {
		await this.simulateDelay(100);
	}

	async getWorkspaces(): Promise<Workspace[]> {
		await this.simulateDelay();
		return [...this.mockWorkspaces];
	}

	async getWorkspace(workspaceId: string): Promise<Workspace | null> {
		await this.simulateDelay();
		return this.mockWorkspaces.find((w) => w.id === workspaceId) || null;
	}

	async createWorkspace(request: CreateWorkspaceRequest): Promise<Workspace> {
		await this.simulateDelay(800);
		const newWorkspace: Workspace = {
			id: this.generateId(),
			name: request.name,
			description: request.description,
			type: request.type,
			createdAt: new Date(),
			updatedAt: new Date(),
			createdBy: request.ownerId || 'current-user',
			isDeleted: false,
			isPublic: false,
			users: [],
			files: [],
			sessions: [],
		};
		this.mockWorkspaces.push(newWorkspace);
		return newWorkspace;
	}

	async getFiles(workspaceId: string): Promise<VirtualFile[]> {
		console.log('MockApiService.getFiles called with workspaceId:', workspaceId);

		await this.simulateDelay();
		return this.mockFiles.filter((f) => f.workspaceId === workspaceId);
	}

	async getFile(fileId: string): Promise<VirtualFile | null> {
		await this.simulateDelay();
		return this.mockFiles.find((f) => f.id === fileId) || null;
	}

	async initiateFileUpload(
		workspaceId: string,
		path: string,
		fileName: string,
		fileSize: number,
		fileHash: string
	): Promise<InitiateFileUploadResponse> {
		await this.simulateDelay(300);

		const existingFile = this.mockFiles.find((f) => f.storedFileHash === fileHash);
		if (existingFile) {
			return {
				isDuplicate: true,
				virtualFile: existingFile,
			};
		}

		const transactionId = this.generateId();
		this.mockTransactions.set(transactionId, {
			workspaceId,
			path,
			fileName,
			fileSize,
			fileHash,
			status: 'pending',
		});

		return {
			isDuplicate: false,
			transactionId,
			uploadUrl: `https://mock-s3.amazonaws.com/upload/${transactionId}`,
		};
	}

	async confirmFileUpload(transactionId: string): Promise<VirtualFile | null> {
		await this.simulateDelay(500);

		const transaction = this.mockTransactions.get(transactionId);
		if (!transaction) {
			throw new Error('Transaction not found');
		}

		const newFile: VirtualFile = {
			id: this.generateId(),
			workspaceId: transaction.workspaceId,
			fileName: transaction.fileName,
			path: transaction.path,
			fileSize: transaction.fileSize,
			status: 'uploaded',
			storedFileHash: transaction.fileHash,
			createdAt: new Date(),
			createdBy: 'current-user',
			collectedBy: 'current-user',
			collectionDate: new Date(),
			collectedLocation: 'Digital Upload',
			customMetadata: {},
			chainOfCustody: [
				{
					action: 'File Uploaded',
					actor: 'current-user',
					timestamp: new Date(),
					details: 'File uploaded via mock interface',
				},
			],
			processedVersions: [],
			dataSensitivity: 'internal',
			tags: [],
			description: '',
		};

		this.mockFiles.push(newFile);
		this.mockTransactions.delete(transactionId);

		return newFile;
	}

	async searchFiles(workspaceId: string, query: SearchQuery): Promise<SearchResult> {
		await this.simulateDelay(400);

		let results = this.mockFiles.filter((f) => f.workspaceId === workspaceId);

		if (query.query) {
			const searchTerm = query.query.toLowerCase();
			results = results.filter((f) => f.fileName.toLowerCase().includes(searchTerm) || f.description.toLowerCase().includes(searchTerm));
		}

		if (query.tags && query.tags.length > 0) {
			const tagSet = new Set(query.tags);
			results = results.filter((f) => {
				if (!f.tags || f.tags.length === 0) return false;
				return f.tags.some((tag) => tagSet.has(tag));
			});
		}

		if (query.dateRange) {
			const from = new Date(query.dateRange.from);
			const to = new Date(query.dateRange.to);
			results = results.filter((f) => {
				const createdAt = new Date(f.createdAt);
				return createdAt >= from && createdAt <= to;
			});
		}

		const sortKey = query.sortBy;
		results.sort((a, b) => {
			const aVal = this.extractComparableValue(a, sortKey);
			const bVal = this.extractComparableValue(b, sortKey);
			if (aVal === bVal) return 0;
			if (query.sortDirection === 'desc') {
				return aVal > bVal ? -1 : 1;
			}
			return aVal > bVal ? 1 : -1;
		});

		const start = (query.page - 1) * query.pageSize;
		const paginatedResults = results.slice(start, start + query.pageSize);

		return {
			files: paginatedResults,
			totalCount: results.length,
			page: query.page,
			pageSize: query.pageSize,
		};
	}

	async downloadFile(fileId: string): Promise<string> {
		await this.simulateDelay(200);
		return `https://mock-s3.amazonaws.com/download/${fileId}?expires=${Date.now() + 3600000}`;
	}

	async getFilePreview(fileId: string): Promise<string> {
		await this.simulateDelay(300);
		return `https://mock-s3.amazonaws.com/preview/${fileId}?expires=${Date.now() + 3600000}`;
	}

	async bulkOperation(operation: BulkOperation): Promise<BulkOperationResult> {
		await this.simulateDelay(1000);

		const failures = operation.fileIds.slice(0, Math.floor(operation.fileIds.length * 0.1));
		const successes = operation.fileIds.filter((id) => !failures.includes(id));

		return {
			success: failures.length === 0,
			processedCount: successes.length,
			failedCount: failures.length,
			errors: failures.map((fileId) => ({
				fileId,
				error: 'Mock error for testing',
			})),
		};
	}

	async addTags(fileIds: string[], tags: string[]): Promise<void> {
		await this.simulateDelay(500);
		fileIds.forEach((fileId) => {
			const file = this.mockFiles.find((f) => f.id === fileId);
			if (file) {
				const existingTags = new Set([...(file.tags || []), ...tags]);
				file.tags = Array.from(existingTags);
			}
		});
	}

	async removeTags(fileIds: string[], tags: string[]): Promise<void> {
		await this.simulateDelay(500);
		fileIds.forEach((fileId) => {
			const file = this.mockFiles.find((f) => f.id === fileId);
			if (file && file.tags) {
				file.tags = file.tags.filter((tag) => !tags.includes(tag));
			}
		});
	}

	async getWorkspaceUsers(workspaceId: string): Promise<WorkspaceUser[]> {
		await this.simulateDelay();
		return [
			{
				id: this.generateId(),
				workspaceId,
				userId: 'user1',
				role: 'Owner',
			},
			{
				id: this.generateId(),
				workspaceId,
				userId: 'user2',
				role: 'Member',
			},
		];
	}

	async inviteUser(_workspaceId: string, _email: string, _role: string): Promise<void> {
		await this.simulateDelay(800);
	}

	private extractComparableValue(file: VirtualFile, key: SearchQuery['sortBy']): number | string {
		if (key === 'fileSize') return file.fileSize;
		if (key === 'createdAt') return new Date(file.createdAt).getTime();
		if (key === 'updatedAt') return new Date(file.updatedAt || file.createdAt).getTime();
		return file.fileName.toLowerCase();
	}

	private generateId(): string {
		return 'mock-' + Math.random().toString(36).substring(2, 11);
	}

	private async simulateDelay(ms = 500): Promise<void> {
		await new Promise((resolve) => setTimeout(resolve, ms));
	}

	private initializeMockData(): void {
		this.mockUsers = [
			{
				id: 'user1',
				username: 'det.smith',
				email: 'det.smith@agency.gov',
				role: 'investigator',
				permissions: ['read', 'write', 'investigate'],
				workspaces: ['ws1', 'ws2'],
			},
		];

		this.mockWorkspaces = [
			{
				id: 'ws1',
				name: 'Case-2024-001: Data Breach Investigation',
				description: 'Investigation of suspected data breach at client company',
				type: 'investigation',
				createdAt: new Date('2024-01-15'),
				updatedAt: new Date(),
				createdBy: 'det.smith@agency.gov',
				isDeleted: false,
				isPublic: false,
				users: [],
				files: [],
				sessions: [],
			},
			{
				id: 'ws2',
				name: 'Case-2024-002: Financial Fraud',
				description: 'Investigation of financial fraud case',
				type: 'investigation',
				createdAt: new Date('2024-02-01'),
				updatedAt: new Date(),
				createdBy: 'det.smith@agency.gov',
				isDeleted: false,
				isPublic: false,
				users: [],
				files: [],
				sessions: [],
			},
		];

		this.mockFiles = [
			{
				id: 'file1',
				workspaceId: 'ws1',
				fileName: 'suspect_laptop.E01',
				path: '/evidence/computers/suspect_laptop.E01',
				fileSize: 500 * 1024 * 1024 * 1024,
				status: 'complete',
				storedFileHash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
				createdAt: new Date('2024-01-16'),
				createdBy: 'forensic.tech@agency.gov',
				collectedBy: 'forensic.tech@agency.gov',
				collectionDate: new Date('2024-01-16'),
				collectedLocation: "Suspect's Office",
				customMetadata: {
					'acquisition.tool': 'FTK Imager',
					'acquisition.version': '4.7.1',
					'device.make': 'Dell',
					'device.model': 'Latitude 7420',
				},
				chainOfCustody: [
					{
						action: 'Evidence Collected',
						actor: 'forensic.tech@agency.gov',
						timestamp: new Date('2024-01-16T08:30:00Z'),
						details: 'Device seized from suspect office under warrant #2024-001',
					},
					{
						action: 'Disk Image Created',
						actor: 'forensic.tech@agency.gov',
						timestamp: new Date('2024-01-16T10:30:00Z'),
						details: 'Full disk image created using FTK Imager v4.7.1',
					},
					{
						action: 'Hash Verification',
						actor: 'Automated System',
						timestamp: new Date('2024-01-16T10:45:00Z'),
						details: 'SHA256 hash verified: a1b2c3d4e5f6789012345678901234567890abcdef',
					},
				],
				processedVersions: [],
				dataSensitivity: 'confidential',
				tags: ['computer-evidence', 'suspect-device', 'laptop', 'primary-evidence'],
				description: 'Primary suspect laptop containing potential evidence of data breach',
			},
			{
				id: 'file2',
				workspaceId: 'ws1',
				fileName: 'network_logs_2024-01.zip',
				path: '/evidence/network/network_logs_2024-01.zip',
				fileSize: 128 * 1024 * 1024,
				status: 'complete',
				storedFileHash: 'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678',
				createdAt: new Date('2024-01-17'),
				createdBy: 'network.admin@client.com',
				collectedBy: 'det.jones@agency.gov',
				collectionDate: new Date('2024-01-17'),
				collectedLocation: 'Client Network Operations Center',
				customMetadata: {
					'source.system': 'Palo Alto Networks Firewall',
					'date.range': '2024-01-01 to 2024-01-31',
					'file.count': '2847',
				},
				chainOfCustody: [
					{
						action: 'Logs Requested',
						actor: 'det.jones@agency.gov',
						timestamp: new Date('2024-01-17T09:00:00Z'),
						details: 'Network logs requested from client IT department',
					},
					{
						action: 'Logs Provided',
						actor: 'network.admin@client.com',
						timestamp: new Date('2024-01-17T11:30:00Z'),
						details: 'Network logs exported and provided on encrypted USB drive',
					},
				],
				processedVersions: [],
				dataSensitivity: 'internal',
				tags: ['network-logs', 'firewall', 'january-2024'],
				description: 'Network firewall logs for January 2024',
			},
		];
	}
}

export default MockApiService;
