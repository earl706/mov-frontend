import { cn } from '../../lib/format';

const TONE_COLOR = {
	primary: 'var(--primary)',
	success: 'var(--success)',
	warning: 'var(--warning)',
	danger: 'var(--danger)',
	accent: 'var(--accent)'
};

export function ProgressBar({ value = 0, tone = 'primary', className, showLabel = false }) {
	const pct = Math.max(0, Math.min(100, value));
	return (
		<div className={cn('flex items-center gap-2', className)}>
			<div
				className="bg-surface-2 h-2 flex-1 overflow-hidden rounded-full"
				role="progressbar"
				aria-valuenow={Math.round(pct)}
				aria-valuemin={0}
				aria-valuemax={100}
			>
				<div
					className="h-full rounded-full transition-all duration-500"
					style={{ width: `${pct}%`, background: TONE_COLOR[tone] }}
				/>
			</div>
			{showLabel && <span className="text-muted w-9 text-right text-xs">{Math.round(pct)}%</span>}
		</div>
	);
}

/** Circular progress ring used for health/momentum stats and the set timer. */
export function ProgressRing({
	value = 0,
	size = 64,
	stroke = 6,
	tone = 'primary',
	label,
	children,
	className,
	instant = false,
	...rest
}) {
	const pct = Math.max(0, Math.min(100, value));
	const radius = (size - stroke) / 2;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (pct / 100) * circumference;
	return (
		<div
			className={cn('relative inline-flex items-center justify-center', className)}
			style={{ width: size, height: size }}
			role="progressbar"
			aria-valuenow={Math.round(pct)}
			aria-valuemin={0}
			aria-valuemax={100}
			{...rest}
		>
			<svg width={size} height={size} className="-rotate-90">
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="var(--surface-2)"
					strokeWidth={stroke}
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					strokeWidth={stroke}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					style={{
						stroke: TONE_COLOR[tone],
						transition: instant ? 'none' : 'stroke-dashoffset 0.5s linear, stroke 0.35s ease'
					}}
				/>
			</svg>
			<div className="absolute inset-0 flex items-center justify-center">
				{children ?? (
					<span className="text-fg text-sm font-semibold">{label ?? `${Math.round(pct)}`}</span>
				)}
			</div>
		</div>
	);
}
