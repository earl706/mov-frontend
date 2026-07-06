import axios from 'axios'

// Token persistence keys. Kept in localStorage so a refresh survives reloads.
const ACCESS_KEY = 'mov.access'
const REFRESH_KEY = 'mov.refresh'

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set({ access, refresh }) {
    if (access) localStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

export const api = axios.create({ baseURL })

// Attach the bearer token to every request.
api.interceptors.request.use((config) => {
  const token = tokenStore.access
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Transparent refresh: on a 401, try once to mint a new access token using the
// refresh token, then replay the original request. A shared promise prevents a
// stampede of refresh calls when several requests fail at once.
let refreshPromise = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const status = error.response?.status
    const isAuthCall = original?.url?.includes('/auth/')

    if (status === 401 && !original._retry && !isAuthCall && tokenStore.refresh) {
      original._retry = true
      try {
        refreshPromise =
          refreshPromise ||
          axios.post(`${baseURL}/auth/refresh/`, { refresh: tokenStore.refresh })
        const { data } = await refreshPromise
        refreshPromise = null
        tokenStore.set({ access: data.access })
        original.headers.Authorization = `Bearer ${data.access}`
        return api(original)
      } catch (refreshError) {
        refreshPromise = null
        tokenStore.clear()
        // Hard redirect to login; the auth store will pick up the empty token.
        if (typeof window !== 'undefined') window.location.assign('/login')
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  }
)

// Small helper so feature hooks stay terse: get('/tasks/') -> data.
export const get = (url, config) => api.get(url, config).then((r) => r.data)
export const post = (url, body, config) => api.post(url, body, config).then((r) => r.data)
export const patch = (url, body, config) => api.patch(url, body, config).then((r) => r.data)
export const put = (url, body, config) => api.put(url, body, config).then((r) => r.data)
export const del = (url, config) => api.delete(url, config).then((r) => r.data)
