import { create } from 'zustand'

import { api, tokenStore } from '../lib/api'

/**
 * Global authentication state.
 *
 * Tokens live in localStorage (via tokenStore) so they survive reloads; this
 * store mirrors the current user object and exposes login/register/logout.
 */
export const useAuthStore = create((set, get) => ({
  user: null,
  status: 'idle', // idle | loading | authenticated | unauthenticated
  error: null,

  isAuthenticated: () => Boolean(get().user),

  async login(email, password) {
    set({ status: 'loading', error: null })
    try {
      const { data } = await api.post('/auth/login/', { email, password })
      tokenStore.set({ access: data.access, refresh: data.refresh })
      set({ user: data.user, status: 'authenticated' })
      return data.user
    } catch (err) {
      const message = err.response?.data?.detail || 'Invalid email or password.'
      set({ status: 'unauthenticated', error: message })
      throw new Error(message, { cause: err })
    }
  },

  async register(payload) {
    set({ status: 'loading', error: null })
    try {
      await api.post('/auth/register/', payload)
      // Immediately log the new user in for a smooth onboarding flow.
      return await get().login(payload.email, payload.password)
    } catch (err) {
      const data = err.response?.data
      const message =
        data?.email?.[0] || data?.password?.[0] || data?.detail || 'Could not create account.'
      set({ status: 'unauthenticated', error: message })
      throw new Error(message, { cause: err })
    }
  },

  /** Rehydrate the session on app boot if we have a stored token. */
  async bootstrap() {
    if (!tokenStore.access) {
      set({ status: 'unauthenticated' })
      return
    }
    set({ status: 'loading' })
    try {
      const { data } = await api.get('/auth/me/')
      set({ user: data, status: 'authenticated' })
    } catch {
      tokenStore.clear()
      set({ user: null, status: 'unauthenticated' })
    }
  },

  updateUser(partial) {
    set((s) => ({ user: { ...s.user, ...partial } }))
  },

  logout() {
    tokenStore.clear()
    set({ user: null, status: 'unauthenticated' })
  },
}))
