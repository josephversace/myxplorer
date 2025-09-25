import { writeSidebarDriveItems as writeDriveItems } from '../Drives/drives';
import { updateTheme } from '../Theme/theme';
import fileThumbnail from '../Thumbnail/thumbnail';
import Translate from '../I18n/i18n';
import FavoritesAPI from '../../Service/favorites';
import DirectoryAPI from '../../Service/directory';
import Storage from '../../Service/storage';
import IsValid from '../Functions/validChecker';
import defaultFavorites from '../Favorites/defaultFavorites';
import FileAPI from '../../Service/files';
import { OpenDir } from '../Open/open';
interface Favorites {
	name: string;
	path: string;
}

let FavoritesData: FavoritesAPI;

let _defaultFavorites: Favorites[] = [];
const isDefaultFavorite = async (filePath: string) => {
	if (!IsValid(_defaultFavorites)) _defaultFavorites = await defaultFavorites();
	return _defaultFavorites.some((favorite) => favorite.path === filePath);
};

/**
 * Write favorite items to sidebar's dropdown list
 * @param {Array} favorites - Array of favorites
 * @returns {Promise<void>}
 */
const writeFavoriteItems = async (favorites: Favorites[]): Promise<void> => {
        const sidebarCollapseClass = 'sidebar-nav-dropdown-collapsed';
        const sidebar = await Storage.get('sidebar');
        let content = '';
        for (const favorite of favorites) {
		if (!favorite.path) continue;
		const exists = await new FileAPI(favorite.path).exists();
		const isDefault = await isDefaultFavorite(favorite.path);
		const isPseudo = favorite.path.startsWith('xplorer://');
		if (!exists && !isDefault && !isPseudo) continue;
		const isdir = isPseudo || (await new DirectoryAPI(favorite.path).isDir());
		const iconPath = exists && !isDefault ? favorite.path : favorite.name;
		let iconCategory = 'sidebar';
		if (!isDefault && favorite.path !== 'xplorer://Home') {
			iconCategory = isdir ? 'folder' : 'file';
		}
		content +=
			`<span data-path="${favorite.path}" data-isdir="${isdir}" class="sidebar-hover-effect sidebar-nav-item favorite-item">\n` +
			`  <div class="sidebar-icon">` +
			`    <img src="${await fileThumbnail(iconPath, iconCategory, false)}" icon">\n` +
			`  </div>\n` +
			`  <span class="sidebar-text">${await Translate(favorite.name)}</span>\n` +
			`</span>\n`;
	}
	const favoriteElement = document.querySelector('#sidebar-favorites');
	const favoriteBtnText = favoriteElement.querySelector('.sidebar-text');
	const favoriteList = favoriteElement.querySelector('.sidebar-nav-list');
	favoriteBtnText.textContent = await Translate('Favorites');
	favoriteList.innerHTML = content;
        if (sidebar?.hideSection?.favorites) {
                favoriteElement.classList.add(sidebarCollapseClass);
        }
};

const addVirtualWorkspaceNavigation = (): void => {
        const sidebarElement =
                document.querySelector<HTMLElement>('.sidebar') ??
                document.querySelector<HTMLElement>('.sidebar-nav') ??
                document.querySelector<HTMLElement>('[class*="sidebar"]');

        if (!sidebarElement || sidebarElement.querySelector('.workspace-nav-section')) return;

        const workspaceSection = document.createElement('div');
        workspaceSection.className = 'workspace-nav-section';
        workspaceSection.innerHTML = `
                <div class="nav-section-header">
                        <span class="nav-icon">🗂️</span>
                        <span>IIM Workspaces</span>
                </div>
                <div class="nav-items">
                        <div class="nav-item" data-path="workspace://list">
                                <span class="nav-icon">📁</span>
                                <span>All Workspaces</span>
                        </div>
                        <div class="nav-item" data-path="workspace://recent">
                                <span class="nav-icon">🕒</span>
                                <span>Recent</span>
                        </div>
                </div>
        `;

        workspaceSection.addEventListener('click', (event) => {
                const target = event.target as HTMLElement;
                const navItem = target.closest<HTMLElement>('.nav-item');
                const path = navItem?.dataset?.path;
                if (path) OpenDir(path);
        });

        sidebarElement.insertBefore(workspaceSection, sidebarElement.firstChild);
};

/**
 * Sidebar initializer function
 * @returns {Promise<void>}
 */
const createSidebar = async (): Promise<void> => {
	if (!FavoritesData) {
		FavoritesData = new FavoritesAPI();
		await FavoritesData.build();
	}

	const favorites = await Storage.get('favorites');
	const _favorites = IsValid(favorites?.favorites)
		? favorites.favorites
		: [
				{ name: 'Home', path: 'xplorer://Home' },
				{ name: 'Recent', path: 'xplorer://Recent' },
				{ name: 'Desktop', path: FavoritesData.DESKTOP_PATH },
				{ name: 'Documents', path: FavoritesData.DOCUMENT_PATH },
				{ name: 'Downloads', path: FavoritesData.DOWNLOAD_PATH },
				{ name: 'Pictures', path: FavoritesData.PICTURE_PATH },
				{ name: 'Music', path: FavoritesData.MUSIC_PATH },
				{ name: 'Videos', path: FavoritesData.VIDEO_PATH },
				{ name: 'Trash', path: 'xplorer://Trash' }, // eslint-disable-next-line no-mixed-spaces-and-tabs
		  ];
        await Promise.all([writeFavoriteItems(_favorites), writeDriveItems()]);
        updateTheme('root');
        addVirtualWorkspaceNavigation();

        const settingBtnText = document.querySelector('#sidebar-setting-btn span');
        settingBtnText.textContent = await Translate('Settings');

	// Collapse section
	const sidebarElement = document.querySelector<HTMLElement>('.sidebar');
	sidebarElement.querySelectorAll('.sidebar-nav-toggle').forEach((btn) => {
		btn.addEventListener('click', async ({ target }) => {
			const sidebarCollapseClass = 'sidebar-nav-dropdown-collapsed';
			const sidebarNavItem = (target as HTMLElement).parentElement;
			sidebarNavItem.classList.toggle(sidebarCollapseClass);
			const sidebar = (await Storage.get('sidebar')) || {};
			const collapsed = sidebarNavItem.classList.contains(sidebarCollapseClass);
			(sidebar.hideSection ||= {})[sidebarNavItem.dataset.section] = collapsed;
			Storage.set('sidebar', sidebar);
		});
	});
};

export default createSidebar;
