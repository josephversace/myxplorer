import { updateTheme } from './Components/Theme/theme';
import { windowManager } from './Components/Layout/windowManager';
import createSidebar from './Components/Layout/sidebar';
import Home from './Components/Layout/home';
import { detectDriveInit } from './Components/Drives/drives';
import { OpenDir, OpenInit } from './Components/Open/open';
import { createNewTab, Tab } from './Components/Layout/tab';
import { Shortcut } from './Components/Shortcut/shortcut';
import { SelectInit } from './Components/Files/File Operation/select';
import CLIInformations from './Service/cli';
import Storage from './Service/storage';
import Setting from './Components/Setting/setting';
import ContextMenu from './Components/ContextMenu/contextMenu';
import Hover from './Components/Layout/hover';
import LAZY_LOAD_INIT from './Components/Functions/lazyLoadingImage';
import Infobar from './Components/Layout/infobar';
import Search from './Components/Files/File Operation/search';
import { listenUpdateTheme } from './Service/window';
import { Resizer } from './Components/Layout/resizer';
import { MAIN_BOX_ELEMENT } from './Util/constants';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

const initializeApp = async (): Promise<void> => {
        // Read user preferences
        const _preference = await Storage.get('preference');
        // Initialize folder to open
        const cli = await CLIInformations();
        if (!cli.dirs.length) {
		if ((_preference?.on_startup ?? 'new') === 'new') {
			Home();
		}
		// Initialize Tabs
		await Tab();
	} else {
		OpenDir(cli.dirs[0], cli.is_reveal);
		for (let i = 1; i < cli.dirs.length; i++) {
			createNewTab(cli.dirs[i]);
		}
		// Initialize Tabs
		Tab(cli.is_reveal);
	}
	// Listen to minimize, maximize, exit and reload button
	windowManager();
	// Initialize drive detection
	detectDriveInit();
	// Build sidebar
	createSidebar();
	// Update the page styling
	if (cli.custom_style_sheet) {
		updateTheme('root', cli.custom_style_sheet);
	} else {
		updateTheme('root');
	}
	// Initialize open dir/files listener
	OpenInit();
	// Intialize shortcuts
	Shortcut();
	// Initialize select files listener
	SelectInit();
	// Initialize user preference
	MAIN_BOX_ELEMENT().dataset.hideHiddenFiles = String(_preference?.hideHiddenFiles ?? true);
	// Initialize settings
	Setting();
	// Initialize info bar
	Infobar();
	// Initialize context menu
	ContextMenu();
	// Initialize hover handler
	Hover();
	// Initialize search feature
	Search();
	// Initialize lazy loading image handler (for performance)
	LAZY_LOAD_INIT();
	// Initialize sidebar resizer
	Resizer();
	// Listen to update theme event
        listenUpdateTheme(async () => {
                await Storage.get('theme', true);
                await Storage.get('extensions', true);
                updateTheme('*');
        });
};

// Wait DOM Loaded to be loaded
document.addEventListener('DOMContentLoaded', () => {
        let hasInitialized = false;

        const initializeOnce = async () => {
                if (hasInitialized) {
                        return;
                }

                hasInitialized = true;

                try {
                        await initializeApp();
                } catch (error) {
                        hasInitialized = false;
                        throw error;
                }
        };

        const loginOverlay = document.getElementById('login-overlay');
        const loginForm = document.getElementById('login-form') as HTMLFormElement | null;

        if (!loginOverlay || !loginForm) {
                void initializeOnce();
                return;
        }

        document.body.classList.add('login-required');

        const usernameInput = document.getElementById('login-username') as HTMLInputElement | null;
        const passwordInput = document.getElementById('login-password') as HTMLInputElement | null;
        const submitButton = loginForm.querySelector<HTMLButtonElement>('button[type="submit"]');
        const errorMessageElement = document.getElementById('login-error');

        let cleanupTimeout: number | undefined;
        let hasCleanedUp = false;

        const setSubmittingState = (isSubmitting: boolean) => {
                if (!submitButton) {
                        return;
                }

                submitButton.disabled = isSubmitting;
                submitButton.setAttribute('aria-busy', String(isSubmitting));
        };

        const cleanup = () => {
                if (hasCleanedUp) {
                        return;
                }
                hasCleanedUp = true;

                if (cleanupTimeout !== undefined) {
                        window.clearTimeout(cleanupTimeout);
                }

                loginForm.removeEventListener('submit', handleSubmit);
                loginOverlay.removeEventListener('transitionend', handleTransitionEnd);
                usernameInput?.removeEventListener('input', handleFieldInput);
                passwordInput?.removeEventListener('input', handleFieldInput);

                document.body.classList.remove('login-required');
                loginOverlay.remove();
        };

        const hideOverlay = () => {
                loginOverlay.classList.add('login-overlay--hidden');
                loginOverlay.setAttribute('aria-hidden', 'true');

                cleanupTimeout = window.setTimeout(() => {
                        cleanup();
                }, 450);
        };

        const showError = (message: string) => {
                if (errorMessageElement) {
                        errorMessageElement.textContent = message;
                        errorMessageElement.classList.add('login-error--visible');
                }
        };

        const clearError = () => {
                if (errorMessageElement) {
                        errorMessageElement.textContent = '';
                        errorMessageElement.classList.remove('login-error--visible');
                }
        };

        const handleFieldInput = () => {
                clearError();
        };

        const handleTransitionEnd = (event: TransitionEvent) => {
                if (event.target !== loginOverlay || event.propertyName !== 'opacity') {
                        return;
                }

                cleanup();
        };

        const handleSubmit = async (event: SubmitEvent) => {
                event.preventDefault();
                const username = usernameInput?.value.trim() ?? '';
                const password = passwordInput?.value ?? '';

                if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
                        clearError();
                        setSubmittingState(true);
                        hideOverlay();

                        try {
                                await initializeOnce();
                        } catch (error) {
                                setSubmittingState(false);
                                loginOverlay.classList.remove('login-overlay--hidden');
                                loginOverlay.setAttribute('aria-hidden', 'false');
                                showError('Something went wrong while loading the app. Please try again.');
                                console.error('Failed to initialize application after login', error);
                                return;
                        }

                        return;
                }

                showError('Invalid username or password');
                if (passwordInput) {
                        passwordInput.value = '';
                        passwordInput.focus();
                }
        };

        loginForm.addEventListener('submit', handleSubmit);
        loginOverlay.addEventListener('transitionend', handleTransitionEnd);
        usernameInput?.addEventListener('input', handleFieldInput);
        passwordInput?.addEventListener('input', handleFieldInput);

        if (usernameInput) {
                usernameInput.focus();
        }
});
