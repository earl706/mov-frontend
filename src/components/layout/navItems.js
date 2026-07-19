import { LayoutDashboard, FolderKanban, CheckSquare, Repeat, Calendar, Timer } from 'lucide-react';

/** Primary navigation, grouped for the sidebar. `end` marks exact-match links. */
export const navGroups = [
	{
		label: 'Workspace',
		items: [
			{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
			{ to: '/projects', label: 'Projects', icon: FolderKanban },
			{ to: '/tasks', label: 'Tasks', icon: CheckSquare },
			{ to: '/habits', label: 'Habits', icon: Repeat },
			{ to: '/calendar', label: 'Calendar', icon: Calendar },
			{ to: '/focus', label: 'Focus', icon: Timer }
		]
	}
];
