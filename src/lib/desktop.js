/** True when running inside the Tauri desktop shell (or VITE_DESKTOP=1). */
export function isDesktopApp() {
	const flag = String(import.meta.env.VITE_DESKTOP || '')
		.trim()
		.toLowerCase();
	if (flag === '1' || flag === 'true' || flag === 'yes') return true;
	if (typeof window === 'undefined') return false;
	return Boolean(window.__TAURI__ || window.__TAURI_INTERNALS__);
}

/** Default Remember me checkbox state (on for web and desktop). */
export function defaultRememberMe() {
	return true;
}

/** Map checkbox state to API remember flag (false only when explicitly unchecked). */
export function effectiveRememberMe(rememberChecked) {
	return rememberChecked !== false;
}
