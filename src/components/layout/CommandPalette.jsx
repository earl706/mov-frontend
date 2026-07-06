import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckSquare, FolderKanban, Repeat, Search, StickyNote, User } from 'lucide-react';

import { get } from '../../lib/api';
import { useUIStore } from '../../stores/uiStore';

const TYPE_META = {
	task: { icon: CheckSquare, route: '/tasks' },
	note: { icon: StickyNote, route: '/notes' },
	project: { icon: FolderKanban, route: '/projects' },
	habit: { icon: Repeat, route: '/habits' },
	person: { icon: User, route: '/tasks' }
};

/**
 * The palette dialog body. Owns the search term so it resets automatically
 * each time the palette opens (the parent only mounts it while open).
 */
function PaletteDialog({ onClose }) {
	const navigate = useNavigate();
	const [term, setTerm] = useState('');
	const [debounced, setDebounced] = useState('');

	useEffect(() => {
		const id = setTimeout(() => setDebounced(term.trim()), 220);
		return () => clearTimeout(id);
	}, [term]);

	const { data, isFetching } = useQuery({
		queryKey: ['search', debounced],
		queryFn: () => get('/search/', { params: { q: debounced } }),
		enabled: debounced.length > 1
	});

	const goTo = (group) => {
		onClose();
		navigate(TYPE_META[group.type]?.route || '/');
	};

	return (
		<motion.div
			initial={{ y: -16, opacity: 0 }}
			animate={{ y: 0, opacity: 1 }}
			exit={{ y: -16, opacity: 0 }}
			className="border-line bg-surface relative w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl"
			role="dialog"
			aria-label="Search"
		>
			<div className="border-line flex items-center gap-3 border-b px-4">
				<Search size={18} className="text-muted" />
				<input
					autoFocus
					value={term}
					onChange={(e) => setTerm(e.target.value)}
					placeholder="Search tasks, notes, projects, people…"
					className="text-fg placeholder:text-muted h-14 flex-1 bg-transparent outline-none"
				/>
				{isFetching && <span className="text-muted text-xs">…</span>}
			</div>

			<div className="max-h-80 overflow-y-auto p-2">
				{debounced.length <= 1 && (
					<p className="text-muted p-6 text-center text-sm">Type to search across Mov.</p>
				)}
				{debounced.length > 1 && data?.total === 0 && (
					<p className="text-muted p-6 text-center text-sm">No results for “{debounced}”.</p>
				)}
				{data?.groups?.map((group) => {
					const Icon = TYPE_META[group.type]?.icon || Search;
					return (
						<div key={group.type} className="mb-2">
							<p className="text-muted px-3 py-1 text-xs font-semibold tracking-wide uppercase">
								{group.label}
							</p>
							{group.results.map((result) => (
								<button
									key={`${group.type}-${result.id}`}
									onClick={() => goTo(group)}
									className="hover:bg-surface-2 flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm"
								>
									<Icon size={16} className="text-muted" />
									<span className="text-fg flex-1 truncate">{result.title}</span>
									{result.subtitle && <span className="text-muted text-xs">{result.subtitle}</span>}
								</button>
							))}
						</div>
					);
				})}
			</div>
		</motion.div>
	);
}

/** Global search palette. Opens with Cmd/Ctrl+K. */
export function CommandPalette() {
	const { paletteOpen, closePalette, togglePalette } = useUIStore();

	useEffect(() => {
		const onKey = (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault();
				togglePalette();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [togglePalette]);

	return (
		<AnimatePresence>
			{paletteOpen && (
				<motion.div
					className="fixed inset-0 z-[55] flex items-start justify-center p-4 pt-24"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
				>
					<div
						className="absolute inset-0 cursor-pointer bg-black/50 backdrop-blur-sm"
						onClick={closePalette}
					/>
					<PaletteDialog onClose={closePalette} />
				</motion.div>
			)}
		</AnimatePresence>
	);
}
