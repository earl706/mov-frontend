import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'

import { LoadingScreen } from '../ui'
import { CommandPalette } from './CommandPalette'
import { FocusTimerEngine } from './FocusTimerEngine'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

/** Authenticated app shell: sidebar + topbar + routed content. */
export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto" id="main-content">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
            <Suspense fallback={<LoadingScreen />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      <CommandPalette />
      <FocusTimerEngine />
    </div>
  )
}
