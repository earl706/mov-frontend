import { create } from 'zustand'

/** Ephemeral UI state: sidebar (mobile) and the global command/search palette. */
export const useUIStore = create((set) => ({
  sidebarOpen: false,
  paletteOpen: false,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
}))
