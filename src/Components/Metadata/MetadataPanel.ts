import { GET_WORKSPACE_ELEMENT } from '../../Util/constants';
import type { VirtualFile } from '../../Service/iim/types';

class MetadataPanel {
	private panelElement: HTMLElement | null = null;
	private isVisible = false;
	private currentFile: VirtualFile | null = null;

	constructor() {
		this.createPanel();
		this.attachToWorkspace();
	}

	private createPanel(): void {
		this.panelElement = document.createElement('div');
		this.panelElement.className = 'investigation-panel';
		this.panelElement.innerHTML = `
            <div class="investigation-panel-header">
                <div class="panel-tabs">
                    <button class="panel-tab active" data-tab="overview">Overview</button>
                    <button class="panel-tab" data-tab="custody">Chain of Custody</button>
                    <button class="panel-tab" data-tab="insights">AI Insights</button>
                    <button class="panel-tab" data-tab="metadata">Metadata</button>
                </div>
                <button class="panel-toggle" title="Toggle Investigation Panel">
                    <span class="panel-toggle-icon">◀</span>
                </button>
            </div>
            <div class="investigation-panel-content">
                <div class="tab-content active" data-content="overview">
                    <div class="panel-section">
                        <h3>File Overview</h3>
                        <div id="file-overview">
                            <p class="empty-state">Select a file to view investigation details</p>
                        </div>
                    </div>
                </div>
                <div class="tab-content" data-content="custody">
                    <div class="panel-section">
                        <h3>Chain of Custody</h3>
                        <div id="chain-of-custody">
                            <p class="empty-state">No custody information available</p>
                        </div>
                    </div>
                </div>
                <div class="tab-content" data-content="insights">
                    <div class="panel-section">
                        <h3>AI Analysis</h3>
                        <div id="ai-insights">
                            <p class="empty-state">No AI insights available</p>
                        </div>
                    </div>
                </div>
                <div class="tab-content" data-content="metadata">
                    <div class="panel-section">
                        <h3>Technical Metadata</h3>
                        <div id="technical-metadata">
                            <p class="empty-state">No metadata available</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

		// Add event listeners
		this.setupEventListeners();
	}

	private setupEventListeners(): void {
		if (!this.panelElement) return;

		// Tab switching
		const tabs = this.panelElement.querySelectorAll('.panel-tab');
		tabs.forEach((tab) => {
			tab.addEventListener('click', (e) => {
				const tabName = (e.target as HTMLElement).dataset.tab;
				this.switchTab(tabName);
			});
		});

		// Panel toggle
		const toggleBtn = this.panelElement.querySelector('.panel-toggle');
		toggleBtn?.addEventListener('click', () => {
			this.toggleVisibility();
		});
	}

	private switchTab(tabName: string): void {
		if (!this.panelElement) return;

		// Update active tab
		this.panelElement.querySelectorAll('.panel-tab').forEach((tab) => {
			tab.classList.remove('active');
		});
		this.panelElement.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

		// Update active content
		this.panelElement.querySelectorAll('.tab-content').forEach((content) => {
			content.classList.remove('active');
		});
		this.panelElement.querySelector(`[data-content="${tabName}"]`)?.classList.add('active');
	}

	private attachToWorkspace(): void {
		const workspace = GET_WORKSPACE_ELEMENT(1);
		if (workspace && this.panelElement) {
			workspace.appendChild(this.panelElement);
			workspace.classList.add('workspace-with-investigation-panel');
			this.isVisible = true;
		}
	}

	public toggleVisibility(): void {
		if (!this.panelElement) return;

		this.isVisible = !this.isVisible;
		const workspace = GET_WORKSPACE_ELEMENT(1);

		if (this.isVisible) {
			this.panelElement.classList.remove('hidden');
			workspace?.classList.add('workspace-with-investigation-panel');
			this.panelElement.querySelector('.panel-toggle-icon').textContent = '◀';
		} else {
			this.panelElement.classList.add('hidden');
			workspace?.classList.remove('workspace-with-investigation-panel');
			this.panelElement.querySelector('.panel-toggle-icon').textContent = '▶';
		}
	}

	public updateFileDetails(file: VirtualFile): void {
		this.currentFile = file;
		this.updateOverview(file);
		this.updateChainOfCustody(file);
		this.updateAIInsights(file);
		this.updateMetadata(file);
	}

	private updateOverview(file: VirtualFile): void {
		const overviewEl = document.getElementById('file-overview');
		if (!overviewEl) return;

		overviewEl.innerHTML = `
            <div class="file-summary">
                <div class="file-icon">📄</div>
                <div class="file-details">
                    <h4>${file.fileName}</h4>
                    <p class="file-size">${this.formatFileSize(file.fileSize)}</p>
                    <p class="file-type">${this.getFileType(file.fileName)}</p>
                </div>
            </div>
            <div class="file-properties">
                <div class="property">
                    <label>Status:</label>
                    <span class="status-badge status-${file.status}">${file.status}</span>
                </div>
                <div class="property">
                    <label>Sensitivity:</label>
                    <span class="sensitivity-badge sensitivity-${file.dataSensitivity}">${file.dataSensitivity}</span>
                </div>
                <div class="property">
                    <label>Collected By:</label>
                    <span>${file.collectedBy}</span>
                </div>
                <div class="property">
                    <label>Collection Date:</label>
                    <span>${new Date(file.collectionDate).toLocaleDateString()}</span>
                </div>
                <div class="property">
                    <label>Location:</label>
                    <span>${file.collectedLocation}</span>
                </div>
            </div>
            ${
				file.description
					? `
                <div class="file-description">
                    <h5>Description</h5>
                    <p>${file.description}</p>
                </div>
            `
					: ''
			}
            ${
				file.tags && file.tags.length > 0
					? `
                <div class="file-tags">
                    <h5>Tags</h5>
                    <div class="tags">
                        ${file.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                </div>
            `
					: ''
			}
        `;
	}

        private updateChainOfCustody(file: VirtualFile): void {
                const custodyEl = this.panelElement?.querySelector('#chain-of-custody') as HTMLElement | null;
                if (!custodyEl) {
                        return;
                }

                if (!file.chainOfCustody?.length) {
                        custodyEl.innerHTML = '<p class="empty-state">No chain of custody information available</p>';
                        return;
                }

		const custodyHtml = file.chainOfCustody
			.map(
				(entry) => `
            <div class="custody-entry">
                <div class="custody-timestamp">
                    ${new Date(entry.timestamp).toLocaleString()}
                </div>
                <div class="custody-details">
                    <div class="custody-action">${entry.action}</div>
                    <div class="custody-actor">by ${entry.actor}</div>
                    ${entry.details ? `<div class="custody-notes">${entry.details}</div>` : ''}
                </div>
            </div>
        `
			)
			.join('');

		custodyEl.innerHTML = custodyHtml;
	}

	private updateAIInsights(file: VirtualFile): void {
		const insightsEl = document.getElementById('ai-insights');
		if (!insightsEl) return;

		// Placeholder for AI insights - replace with actual AI analysis data
		const mockInsights = [
			{
				type: 'classification',
				title: 'File Classification',
				content: 'This appears to be a forensic disk image containing potential evidence.',
				confidence: 0.95,
			},
			{
				type: 'content',
				title: 'Content Analysis',
				content: 'Analysis indicates presence of deleted files and system artifacts.',
				confidence: 0.87,
			},
			{
				type: 'risk',
				title: 'Risk Assessment',
				content: 'High priority for investigation due to timestamp relevance.',
				confidence: 0.78,
			},
		];

		const insightsHtml = mockInsights
			.map(
				(insight) => `
            <div class="insight-card">
                <div class="insight-header">
                    <span class="insight-title">${insight.title}</span>
                    <span class="confidence-badge">${Math.round(insight.confidence * 100)}%</span>
                </div>
                <div class="insight-content">${insight.content}</div>
            </div>
        `
			)
			.join('');

		insightsEl.innerHTML = insightsHtml;
	}

	private updateMetadata(file: VirtualFile): void {
		const metadataEl = document.getElementById('technical-metadata');
		if (!metadataEl) return;

		const metadata = [
			{ label: 'File Hash (SHA-256)', value: file.storedFileHash },
			{ label: 'Created', value: new Date(file.createdAt).toLocaleString() },
			{ label: 'Modified', value: file.updatedAt ? new Date(file.updatedAt).toLocaleString() : 'N/A' },
			{ label: 'File Size', value: this.formatFileSize(file.fileSize) },
			{ label: 'Workspace ID', value: file.workspaceId },
			...Object.entries(file.customMetadata || {}).map(([key, value]) => ({
				label: key.replace(/[._]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
				value: value,
			})),
		];

		const metadataHtml = metadata
			.map(
				(item) => `
            <div class="metadata-row">
                <label>${item.label}:</label>
                <span class="metadata-value">${item.value}</span>
            </div>
        `
			)
			.join('');

		metadataEl.innerHTML = metadataHtml;
	}

	private formatFileSize(bytes: number): string {
		const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
		if (bytes === 0) return '0 Bytes';
		const i = Math.floor(Math.log(bytes) / Math.log(1024));
		return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
	}

	private getFileType(fileName: string): string {
		const ext = fileName.split('.').pop()?.toLowerCase();
		const typeMap: Record<string, string> = {
			e01: 'EnCase Evidence File',
			dd: 'Disk Image',
			img: 'Disk Image',
			raw: 'Raw Disk Image',
			zip: 'Compressed Archive',
			pdf: 'PDF Document',
			doc: 'Word Document',
			docx: 'Word Document',
			txt: 'Text File',
			log: 'Log File',
		};
		return typeMap[ext || ''] || 'Unknown File Type';
	}
}
