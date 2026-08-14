import { Dumbbell, History, LayoutDashboard, ListChecks, Scale, Timer } from 'lucide-react';

/** Primary navigation, grouped for the sidebar. `end` marks exact-match links. */
export const navGroups = [
	{
		label: 'Train',
		items: [
			{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
			{ to: '/train', label: 'Workout', icon: Timer },
			{ to: '/routines', label: 'Routines', icon: ListChecks },
			{ to: '/exercises', label: 'Exercises', icon: Dumbbell }
		]
	},
	{
		label: 'Progress',
		items: [
			{ to: '/history', label: 'History', icon: History },
			{ to: '/body', label: 'Body', icon: Scale }
		]
	}
];
