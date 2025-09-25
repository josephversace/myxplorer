import joinPath from '../Components/Functions/path/joinPath';
import normalizeSlash from '../Components/Functions/path/normalizeSlash';
import type FileMetaData from '../Typings/fileMetaData';
import type { UnlistenFn } from '@tauri-apps/api/event';
import isTauri from '../Util/is-tauri';
import { CHECK_EXIST_ENDPOINT, CHECK_ISDIR_ENDPOINT, GET_DIR_SIZE_ENDPOINT, READ_DIR_ENDPOINT } from '../Util/constants';
import type { DirectoryData } from './types/directory';
import {
        getVirtualWorkspaceService,
        isVirtualPath as isVirtualWorkspacePath,
        setVirtualWorkspaceService,
        VirtualWorkspaceService,
} from './iim/virtualFileSystem';
let listener: UnlistenFn;
let searchListener: UnlistenFn;
/**
 * Invoke Rust command to read information of a directory
 */
class DirectoryAPI {
        readonly dirName: string;
        readonly parentDir: string;
        files: FileMetaData[];
        private static virtualService: VirtualWorkspaceService | null = null;
        constructor(dirName: string, parentDir?: string) {
                if (parentDir) {
                        this.parentDir = normalizeSlash(parentDir);
                        this.dirName = normalizeSlash(joinPath(parentDir, dirName));
                } else this.dirName = normalizeSlash(dirName);
        }
        static configureVirtualWorkspace(service: VirtualWorkspaceService): void {
                setVirtualWorkspaceService(service);
                DirectoryAPI.virtualService = service;
        }
        private static getVirtualService(): VirtualWorkspaceService {
                if (!DirectoryAPI.virtualService) {
                        DirectoryAPI.virtualService = getVirtualWorkspaceService();
                }
                return DirectoryAPI.virtualService;
        }
        private get isVirtual(): boolean {
                return isVirtualWorkspacePath(this.dirName);
        }
        /**
         * Get files inside a directory
         * @returns {Promise<DirectoryData>}
         */
        getFiles(): Promise<DirectoryData> {
                return new Promise((resolve, reject) => {
                        if (this.isVirtual) {
                                DirectoryAPI.getVirtualService()
                                        .listDirectory(this.dirName)
                                        .then((data) => {
                                                this.files = data.files;
                                                resolve(data);
                                        })
                                        .catch((error) => reject(error));
                                return;
                        }
                        if (isTauri) {
                                const { invoke } = require('@tauri-apps/api');
                                invoke('read_directory', { dir: this.dirName })
                                        .then((files: DirectoryData) => {
                                                this.files = files.files;
						resolve(files);
					})
					.catch((err: string) => {
						reject(err);
					});
			} else {
				fetch(READ_DIR_ENDPOINT + this.dirName, { method: 'GET' }).then((res) => {
					res.json()
						.then((files: DirectoryData) => {
							this.files = files.files;
							resolve(files);
						})
						.catch((err) => {
							console.error(err);
						});
				});
			}
		});
	}
	/**
	 * Check if given path is directory
	 * @returns {Promise<boolean>}
	 */
        async isDir(): Promise<boolean> {
                if (this.isVirtual) {
                        return DirectoryAPI.getVirtualService().isDirectory(this.dirName);
                }
                return new Promise((resolve) => {
                        if (isTauri) {
                                const { invoke } = require('@tauri-apps/api');
                                invoke('is_dir', { path: this.dirName }).then((result: boolean) => resolve(result));
                        } else {
                                fetch(CHECK_ISDIR_ENDPOINT + this.dirName, { method: 'GET' })
					.then((response) => response.json())
					.then((result: boolean) => resolve(result));
			}
		});
	}
	/**
	 * Return true if folder exist
	 * @returns {boolean}
	 */
        async exists(): Promise<boolean> {
                if (this.isVirtual) {
                        return DirectoryAPI.getVirtualService().pathExists(this.dirName);
                }
                if (isTauri) {
                        const { invoke } = require('@tauri-apps/api');
                        return await invoke('file_exist', { filePath: this.dirName });
                } else {
                        const exists = await (await fetch(CHECK_EXIST_ENDPOINT + this.dirName, { method: 'GET' })).json();
			return exists;
		}
	}
	/**
	 * Create dir if not exists
	 * @returns {any}
	 */
        async mkdir(): Promise<boolean> {
                if (this.isVirtual) {
                        console.warn('mkdir is not supported for virtual workspaces yet');
                        return false;
                }
                if (isTauri) {
                        const { invoke } = require('@tauri-apps/api');
                        return await invoke('create_dir_recursive', {
                                dirPath: this.dirName,
                        });
		}
	}

