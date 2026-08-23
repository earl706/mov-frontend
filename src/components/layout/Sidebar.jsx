import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';

import { cn } from '../../lib/format';
import { useUIStore } from '../../stores/uiStore';
import { navGroups } from './navItems';

function NavItem({ to, label, icon: Icon, end, collapsed }) {
	const closeSidebar = useUIStore((s) => s.closeSidebar);
	return (
		<NavLink
			to={to}
			end={end}
			title={collapsed ? label : undefined}
			onClick={closeSidebar}
			className={({ isActive }) =>
				cn(
					'group relative flex cursor-pointer font-medium transition-colors',
					collapsed
						? 'flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 py-2 text-[11px] leading-tight'
						: 'items-center gap-3 rounded-md px-3 py-2 text-sm',
					isActive ? 'text-fg' : 'text-muted hover:text-fg hover:bg-surface-2'
				)
			}
		>
			{({ isActive }) => (
				<>
					{isActive && (
						<motion.span
							layoutId="nav-active"
							className={cn(
								'bg-primary/12 absolute inset-0',
								collapsed ? 'rounded-lg' : 'rounded-md'
							)}
							transition={{ type: 'spring', stiffness: 400, damping: 32 }}
						/>
					)}
					<Icon
						size={collapsed ? 20 : 18}
						strokeWidth={collapsed ? 1.75 : 2}
						className={cn('relative z-10 shrink-0', isActive && 'text-primary')}
					/>
					{(!collapsed || isActive) && (
						<span
							className={cn('relative z-10', collapsed && 'max-w-full truncate px-0.5 text-center')}
						>
							{label}
						</span>
					)}
				</>
			)}
		</NavLink>
	);
}

function SidebarContent({ collapsed = false, showCollapseToggle = false }) {
	const toggleSidebarCollapsed = useUIStore((s) => s.toggleSidebarCollapsed);

	return (
		<div
			className={cn(
				'flex h-full flex-col',
				collapsed ? 'items-stretch gap-4 px-2 py-4' : 'gap-6 p-4'
			)}
		>
			<div
				className={cn('flex items-center pt-1', collapsed ? 'justify-center px-0' : 'gap-2 px-2')}
			>
				<div className="bg-primary text-primary-fg flex h-9 w-9 shrink-0 items-center justify-center rounded-sm">
					<Zap size={18} />
				</div>
				{!collapsed && <span className="text-fg text-lg font-bold tracking-tight">Mov</span>}
			</div>

			<nav
				className={cn('flex-1 overflow-y-auto', collapsed ? 'space-y-1' : 'space-y-6')}
				aria-label="Primary"
			>
				{navGroups.map((group) => (
					<div key={group.label}>
						{!collapsed && (
							<p className="text-muted px-3 pb-1.5 text-xs font-semibold tracking-wider uppercase">
								{group.label}
							</p>
						)}
						<div className={cn(collapsed ? 'space-y-1' : 'space-y-0.5')}>
							{group.items.map((item) => (
								<NavItem key={item.to} {...item} collapsed={collapsed} />
							))}
						</div>
					</div>
				))}
			</nav>

			<div className={cn('mt-auto space-y-2', collapsed ? 'px-0' : 'px-0')}>
				{!collapsed && <p className="text-muted px-3 text-xs">Mov · prototype</p>}
				{showCollapseToggle && (
					<button
						type="button"
						onClick={toggleSidebarCollapsed}
						className={cn(
							'text-muted hover:text-fg hover:bg-surface-2 flex w-full cursor-pointer items-center rounded-md transition-colors',
							collapsed ? 'justify-center px-1 py-2.5' : 'gap-3 px-3 py-2 text-sm font-medium'
						)}
						aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
						aria-expanded={!collapsed}
						title={collapsed ? 'Expand' : 'Collapse'}
					>
						{collapsed ? <ChevronRight size={20} strokeWidth={1.75} /> : <ChevronLeft size={18} />}
					</button>
				)}
			</div>
		</div>
	);
}

/** Responsive sidebar: static rail on desktop (expandable), slide-over on mobile. */
export function Sidebar() {
	const { sidebarOpen, closeSidebar, sidebarCollapsed } = useUIStore();
	return (
		<>
			<aside
				className={cn(
					'border-line bg-surface hidden shrink-0 border-r transition-[width] duration-200 ease-out lg:block',
					sidebarCollapsed ? 'w-24' : 'w-64'
				)}
			>
				<SidebarContent collapsed={sidebarCollapsed} showCollapseToggle />
			</aside>

			{sidebarOpen && (
				<div className="fixed inset-0 z-40 lg:hidden">
					<div
						className="absolute inset-0 cursor-pointer bg-black/50"
						onClick={closeSidebar}
						aria-hidden="true"
					/>
					<motion.aside
						initial={{ x: -280 }}
						animate={{ x: 0 }}
						exit={{ x: -280 }}
						className="border-line bg-surface absolute inset-y-0 left-0 w-64 border-r"
					>
						<SidebarContent collapsed={false} />
					</motion.aside>
				</div>
			)}
		</>
	);
}
