import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';

import { cn } from '../../lib/format';
import { useUIStore } from '../../stores/uiStore';
import { navGroups } from './navItems';

function NavItem({ to, label, icon: Icon, end }) {
	const closeSidebar = useUIStore((s) => s.closeSidebar);
	return (
		<NavLink
			to={to}
			end={end}
			onClick={closeSidebar}
			className={({ isActive }) =>
				cn(
					'group relative flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
					isActive ? 'text-fg' : 'text-muted hover:text-fg hover:bg-surface-2'
				)
			}
		>
			{({ isActive }) => (
				<>
					{isActive && (
						<motion.span
							layoutId="nav-active"
							className="bg-primary/12 absolute inset-0 rounded-xl"
							transition={{ type: 'spring', stiffness: 400, damping: 32 }}
						/>
					)}
					<Icon size={18} className={cn('relative z-10', isActive && 'text-primary')} />
					<span className="relative z-10">{label}</span>
				</>
			)}
		</NavLink>
	);
}

export function SidebarContent() {
	return (
		<div className="flex h-full flex-col gap-6 p-4">
			<div className="flex items-center gap-2 px-2 pt-1">
				<div className="bg-primary text-primary-fg flex h-9 w-9 items-center justify-center rounded-xl">
					<Zap size={18} />
				</div>
				<span className="text-fg text-lg font-bold tracking-tight">Mov</span>
			</div>

			<nav className="flex-1 space-y-6 overflow-y-auto" aria-label="Primary">
				{navGroups.map((group) => (
					<div key={group.label}>
						<p className="text-muted px-3 pb-1.5 text-xs font-semibold tracking-wider uppercase">
							{group.label}
						</p>
						<div className="space-y-0.5">
							{group.items.map((item) => (
								<NavItem key={item.to} {...item} />
							))}
						</div>
					</div>
				))}
			</nav>

			<p className="text-muted px-3 text-xs">Mov · prototype</p>
		</div>
	);
}

/** Responsive sidebar: static rail on desktop, slide-over drawer on mobile. */
export function Sidebar() {
	const { sidebarOpen, closeSidebar } = useUIStore();
	return (
		<>
			<aside className="border-line bg-surface hidden w-64 shrink-0 border-r lg:block">
				<SidebarContent />
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
						<SidebarContent />
					</motion.aside>
				</div>
			)}
		</>
	);
}
