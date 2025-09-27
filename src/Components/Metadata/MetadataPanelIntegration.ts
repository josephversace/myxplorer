import MetadataPanel from './MetadataPanel';

let investigationPanel: MetadataPanel | null = null;

// Initialize the investigation panel when in virtual workspace
export function initializeInvestigationPanel(): void {
	if (!investigationPanel) {
		investigationPanel = new MetadataPanel();
	}
}

// Update panel when file is selected
export function updateInvestigationPanel(filePath: string): void {
	if (!investigationPanel) return;

	// Check if this is a virtual file
	if (filePath.startsWith('workspace://')) {
		// Extract file info from virtual file system
		// This would integrate with your VirtualWorkspaceService
		const fileId = extractFileIdFromPath(filePath);
		if (fileId) {
			// Get file details from your virtual workspace service
			getVirtualFileDetails(fileId).then((file) => {
				investigationPanel?.updateFileDetails(file);
			});
		}
	}
}

function extractFileIdFromPath(virtualPath: string): string | null {
	const match = virtualPath.match(/workspace:\/\/[^\/]+\/file\/(.+)$/);
	return match ? match[1] : null;
}

async function getVirtualFileDetails(fileId: string): Promise<any> {
	// This would call your virtual workspace service
	// Return mock data for now
	return {
		id: fileId,
		fileName: 'suspect_laptop.E01',
		fileSize: 500000000000,
		status: 'complete',
		dataSensitivity: 'confidential',
		collectedBy: 'forensic.tech@agency.gov',
		collectionDate: new Date(),
		collectedLocation: "Suspect's Office",
		description: 'Primary suspect laptop containing potential evidence',
		tags: ['computer-evidence', 'suspect-device', 'laptop'],
		chainOfCustody: [
			{
				action: 'Evidence Collected',
				actor: 'forensic.tech@agency.gov',
				timestamp: new Date(),
				details: 'Device seized under warrant #2024-001',
			},
		],
		customMetadata: {
			'acquisition.tool': 'FTK Imager',
			'device.make': 'Dell',
		},
	};
}
