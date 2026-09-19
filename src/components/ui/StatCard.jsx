import { motion } from 'framer-motion';

import { cn } from '../../lib/format';
import { Card } from './Card';

const TREND_TONE = { up: 'text-success', down: 'text-danger', flat: 'text-muted' };
const SUB_TONE = {
	success: 'text-success',
	warning: 'text-warning',
	danger: 'text-danger',
	muted: 'text-muted'
};

/** Compact metric tile for dashboards (value + label + optional icon/trend). */
export function StatCard({
	icon: Icon,
	label,
	value,
	sublabel,
	sublabelTone,
	tone = 'primary',
	trend,
	onClick,
	dense = false,
	className
}) {
	return (
		<Card
			as={onClick ? motion.button : motion.div}
			onClick={onClick}
			whileHover={onClick && !dense ? { y: -2 } : undefined}
			className={cn(
				'flex h-full w-full items-center text-left',
				dense ? 'gap-1.5 p-1.5' : 'gap-4 p-4',
				onClick && 'hover:border-primary/40 cursor-pointer',
				className
			)}
		>
			{Icon && (
				<div
					className={cn(
						'flex shrink-0 items-center justify-center rounded-sm',
						dense ? 'h-6 w-6' : 'h-11 w-11'
					)}
					style={{ background: `var(--${tone})`, opacity: 0.95 }}
				>
					<Icon size={dense ? 12 : 20} className="text-white" />
				</div>
			)}
			<div className="min-w-0">
				<p className={cn('text-fg leading-tight font-semibold', dense ? 'text-sm' : 'text-2xl')}>
					{value}
				</p>
				<p className={cn('text-muted truncate', dense ? 'text-[10px] leading-tight' : 'text-xs')}>
					{label}
				</p>
				{sublabel && (
					<p
						className={cn(
							'text-xs',
							sublabelTone ? SUB_TONE[sublabelTone] : trend ? TREND_TONE[trend] : 'text-muted'
						)}
					>
						{sublabel}
					</p>
				)}
			</div>
		</Card>
	);
}
