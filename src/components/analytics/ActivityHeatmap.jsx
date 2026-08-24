import { useMemo, useState } from 'react';
import { eachDayOfInterval, endOfWeek, format, parseISO, startOfWeek } from 'date-fns';
import { formatDate } from '../../lib/format';

const LEVEL_BG = [
	'color-mix(in srgb, var(--fg) 6%, var(--surface))',
	'color-mix(in srgb, var(--primary) 28%, var(--surface))',
	'color-mix(in srgb, var(--primary) 48%, var(--surface))',
	'color-mix(in srgb, var(--primary) 72%, var(--surface))',
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

function monthLabels(weeks) {
	const labels = [];
	let lastMonth = '';
	weeks.forEach((week, col) => {
		const day = week.find((d) => d.date && !d.outOfRange) || week.find((d) => d.date);
		if (!day?.date) return;
		const month = formatDate(day.date, 'MMM');
		if (month !== lastMonth) {
			labels.push({ col, month });
			lastMonth = month;
		}
	});
	return labels;
}

function daySummary(day, emptyLabel) {
	if (!day?.date || day.outOfRange) return null;
	const active = day.trained || day.intensity > 0 || day.logged;
	const when = formatDate(day.date, 'EEE, MMM d');
	if (!active) return `${when} · ${emptyLabel}`;
	if (day.logged && !(day.intensity > 0)) return `${when} · Weigh-in logged`;
	const bits = [`${when}`];
	if (day.intensity > 0) bits.push(`${day.intensity} set${day.intensity === 1 ? '' : 's'}`);
	if (day.volume_kg > 0) bits.push(`${Math.round(day.volume_kg)} kg`);
	return bits.join(' · ');
}

/**
 * Compact contribution-style activity grid.
 * Weeks flex to the card width so the tile does not need horizontal scroll.
 */
export function CompactActivityTile({
	timeline = [],
	weeks = 7,
	className = '',
	emptyLabel = 'No activity'
}) {
	const [focus, setFocus] = useState(null);
	const gridWeeks = useMemo(() => buildCompactWeeks(timeline, weeks), [timeline, weeks]);
	const maxIntensity = useMemo(
		() => Math.max(1, ...timeline.map((d) => d.intensity || 0)),
		[timeline]
	);
	const labels = useMemo(() => monthLabels(gridWeeks), [gridWeeks]);
	const activeCount = useMemo(
		() => timeline.filter((d) => d.intensity > 0 || d.logged || d.trained).length,
		[timeline]
	);

	if (!timeline.length) {
		return (
			<div className={`text-muted flex items-center justify-center text-xs ${className}`}>
				No activity yet
			</div>
		);
	}

	const focusDay = focus ? gridWeeks.flat().find((d) => d.date === focus) : null;
	const status =
		daySummary(focusDay, emptyLabel) ||
		`${activeCount} active day${activeCount === 1 ? '' : 's'} · last ${weeks} weeks`;

	return (
		<div
			className={`flex max-h-full min-h-0 w-full flex-col items-stretch justify-center gap-2 ${className}`}
		>
			<div
				className="flex w-full shrink-0 flex-col gap-1.5"
				aria-label={`Activity over the last ${weeks} weeks`}
			>
				<div
					className="grid w-full"
					style={{
						gridAutoFlow: 'column',
						gridTemplateRows: 'repeat(7, minmax(0, 1fr))',
						gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`,
						gap: 3,
						aspectRatio: `${weeks} / 7`
					}}
				>
					{gridWeeks.flatMap((week, col) =>
						week.map((day, row) => {
							const lvl = day.outOfRange ? 0 : intensityLevel(day.intensity, maxIntensity);
							const active = !day.outOfRange && day.date;
							const isFocus = focus === day.date;

							return (
								<button
									key={`${col}-${row}`}
									type="button"
									disabled={!active}
									className={`min-h-0 min-w-0 rounded-[3px] transition-[box-shadow,background-color] duration-150 ${
										active
											? 'hover:ring-primary/50 focus-visible:ring-primary cursor-pointer hover:ring-1 focus-visible:ring-1 focus-visible:outline-none'
											: 'pointer-events-none opacity-25'
									} ${isFocus ? 'ring-primary ring-1' : ''}`}
									style={{ background: day.outOfRange ? 'transparent' : LEVEL_BG[lvl] }}
									aria-label={
										day.date
											? `${formatDate(day.date, 'MMM d')}: ${day.intensity || 0} activity`
											: undefined
									}
									onMouseEnter={() => active && setFocus(day.date)}
									onMouseLeave={() => setFocus(null)}
									onFocus={() => active && setFocus(day.date)}
									onBlur={() => setFocus(null)}
								/>
							);
						})
					)}
				</div>
				<div className="relative h-3 w-full shrink-0 text-[9px] leading-none">
					{labels.map(({ col, month }) => (
						<span
							key={`${month}-${col}`}
							className="text-muted absolute top-0"
							style={{ left: `${(col / weeks) * 100}%` }}
						>
							{month}
						</span>
					))}
				</div>
			</div>
			<div className="flex w-full shrink-0 items-center justify-between gap-2">
				<p className="text-muted min-w-0 flex-1 truncate text-[10px] leading-tight">{status}</p>
				<div className="text-muted flex shrink-0 items-center gap-1 text-[9px]">
					<span className="hidden sm:inline">Less</span>
					<div className="flex gap-[2px]">
						{LEVEL_BG.map((bg, i) => (
							<span key={i} className="h-2 w-2 rounded-[2px]" style={{ background: bg }} />
						))}
					</div>
					<span className="hidden sm:inline">More</span>
				</div>
			</div>
		</div>
	);
}
