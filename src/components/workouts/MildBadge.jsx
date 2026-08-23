import { Feather } from 'lucide-react';

import { Badge } from '../ui';
import { cn } from '../../lib/format';

/** Icon-only marker for sessions started with half the prescribed sets. */
export function MildBadge({ className }) {
	return (
		<Badge
			tone="accent"
			className={cn('px-1.5 py-0.5', className)}
			aria-label="Mild session"
			title="Mild — half sets"
		>
			<Feather size={12} aria-hidden />
		</Badge>
	);
}
