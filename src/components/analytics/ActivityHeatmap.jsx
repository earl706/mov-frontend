import { useMemo, useState } from 'react';
import { eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
import { formatDate } from '../../lib/format';

const LEVEL_BG = [
	'var(--surface-2)',
	'color-mix(in srgb, var(--primary) 22%, var(--surface-2))',
	'color-mix(in srgb, var(--primary) 45%, var(--surface-2))',
	'color-mix(in srgb, var(--primary) 68%, var(--surface-2))',
	'var(--primary)'
];

function intensityLevel(intensity, max) {
	if (intensity <= 0) return 0;
	const ratio = intensity / (max || 1);
	if (ratio > 0.75) return 4;
	if (ratio > 0.5) return 3;
	if (ratio > 0.25) return 2;
	return 1;
}

function buildHeatmapWeeks(timeline) {
	if (!timeline?.length) return { weeks: [] };

	const byDate = new Map(timeline.map((d) => [d.date, d]));
	const first = parseISO(timeline[0].date);
	const last = parseISO(timeline[timeline.length - 1].date);
	const gridStart = startOfWeek(first, { weekStartsOn: 0 });
	const gridEnd = endOfWeek(last, { weekStartsOn: 0 });
	const allDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

	const weeks = [];
	for (let i = 0; i < allDays.length; i += 7) {
		weeks.push(
			allDays.slice(i, i + 7).map((d) => {
				const key = format(d, 'yyyy-MM-dd');
				return byDate.get(key) || { date: key, intensity: 0, outOfRange: true };
			})
		);
	}

	return { weeks };
}

function buildCompactWeeks(timeline, weekCount = 7) {
	const { weeks } = buildHeatmapWeeks(timeline);
	const recent = weeks.slice(-weekCount);
	while (recent.length < weekCount) {
		recent.unshift(Array.from({ length: 7 }, () => ({ date: '', intensity: 0, outOfRange: true })));
	}
	return recent;
}

function tileCellRadius(row, col, size = 7) {
	const last = size - 1;
	const parts = ['rounded-sm'];
	if (row === 0 && col === 0) parts.push('rounded-tl-sm');
	if (row === 0 && col === last) parts.push('rounded-tr-sm');
	if (row === last && col === 0) parts.push('rounded-bl-sm');
	if (row === last && col === last) parts.push('rounded-br-sm');
	return parts.join(' ');
}

function HeatmapTooltip({ day }) {
	if (!day || day.outOfRange) return null;
	const trained = day.trained || day.intensity > 0 || day.logged;

	return (
		<div className="border-line bg-surface pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-lg border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg">
			<p className="text-fg font-medium">{formatDate(day.date, 'EEE, MMM d, yyyy')}</p>
			{trained ? (
				<>
					{day.intensity > 0 && (
						<p className="text-muted">
							{day.intensity} set{day.intensity === 1 ? '' : 's'}
						</p>
					)}
					{day.volume_kg > 0 && <p className="text-muted">{Math.round(day.volume_kg)} kg volume</p>}
					{day.calories > 0 && <p className="text-muted">{Math.round(day.calories)} kcal</p>}
					{day.logged && !day.intensity && <p className="text-muted">Logged</p>}
				</>
			) : (
				<p className="text-muted">Rest day</p>
			)}
		</div>
	);
}

export function CompactActivityTile({ timeline = [], weeks = 7, className = '' }) {
	const [hovered, setHovered] = useState(null);
	const gridWeeks = useMemo(() => buildCompactWeeks(timeline, weeks), [timeline, weeks]);
	const maxIntensity = useMemo(() => Math.max(1, ...timeline.map((d) => d.intensity)), [timeline]);

	if (!timeline.length) {
		return (
			<div className={`text-muted flex items-center justify-center text-[10px] ${className}`}>
				No activity yet
			</div>
		);
	}

	return (
		<div
			className={`inline-flex ${className}`}
			aria-label={`Activity over the last ${weeks} weeks`}
		>
			<div className="flex gap-[3px]">
				{gridWeeks.map((week, col) => (
					<div key={col} className="flex flex-col gap-[3px]">
						{week.map((day, row) => {
							const lvl = day.outOfRange ? 0 : intensityLevel(day.intensity, maxIntensity);
							const isHovered = hovered === day.date;

							return (
								<div
									key={`${col}-${row}`}
									className="relative"
									onMouseEnter={() => day.date && setHovered(day.date)}
									onMouseLeave={() => setHovered(null)}
								>
									{isHovered && <HeatmapTooltip day={day} />}
									<div
										className={`h-[11px] w-[11px] transition-colors ${tileCellRadius(row, col, weeks)} ${day.outOfRange ? 'opacity-0' : ''}`}
										style={{ background: LEVEL_BG[lvl] }}
										aria-label={
											day.date
												? `${formatDate(day.date, 'MMM d')}: ${day.intensity || 0} activity`
												: undefined
										}
									/>
								</div>
							);
						})}
					</div>
				))}
			</div>
		</div>
	);
}
