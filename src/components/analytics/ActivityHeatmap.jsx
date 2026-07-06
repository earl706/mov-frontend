import { useEffect, useMemo, useRef, useState } from 'react';
import {
	addDays,
	differenceInCalendarDays,
	eachDayOfInterval,
	endOfWeek,
	format,
	parseISO,
	startOfDay,
	startOfWeek
} from 'date-fns';
import { formatDate, formatDurationSeconds } from '../../lib/format';

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
				return (
					byDate.get(key) || {
						date: key,
						intensity: 0,
						tasks_completed: 0,
						focus_seconds: 0,
						focus_minutes: 0,
						habits_logged: 0,
						outOfRange: true
					}
				);
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

function buildHabitWeeks(recentLogs = [], weekCount = 5, createdAt = null) {
	const logSet = new Set(recentLogs);
	const totalCells = weekCount * 7;
	const today = startOfDay(new Date());
	let creationDate = today;
	if (createdAt) {
		creationDate = startOfDay(typeof createdAt === 'string' ? parseISO(createdAt) : createdAt);
	}
	if (creationDate > today) creationDate = today;

	const ageDays = differenceInCalendarDays(today, creationDate) + 1;
	const days = [];

	if (ageDays <= totalCells) {
		for (let i = 0; i < totalCells; i++) {
			const d = addDays(creationDate, i);
			const date = format(d, 'yyyy-MM-dd');
			if (d > today) {
				days.push({ date, active: false, state: 'future' });
			} else {
				const completed = logSet.has(date);
				days.push({ date, active: completed, state: completed ? 'completed' : 'missed' });
			}
		}
	} else {
		const startDate = addDays(today, -(totalCells - 1));
		for (let i = 0; i < totalCells; i++) {
			const d = addDays(startDate, i);
			const date = format(d, 'yyyy-MM-dd');
			const completed = logSet.has(date);
			days.push({ date, active: completed, state: completed ? 'completed' : 'missed' });
		}
	}

	const weeks = [];
	for (let i = 0; i < days.length; i += 7) {
		weeks.push(days.slice(i, i + 7));
	}
	return weeks;
}

const HABIT_GRID_GAP = 3;
const HABIT_MIN_CELL = 10;

function computeHabitGridLayout(width, { minWeeks = 5, maxWeeks = 26 } = {}) {
	if (!width || width <= 0) {
		return { weeks: minWeeks };
	}

	const weeks = Math.min(
		maxWeeks,
		Math.max(minWeeks, Math.floor((width + HABIT_GRID_GAP) / (HABIT_MIN_CELL + HABIT_GRID_GAP)))
	);

	return { weeks };
}

function tileCellRadius(row, col, size = 7) {
	const last = size - 1;
	const parts = ['rounded-[3px]'];
	if (row === 0 && col === 0) parts.push('rounded-tl-[10px]');
	if (row === 0 && col === last) parts.push('rounded-tr-[10px]');
	if (row === last && col === 0) parts.push('rounded-bl-[10px]');
	if (row === last && col === last) parts.push('rounded-br-[10px]');
	return parts.join(' ');
}

function HeatmapTooltip({ day }) {
	if (!day || day.outOfRange) return null;
	const hasActivity =
		day.intensity > 0 ||
		day.tasks_completed > 0 ||
		day.focus_seconds > 0 ||
		day.focus_minutes > 0 ||
		day.habits_logged > 0;
	const focusSeconds = day.focus_seconds ?? Math.round((day.focus_minutes || 0) * 60);

	return (
		<div className="border-line bg-surface pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-lg border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg">
			<p className="text-fg font-medium">{formatDate(day.date, 'EEE, MMM d, yyyy')}</p>
			{hasActivity ? (
				<>
					{day.tasks_completed > 0 && (
						<p className="text-muted">
							{day.tasks_completed} task{day.tasks_completed === 1 ? '' : 's'} done
						</p>
					)}
					{focusSeconds > 0 && (
						<p className="text-muted">{formatDurationSeconds(focusSeconds)} focused</p>
					)}
					{day.habits_logged > 0 && (
						<p className="text-muted">
							{day.habits_logged} habit{day.habits_logged === 1 ? '' : 's'} logged
						</p>
					)}
				</>
			) : (
				<p className="text-muted">No activity</p>
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
		<div className={`inline-flex ${className}`} aria-label="Activity over the last 7 weeks">
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

function HabitHeatmapTooltip({ day, color }) {
	if (!day?.date || day.state === 'future') return null;

	return (
		<div className="border-line bg-surface pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-lg border px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg">
			<p className="text-fg font-medium">{formatDate(day.date, 'EEE, MMM d, yyyy')}</p>
			<p className="text-muted" style={{ color: day.active ? color : undefined }}>
				{day.active ? 'Completed' : 'Missed'}
			</p>
		</div>
	);
}

export function CompactHabitGrid({
	logs = [],
	createdAt = null,
	color = 'var(--primary)',
	minWeeks = 5,
	maxWeeks = 26,
	className = ''
}) {
	const containerRef = useRef(null);
	const [hovered, setHovered] = useState(null);
	const [layout, setLayout] = useState(() => computeHabitGridLayout(0, { minWeeks, maxWeeks }));

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const update = () => {
			setLayout(computeHabitGridLayout(el.clientWidth, { minWeeks, maxWeeks }));
		};

		update();
		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, [minWeeks, maxWeeks]);

	const gridWeeks = useMemo(
		() => buildHabitWeeks(logs, layout.weeks, createdAt),
		[logs, layout.weeks, createdAt]
	);
	const { weeks } = layout;

	return (
		<div
			ref={containerRef}
			className={`w-full ${className}`}
			aria-label="Habit check-in history from creation through today"
		>
			<div className="flex w-full" style={{ gap: HABIT_GRID_GAP }}>
				{gridWeeks.map((week, col) => (
					<div key={col} className="flex min-w-0 flex-1 flex-col" style={{ gap: HABIT_GRID_GAP }}>
						{week.map((day, row) => {
							const isFuture = day.state === 'future';
							const isHovered = !isFuture && hovered === day.date;

							return (
								<div
									key={`${col}-${row}`}
									className="relative"
									onMouseEnter={() => !isFuture && setHovered(day.date)}
									onMouseLeave={() => setHovered(null)}
								>
									{isHovered && <HabitHeatmapTooltip day={day} color={color} />}
									<div
										className={`aspect-square w-full transition-colors ${tileCellRadius(row, col, weeks)} ${
											isFuture ? 'border-line border border-dashed opacity-30' : ''
										}`}
										style={{
											background: isFuture
												? 'transparent'
												: day.state === 'completed'
													? color
													: 'var(--surface-2)'
										}}
										aria-label={
											isFuture
												? 'Upcoming day'
												: day.date
													? `${formatDate(day.date, 'MMM d')}: ${day.active ? 'completed' : 'missed'}`
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
