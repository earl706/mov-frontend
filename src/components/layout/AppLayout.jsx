import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { MfaPromptModal, MfaSetupModal } from '../auth/MfaModals';
import { LoadingScreen } from '../ui';
import { useAuthStore } from '../../stores/authStore';
import { CommandPalette } from './CommandPalette';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { WorkoutTimerEngine } from './WorkoutTimerEngine';

/** Authenticated app shell: sidebar + topbar + routed content. */
export function AppLayout() {
	const showMfaPrompt = useAuthStore((s) => s.user?.show_mfa_prompt);
	const [promptOpen, setPromptOpen] = useState(Boolean(showMfaPrompt));
	const [setupOpen, setSetupOpen] = useState(false);

	return (
		<div className="bg-bg flex h-screen overflow-hidden">
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
			<WorkoutTimerEngine />
			<MfaPromptModal
				open={promptOpen && showMfaPrompt}
				onClose={() => {
					setPromptOpen(false);
					setSetupOpen(true);
				}}
			/>
			<MfaSetupModal open={setupOpen} onClose={() => setSetupOpen(false)} />
		</div>
	);
}
