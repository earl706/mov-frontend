import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Menu, Search, Timer } from 'lucide-react';

import { get } from '../../lib/api';
import { formatTimerDisplay } from '../../lib/focusTimerFormat';
import { cn } from '../../lib/format';
import { useAuthStore } from '../../stores/authStore';
import {
	selectIntervalActive,
	selectOnBreak,
	useFocusTimerStore
} from '../../stores/focusTimerStore';
import { useUIStore } from '../../stores/uiStore';
import { Avatar, Button } from '../ui';
import { ThemeToggle } from './ThemeToggle';

export function Topbar() {
	const navigate = useNavigate();
	const user = useAuthStore((s) => s.user);
	const { toggleSidebar, openPalette } = useUIStore();
	const running = useFocusTimerStore((s) => s.running);
	const remainingSeconds = useFocusTimerStore((s) => s.remainingSeconds);
	const sessionActive = useFocusTimerStore(selectIntervalActive);
	const onBreak = useFocusTimerStore(selectOnBreak);

	const timerLabel = sessionActive
		? onBreak
			? running
				? `Break running, ${formatTimerDisplay(remainingSeconds)} remaining`
				: `Break paused, ${formatTimerDisplay(remainingSeconds)} remaining`
			: running
				? `Focus timer running, ${formatTimerDisplay(remainingSeconds)} remaining`
				: `Focus timer paused, ${formatTimerDisplay(remainingSeconds)} remaining`
		: 'Focus timer inactive';

	const mobileTimerClass = cn(
		'relative inline-flex cursor-pointer items-center justify-center rounded-xl border p-2 transition-colors sm:hidden',
		onBreak && running && 'border-success/40 bg-success/10 text-success',
		onBreak && sessionActive && !running && 'border-success/40 bg-success/10 text-success',
		!onBreak && running && 'border-primary/40 bg-primary/10 text-primary',
		!onBreak && sessionActive && !running && 'border-warning/40 bg-warning/10 text-warning',
		!sessionActive && 'border-line bg-surface-2 text-muted'
	);

	const desktopTimerClass = cn(
		'hidden cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors sm:inline-flex',
		onBreak && running && 'border-success/40 bg-success/10 text-success',
		onBreak && sessionActive && !running && 'border-success/40 bg-success/10 text-success',
		!onBreak && running && 'border-primary/40 bg-primary/10 text-primary',
		!onBreak && sessionActive && !running && 'border-warning/40 bg-warning/10 text-warning',
		!sessionActive && 'border-line bg-surface-2 text-muted hover:text-fg'
	);

	const { data } = useQuery({
		queryKey: ['notifications', 'unread-count'],
		queryFn: () => get('/notifications/unread-count/'),
		refetchInterval: 30_000
	});
	const unread = data?.count || 0;

	return (
		<header className="border-line bg-surface/80 sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-4 backdrop-blur">
			<Button
				variant="ghost"
				size="icon"
				className="lg:hidden"
				onClick={toggleSidebar}
				aria-label="Open navigation menu"
			>
				<Menu size={20} />
			</Button>

			<button
				onClick={openPalette}
				className="border-line bg-surface-2 text-muted hover:border-primary/40 flex h-10 flex-1 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm transition-colors sm:max-w-xs"
			>
				<Search size={16} />
				<span>Search…</span>
				<kbd className="border-line ml-auto hidden rounded border px-1.5 text-xs sm:inline">⌘K</kbd>
			</button>

			<div className="flex flex-1 items-center justify-end gap-1">
				<button
					type="button"
					onClick={() => navigate('/focus')}
					aria-label={timerLabel}
					className={mobileTimerClass}
				>
					<Timer size={18} className={cn(running && 'animate-pulse')} />
					{running && (
						<span
							className={cn(
								'absolute top-1 right-1 h-2 w-2 rounded-full',
								onBreak ? 'bg-success' : 'bg-primary'
							)}
						/>
					)}
					{sessionActive && !running && (
						<span
							className={cn(
								'absolute top-1 right-1 h-2 w-2 rounded-full',
								onBreak ? 'bg-success' : 'bg-warning'
							)}
						/>
					)}
				</button>
				<button
					type="button"
					onClick={() => navigate('/focus')}
					aria-label={timerLabel}
					className={desktopTimerClass}
				>
					<Timer size={16} className={cn(running && 'animate-pulse')} />
					<span className="font-mono tabular-nums">
						{sessionActive ? formatTimerDisplay(remainingSeconds) : onBreak ? 'Break' : 'Focus'}
					</span>
					{running && (
						<span
							className={cn('h-2 w-2 rounded-full', onBreak ? 'bg-success' : 'bg-primary')}
							aria-hidden="true"
						/>
					)}
					{sessionActive && !running && (
						<span
							className={cn('h-2 w-2 rounded-full', onBreak ? 'bg-success' : 'bg-warning')}
							aria-hidden="true"
						/>
					)}
				</button>

				<ThemeToggle />
				<Button
					variant="ghost"
					size="icon"
					onClick={() => navigate('/notifications')}
					aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
					className="relative"
				>
					<Bell size={18} />
					{unread > 0 && (
						<span className="bg-danger absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
							{unread > 9 ? '9+' : unread}
						</span>
					)}
				</Button>
				<button
					onClick={() => navigate('/settings')}
					className="focus-visible:outline-primary ml-1 cursor-pointer rounded-full focus-visible:outline-2"
					aria-label="Account settings"
				>
					<Avatar name={user?.full_name || user?.email} src={user?.avatar_url} size={34} />
				</button>
			</div>
		</header>
	);
}
