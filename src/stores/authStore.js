import { create } from 'zustand';

import { api, tokenStore } from '../lib/api';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

function applySession(set, data) {
	if (data.mfa_required) {
		return { mfaRequired: true, mfaToken: data.mfa_token, status: 'mfa_pending', error: null };
	}
	tokenStore.set({ access: data.access, refresh: data.refresh });
	return {
		user: data.user,
		status: 'authenticated',
		mfaRequired: false,
		mfaToken: null,
		error: null
	};
}

/**
 * Global authentication state.
 *
 * Tokens live in localStorage (via tokenStore) so they survive reloads; this
 * store mirrors the current user object and exposes login/register/logout.
 */
export const useAuthStore = create((set, get) => ({
	user: null,
	status: 'idle', // idle | loading | authenticated | unauthenticated | mfa_pending
	error: null,
	mfaRequired: false,
	mfaToken: null,

	isAuthenticated: () => Boolean(get().user),

	async login(email, password) {
		set({ status: 'loading', error: null });
		try {
			const { data } = await api.post('/auth/login/', { email, password });
			set(applySession(set, data));
			if (data.mfa_required) return null;
			return data.user;
		} catch (err) {
			const message = err.response?.data?.detail || 'Invalid email or password.';
			set({ status: 'unauthenticated', error: message });
			throw new Error(message, { cause: err });
		}
	},

	async verifyMfa({ code, recoveryCode }) {
		set({ status: 'loading', error: null });
		try {
			const { data } = await api.post('/auth/mfa/verify/', {
				mfa_token: get().mfaToken,
				code: code || undefined,
				recovery_code: recoveryCode || undefined
			});
			set(applySession(set, data));
			return data.user;
		} catch (err) {
			const message = err.response?.data?.detail || 'Invalid code.';
			set({ status: 'mfa_pending', error: message });
			throw new Error(message, { cause: err });
		}
	},

	async register(payload) {
		set({ status: 'loading', error: null });
		try {
			await api.post('/auth/register/', payload);
			return await get().login(payload.email, payload.password);
		} catch (err) {
			const data = err.response?.data;
			const message =
				data?.email?.[0] || data?.password?.[0] || data?.detail || 'Could not create account.';
			set({ status: 'unauthenticated', error: message });
			throw new Error(message, { cause: err });
		}
	},

	oauthStart(provider) {
		window.location.assign(`${baseURL}/auth/oauth/${provider}/start/`);
	},

	async completeOAuth(code) {
		set({ status: 'loading', error: null });
		try {
			const { data } = await api.post('/auth/oauth/exchange/', { code });
			if (data.mfa_required) {
				set({
					mfaRequired: true,
					mfaToken: data.mfa_token,
					status: 'mfa_pending',
					error: null
				});
				return null;
			}
			set(applySession(set, data));
			return data.user;
		} catch (err) {
			const message = err.response?.data?.detail || 'OAuth sign-in failed.';
			set({ status: 'unauthenticated', error: message });
			throw new Error(message, { cause: err });
		}
	},

	/** Rehydrate the session on app boot if we have a stored token. */
	async bootstrap() {
		if (!tokenStore.access) {
			set({ status: 'unauthenticated' });
			return;
		}
		set({ status: 'loading' });
		try {
			const { data } = await api.get('/auth/me/');
			set({ user: data, status: 'authenticated' });
		} catch {
			tokenStore.clear();
			set({ user: null, status: 'unauthenticated' });
		}
	},

	updateUser(partial) {
		set((s) => ({ user: { ...s.user, ...partial } }));
	},

	clearMfa() {
		set({ mfaRequired: false, mfaToken: null, status: 'unauthenticated', error: null });
	},

	logout() {
		tokenStore.clear();
		set({ user: null, status: 'unauthenticated', mfaRequired: false, mfaToken: null });
	}
}));
