import { Drives } from '../Drives/drives';
import Favorites from '../Favorites/favorites';
import { updateTheme } from '../Theme/theme';
import { startLoading, stopLoading } from '../Functions/Loading/loading';
import OS from '../../Service/platform';
import DirectoryAPI from '../../Service/directory';
import FavoritesAPI from '../../Service/favorites';
import displayFiles from '../Open/displayFiles';
import { LOAD_IMAGE } from '../Functions/lazyLoadingImage';
import { GET_TAB_ELEMENT } from '../../Util/constants';
import { OpenDir } from '../Open/open';
let platform: string;
(async () => {
	platform = await OS();
})();

let favoritesData: FavoritesAPI;

const addWorkspaceShortcuts = (root: HTMLElement): void => {
        const homeContainer =
                root.querySelector<HTMLElement>('.home') ??
                root.querySelector<HTMLElement>('.home-main') ??
                root.querySelector<HTMLElement>('[class*="home"]') ??
                root;

        if (homeContainer.querySelector('.workspace-shortcuts')) return;

        const shortcutsSection = document.createElement('div');
        shortcutsSection.className = 'workspace-shortcuts';
        shortcutsSection.innerHTML = `
                <div class="shortcuts-header">
                        <h2>Investigation Workspaces</h2>
                </div>
                <div class="shortcuts-grid">
                        <div class="shortcut-item" data-path="workspace://list">
                                <div class="shortcut-icon">🗂️</div>
                                <div class="shortcut-title">Browse Workspaces</div>
                                <div class="shortcut-desc">View all investigation cases</div>
                        </div>
                        <div class="shortcut-item" data-path="workspace://recent">
                                <div class="shortcut-icon">🕒</div>
                                <div class="shortcut-title">Recent Workspaces</div>
                                <div class="shortcut-desc">Recently accessed cases</div>
                        </div>
                </div>
        `;

        shortcutsSection.addEventListener('click', (event) => {
                const target = event.target as HTMLElement;
                const shortcut = target.closest<HTMLElement>('.shortcut-item');
                const path = shortcut?.dataset?.path;
                if (path) OpenDir(path);
        });

        homeContainer.appendChild(shortcutsSection);
};

/**
 * Create contents for home page
 * @returns {Promise<void>}
 */
const Home = async (): Promise<void> => {
	startLoading();
	// Get the main element
	const MAIN_ELEMENT = GET_TAB_ELEMENT();
        if (MAIN_ELEMENT.classList.contains('empty-dir-notification')) {
                MAIN_ELEMENT.classList.remove('empty-dir-notification'); // Remove class if exist
        }
	const favorites = await Favorites();
	const drives = await Drives();
	MAIN_ELEMENT.innerHTML = favorites + drives;
	if (platform !== 'win32') {
		if (!favoritesData?.HOMEDIR_PATH) {
			favoritesData = new FavoritesAPI();
			await favoritesData.build();
		}
		const directoryInfo = new DirectoryAPI(favoritesData.HOMEDIR_PATH);
		const homeElement = document.createElement('section');
		homeElement.classList.add('home-section');
		homeElement.innerHTML = '<h1 class="section-title">Files</section>';

		const homeFiles = await directoryInfo.getFiles();
		const homeSection = await displayFiles(homeFiles.files, favoritesData.HOMEDIR_PATH, homeElement);
		// Update the content in the main page ...
		MAIN_ELEMENT.innerHTML = favorites + drives;
		MAIN_ELEMENT.appendChild(homeSection);

		// And also the theme :)
		updateTheme('favorites');
		updateTheme('grid');
		stopLoading();
	}
        updateTheme('favorites');
        addWorkspaceShortcuts(MAIN_ELEMENT);
        stopLoading();
	LOAD_IMAGE();
};

export default Home;
