import { Zap } from 'lucide-react';

import { cn } from '../../lib/format';

/** Brand mark: Zap on the primary square (matches app icon / favicon). */
export function MovLogo({ size = 36, iconSize, className }) {
	const glyph = iconSize ?? Math.round(size * 0.5);
	return (
		<div
			className={cn(
				'bg-primary text-primary-fg flex shrink-0 items-center justify-center rounded-sm',
				className
			)}
			style={{ width: size, height: size }}
			aria-hidden
		>
			<Zap size={glyph} />
		</div>
	);
}