	/**
	 * Listen to changes in a directory
	 * @param {() => void} cb - callback
	 * @returns {any}
	 */
        async listen(cb: () => void): Promise<void> {
                if (this.isVirtual) {
                        console.warn('Directory change listeners are not supported for virtual workspaces yet');
                        return;
                }
                if (isTauri) {
                        const { invoke } = require('@tauri-apps/api');
                        invoke('listen_dir', { dir: this.dirName });
                        const { getCurrent } = require('@tauri-apps/api/window');
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
			listener = await getCurrent().listen('changes', (e: any) => {
				console.log(e);
				cb();
			});
		}
	}
	/**
	 * Unlisten to previous listener
	 * @returns {Promise<void>}
	 */
        async unlisten(): Promise<void> {
                if (this.isVirtual) {
                        return;
                }
                if (isTauri) {
                        const { getCurrent } = require('@tauri-apps/api/window');
                        listener?.();
                        return getCurrent().emit('unlisten_dir');
                }
	}

	/**
	 * Get size of a directory
	 * @returns {Promise<number>}
	 */
        async getSize(): Promise<number> {
                if (this.isVirtual) {
                        return DirectoryAPI.getVirtualService().getSize(this.dirName);
                }
                if (isTauri) {
                        const { invoke } = require('@tauri-apps/api');
                        return await invoke('get_dir_size', { dir: this.dirName });
                } else {
			const size = await (await fetch(GET_DIR_SIZE_ENDPOINT + this.dirName, { method: 'GET' })).json();
			return size;
		}
	}

	/**
	 * Stop all searching progress
	 * @returns {Promise<boolean>}
	 */
        async stopSearching(): Promise<boolean> {
                if (this.isVirtual) {
                        return false;
                }
                if (isTauri) {
                        const { getCurrent } = require('@tauri-apps/api/window');

                        const listenerExist = searchListener !== null && searchListener !== undefined;
                        searchListener?.();
			await getCurrent().emit('unsearch');
			return listenerExist;
		}
	}

	/**
	 * Search for a file/folder in a directory
	 * @param {string} pattern - glob pattern
	 * @param {FileMetaData[] => void} callback - progress callback
	 * @returns {any}
	 */
        async search(pattern: string, callback: (partialFound: FileMetaData[]) => void): Promise<FileMetaData[]> {
                if (this.isVirtual) {
                        const service = DirectoryAPI.getVirtualService();
                        const results = await service.search(this.dirName, pattern);
                        callback(results);
                        return results;
                }
                if (isTauri) {
                        const { getCurrent } = require('@tauri-apps/api/window');
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        searchListener = await getCurrent().listen('search_partial_result', (res: any) => {
                                if (searchListener !== null && searchListener !== undefined) callback(res.payload as FileMetaData[]);
			});
			const { invoke } = require('@tauri-apps/api');
			const res = await invoke('search_in_dir', { dirPath: this.dirName, pattern });
			await this.stopSearching();
			searchListener = null;
			return res as FileMetaData[];
		}
	}
}

export default DirectoryAPI;
