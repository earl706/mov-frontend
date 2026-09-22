import { Feather, Wind } from 'lucide-react';

import { Badge } from '../ui';
import { cn } from '../../lib/format';

/** Icon-only marker for sessions started with half the prescribed sets. */
export function MildBadge({ className }) {
	return (
		<Badge
			tone="accent"
			className={cn('px-1.5 py-0.5', className)}
			aria-label="Mild session — half sets, per-side kept even"
			title="Mild — half sets (per-side kept even)"
		>
			<Feather size={12} aria-hidden />
		</Badge>
	);
}

/** Icon-only marker for sessions started with a quarter of the prescribed sets. */
export function ExtraMildBadge({ className }) {
	return (
		<Badge
			tone="neutral"
			className={cn('px-1.5 py-0.5', className)}
			aria-label="Extra mild session — quarter sets, per-side kept even"
			title="Extra Mild — quarter sets (per-side kept even)"
		>
			<Wind size={12} aria-hidden />
		</Badge>
	);
}

/** Renders Mild or Extra Mild for a session intensity; full sessions show nothing. */
export function SessionIntensityBadge({ intensity, className }) {
	if (intensity === 'extra_mild') return <ExtraMildBadge className={className} />;
	if (intensity === 'mild') return <MildBadge className={className} />;
	return null;
}
