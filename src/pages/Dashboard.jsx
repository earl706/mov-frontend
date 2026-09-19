import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { eachDayOfInterval, format, parseISO, subDays } from 'date-fns';
import {
	Area,
	AreaChart,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis
} from 'recharts';
import {
	Activity,
	Check,
	Dumbbell,
	Feather,
	Flame,
	History,
	LayoutDashboard,
	Play,
	Scale,
	Timer
} from 'lucide-react';

import { CompactActivityTile } from '../components/analytics/ActivityHeatmap';
import { SetWorkRestBarChart } from '../components/analytics/SetWorkRestBarChart';
import { PageHeader } from '../components/layout/PageHeader';
import {
	Button,
	Card,
	CardBody,
	CardHeader,
	LoadingScreen,
	ProgressRing,
	StatCard
} from '../components/ui';
import { formatDate, formatDurationSeconds } from '../lib/format';
import { formatDelta, formatWeight, localDateKey } from '../lib/weightFormat';
import {
	sessionsApi,
	useDashboard,
	useRecentSessions,
	useRecentSets,
	useStartSession,
	useTrainingHeatmap,
	useTrainingSeries,
	useWeightHeatmap,
	useWeightProfile,
	useWeightSeries,
	useWeightStats
} from '../lib/resources';
import { useAuthStore } from '../stores/authStore';

const container = { animate: { transition: { staggerChildren: 0.05 } } };
const item = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

/** Compact card chrome so the dashboard fits one desktop viewport. */
const compactHeader = 'p-3 pb-1 lg:p-2.5 lg:pb-0.5';
const compactBody = 'p-3 pt-0 lg:p-2.5 lg:pt-0';
const chartHeight = 'h-full min-h-36';
/** CompactActivityTile: 12px cells + 2px gaps → ~500px wide at 39 weeks. */
const HEATMAP_WEEKS = 39;
const HEATMAP_DAYS = HEATMAP_WEEKS * 7;
const CHART_DAYS = 30;
const RECENT_SET_LIMIT = 120;
const RECENT_SESSION_LIMIT = 30;
const RPE_SESSION_LIMIT = 30;

const MOVEMENT_LABELS = {
	push: 'Push',
	pull: 'Pull',
	legs: 'Legs',
	core: 'Core',
	full_body: 'Full body'
};
const MOVEMENT_COLORS = {
	push: 'var(--primary)',
	pull: 'var(--accent)',
	legs: 'var(--success)',
	core: 'var(--warning)',
	full_body: 'var(--muted)'
};

const chartTooltipStyle = {
	background: 'var(--surface)',
	border: '1px solid var(--line)',
	borderRadius: 8,
	fontSize: 12
};

function sparseTicks(dates, count = 4) {
	if (!dates.length) return [];
	if (dates.length <= count) return dates;
	return Array.from({ length: count }, (_, i) => {
		const idx = Math.round((i * (dates.length - 1)) / (count - 1));
		return dates[idx];
	});
}

function lastNDayKeys(days = CHART_DAYS) {
	const end = parseISO(localDateKey());
	const start = subDays(end, days - 1);
	return eachDayOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM-dd'));
}

/** Fill missing calendar days so weight charts span a full window. */
function padWeightPoints(points, days = CHART_DAYS) {
	const byDate = new Map((points || []).map((p) => [p.date, p]));
	return lastNDayKeys(days).map((date) => {
		const hit = byDate.get(date);
		return hit || { date, weight: null, rolling_avg: null };
	});
}

function DashAreaChart({ data, dataKey, name, gradientId, tooltipLabel, domain }) {
	const ticks = useMemo(
		() =>
			sparseTicks(
				data.map((d) => d.date),
				4
			),
		[data]
	);

	return (
		<ResponsiveContainer width="100%" height="100%">
			<AreaChart data={data} margin={{ top: 18, right: 20, left: 4, bottom: 0 }}>
				<defs>
					<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
						<stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
					</linearGradient>
				</defs>
				<XAxis
					dataKey="date"
					ticks={ticks}
					interval={0}
					tickFormatter={(d) => formatDate(d, 'MMM d')}
					tick={{ fill: 'var(--muted)', fontSize: 10 }}
					axisLine={false}
					tickLine={false}
					minTickGap={28}
					padding={{ left: 8, right: 8 }}
				/>
				<YAxis
					width={36}
					tickCount={3}
					domain={domain || ['auto', 'auto']}
					tick={{ fill: 'var(--muted)', fontSize: 10 }}
					axisLine={false}
					tickLine={false}
					allowDecimals={false}
					tickFormatter={(v) =>
						Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v))
					}
				/>
				<Tooltip
					labelFormatter={(d) => formatDate(d, 'EEE, MMM d')}
					formatter={(value) => [
						value == null || Number.isNaN(Number(value))
							? '—'
							: tooltipLabel
								? tooltipLabel(value)
								: Math.round(Number(value)),
						name
					]}
					contentStyle={chartTooltipStyle}
				/>
				<Area
					type="monotone"
					dataKey={dataKey}
					name={name}
					stroke="var(--primary)"
					strokeWidth={2}
					fill={`url(#${gradientId})`}
					connectNulls
					dot={false}
					activeDot={false}
				/>
			</AreaChart>
		</ResponsiveContainer>
	);
}

function RpeSessionTooltip({ active, payload }) {
	if (!active || !payload?.length) return null;
	const row = payload[0]?.payload;
	if (!row) return null;
	return (
		<div style={chartTooltipStyle} className="px-2.5 py-2">
			<p className="text-fg text-xs font-medium">RPE {row.rpe}</p>
			<p className="text-muted text-[11px]">
				{row.template_name} · {row.total_sets} set{row.total_sets === 1 ? '' : 's'}
			</p>
			{row.date ? (
				<p className="text-muted text-[11px]">{formatDate(row.date, 'EEE, MMM d')}</p>
			) : null}
		</div>
	);
}

/** Compact session-RPE area for the dashboard top row (0–10, no X ticks). */
function RpeSessionChart({ sessions }) {
	const data = useMemo(() => {
		const newestFirst = sessions || [];
		return [...newestFirst].reverse().map((session, index) => ({
			i: index + 1,
			date: session.date,
			rpe: session.perceived_effort != null ? Number(session.perceived_effort) : 0,
			template_name: session.template_name || 'Workout',
			total_sets: session.total_sets ?? 0
		}));
	}, [sessions]);

	if (!data.length) {
		return (
			<p className="text-muted flex h-full items-center text-[10px] leading-snug">
				Log workouts with session RPE to see your trend.
			</p>
		);
	}

	return (
		<ResponsiveContainer width="100%" height="100%">
			<AreaChart data={data} margin={{ top: 1, right: 1, left: 1, bottom: 1 }}>
				<defs>
					<linearGradient id="rpeSessionFill" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
						<stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
					</linearGradient>
				</defs>
				<XAxis dataKey="i" hide />
				<YAxis
					domain={[0, 10]}
					ticks={[0, 5, 10]}
					width={26}
					tick={{ fill: 'var(--muted)', fontSize: 9 }}
					axisLine={false}
					tickLine={false}
					allowDecimals={false}
				/>
				<Tooltip content={<RpeSessionTooltip />} />
				<Area
					type="monotone"
					dataKey="rpe"
					name="RPE"
					stroke="var(--primary)"
					strokeWidth={2}
					fill="url(#rpeSessionFill)"
					dot={false}
					activeDot={{ r: 3, fill: 'var(--primary)' }}
				/>
			</AreaChart>
		</ResponsiveContainer>
	);
}

function greeting() {
	const hour = new Date().getHours();
	if (hour < 12) return 'Good morning';
	if (hour < 18) return 'Good afternoon';
	return 'Good evening';
}

/** The one thing the dashboard is really for: did you train today, and what's next. */
function TodayCard({ training, activeSession, suggested, todayIsRest }) {
	const navigate = useNavigate();
	const start = useStartSession();
	const weeklyGoal = training.weekly_goal || 0;
	const calendarSessions = training.sessions_calendar_week ?? 0;
	const goalPct = weeklyGoal ? Math.min(100, Math.round((calendarSessions / weeklyGoal) * 100)) : 0;
	const ringLabel = weeklyGoal ? `${calendarSessions}/${weeklyGoal}` : `${calendarSessions}`;

	let statusLabel;
	if (training.trained_today) {
		statusLabel = 'Done today';
	} else if (todayIsRest) {
		statusLabel = 'Rest day';
	} else {
		statusLabel = 'Not trained yet';
	}

	let actions;
	if (activeSession) {
		actions = (
			<Button size="sm" className="h-7 w-full text-xs" onClick={() => navigate('/train')}>
				<Timer size={12} />
				Resume
			</Button>
		);
	} else if (suggested) {
		actions = (
			<div className="flex w-full flex-col items-center justify-center gap-1.5">
				<Button
					size="sm"
					className="h-7 min-w-0 truncate px-2 text-xs"
					onClick={() =>
						start.mutate({ template: suggested.id }, { onSuccess: () => navigate('/train') })
					}
					loading={start.isPending}
				>
					<Play size={12} />
					<span className="truncate">Start</span>
				</Button>
				<Button
					size="sm"
					variant="secondary"
					className="h-7 px-2 text-xs"
					onClick={() =>
						start.mutate(
							{ template: suggested.id, mild: true },
							{ onSuccess: () => navigate('/train') }
						)
					}
					loading={start.isPending}
					aria-label={`Start Mild ${suggested.name}`}
					title="Start Mild — half sets (per-side kept even)"
				>
					<Feather size={12} />
					Mild
				</Button>
			</div>
		);
	} else if (todayIsRest) {
		actions = (
			<Button
				variant="secondary"
				size="sm"
				className="h-7 w-full text-xs"
				onClick={() => navigate('/train')}
			>
				Train anyway
			</Button>
		);
	} else {
		actions = (
			<Button size="sm" className="h-7 w-full text-xs" onClick={() => navigate('/routines')}>
				Build routine
			</Button>
		);
	}

	return (
		<Card
			className={
				training.trained_today
					? 'border-success/40 flex h-full flex-col overflow-hidden'
					: todayIsRest
						? 'flex h-full flex-col overflow-hidden'
						: 'border-primary/40 flex h-full flex-col overflow-hidden'
			}
		>
			<CardBody className="flex flex-1 items-center gap-2 px-2 pt-3 pb-2">
				<div className="flex shrink-0 items-center gap-1.5">
					<ProgressRing
						value={goalPct}
						size={44}
						stroke={4}
						tone={training.trained_today ? 'success' : 'primary'}
					>
						<span className="text-fg text-[10px] font-semibold tabular-nums">{ringLabel}</span>
					</ProgressRing>
					<p
						className={
							training.trained_today
								? 'text-success max-w-18 text-[10px] leading-tight'
								: 'text-muted max-w-18 text-[10px] leading-tight'
						}
					>
						{training.trained_today && <Check size={10} className="mr-0.5 inline shrink-0" />}
						{statusLabel}
					</p>
				</div>
				<div className="flex min-w-0 flex-1 items-center">{actions}</div>
			</CardBody>
		</Card>
	);
}

/** Compact donut of logged sets by movement group (last 30 days). */
function MovementDonut({ groups, size = 72 }) {
	const slices = useMemo(() => {
		return (groups || []).map((row) => ({
			...row,
			label: MOVEMENT_LABELS[row.group] || row.group,
			color: MOVEMENT_COLORS[row.group] || 'var(--muted)'
		}));
	}, [groups]);
	const total = slices.reduce((sum, row) => sum + (row.sets || 0), 0);

	if (!total) {
		return (
			<p className="text-muted flex h-full w-full items-center justify-center px-2 text-center text-[10px] leading-snug">
				Log workouts to see 30-day movement balance.
			</p>
		);
	}

	return (
		<div className="flex h-full w-full items-center justify-center">
			<div className="flex items-center gap-10 pt-5">
				<div className="shrink-0" style={{ width: size, height: size }}>
					<ResponsiveContainer width="100%" height="100%">
						<PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
							<Pie
								data={slices.filter((row) => row.sets > 0)}
								dataKey="sets"
								nameKey="label"
								cx="50%"
								cy="50%"
								innerRadius={size * 0.32}
								outerRadius={size / 2 - 1}
								stroke="var(--surface)"
								strokeWidth={1}
								isAnimationActive={false}
							>
								{slices
									.filter((row) => row.sets > 0)
									.map((row) => (
										<Cell key={row.group} fill={row.color} />
									))}
							</Pie>
						</PieChart>
					</ResponsiveContainer>
				</div>
				<ul
					className="shrink-0 space-y-0.5 text-[10px] leading-tight"
					aria-label="Sets by movement group, last 30 days"
				>
					{slices.map((row) => (
						<li key={row.group} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-1.5">
							<span
								className="h-1.5 w-1.5 shrink-0 rounded-full"
								style={{ background: row.color }}
							/>
							<span className="text-muted whitespace-nowrap">{row.label}</span>
							<span className="text-fg tabular-nums">{Math.round((row.sets / total) * 100)}%</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

function valueDomain(data, dataKey, padRatio = 0.12) {
	const vals = data.map((d) => d[dataKey]).filter((v) => v != null && !Number.isNaN(Number(v)));
	if (!vals.length) return [0, 1];
	const min = Math.min(...vals);
	const max = Math.max(...vals);
	if (min === max) {
		const pad = Math.max(1, Math.abs(min) * padRatio || 1);
		return [min - pad, max + pad];
	}
	const pad = (max - min) * padRatio;
	return [min - pad, max + pad];
}

function WeightTrendCard({ unit, chartData, stats }) {
	const domain = useMemo(() => valueDomain(chartData, 'weight'), [chartData]);

	return (
		<Card className="flex min-h-0 flex-col">
			<CardHeader className={compactHeader} title="Weight" />
			<CardBody className={`${compactBody} flex min-h-0 flex-1 flex-col py-1`}>
				<div className={`${chartHeight} min-h-0 flex-1`}>
					<DashAreaChart
						data={chartData}
						dataKey="weight"
						name="Weight"
						gradientId="dashWeightFill"
						tooltipLabel={(v) => `${Number(v).toFixed(1)} ${unit}`}
						domain={domain}
					/>
				</div>
			</CardBody>
		</Card>
	);
}

function WeightLoggedDaysCard({ weightHeatmap }) {
	return (
		<Card className="flex min-h-0 flex-col overflow-hidden">
			<CardHeader className={compactHeader} title="Logged days" />
			<CardBody
				className={`${compactBody} flex min-h-0 flex-1 flex-col justify-center overflow-hidden pt-1`}
			>
				<CompactActivityTile
					timeline={(weightHeatmap?.timeline || []).map((d) => ({
						...d,
						intensity: d.logged ? 1 : 0
					}))}
					weeks={HEATMAP_WEEKS}
					emptyLabel="No weigh-in"
				/>
			</CardBody>
		</Card>
	);
}

const recentSetsHeader = 'items-center p-2 pb-0.5 lg:p-3 lg:pb-0';
const recentSetsBody = 'p-2 pt-0 lg:p-3 lg:pt-0';

function TimingViewToggle({ view, onChange }) {
	return (
		<div className="flex shrink-0 gap-1">
			{[
				{ id: 'sessions', label: 'Sessions' },
				{ id: 'sets', label: 'Sets' }
			].map((option) => (
				<button
					key={option.id}
					type="button"
					onClick={() => onChange(option.id)}
					className={`cursor-pointer rounded-sm px-2 py-0.5 text-[11px] font-medium ${
						view === option.id ? 'bg-primary/15 text-primary' : 'text-muted hover:text-fg'
					}`}
				>
					{option.label}
				</button>
			))}
		</div>
	);
}

function RecentSetsPanel({ setsData, sessionsData }) {
	const [view, setView] = useState('sessions');
	const isSessions = view === 'sessions';
	const hasSets = (setsData?.set_count ?? 0) > 0;
	const hasSessions = (sessionsData?.session_count ?? 0) > 0;
	const hasData = isSessions ? hasSessions : hasSets;
	const statsLabel = isSessions
		? hasSessions
			? `${sessionsData.session_count} session${sessionsData.session_count === 1 ? '' : 's'} · avg ${formatDurationSeconds(sessionsData.avg_work_seconds)} work`
			: null
		: hasSets
			? `${setsData.set_count} sets · ${setsData.session_count} session${setsData.session_count === 1 ? '' : 's'} · avg ${formatDurationSeconds(setsData.avg_work_seconds)} work`
			: null;

	return (
		<Card className="flex min-h-0 flex-col">
			<CardHeader
				className={recentSetsHeader}
				title={isSessions ? 'Recent sessions' : 'Recent sets'}
				action={
					<div className="flex min-w-0 items-center gap-2">
						{statsLabel ? (
							<p className="text-muted hidden shrink-0 text-[11px] leading-tight sm:block">
								{statsLabel}
							</p>
						) : null}
						<TimingViewToggle view={view} onChange={setView} />
					</div>
				}
			/>
			<CardBody className={recentSetsBody}>
				{hasData ? (
					<SetWorkRestBarChart
						sets={isSessions ? sessionsData.sessions : setsData.sets}
						strip
						className="h-[135px] w-full"
					/>
				) : (
					<p className="text-muted text-sm">
						{isSessions
							? 'Finish workouts with the set timer to see work and rest per session.'
							: 'Log workouts with the set timer to see recent work and rest per set.'}
					</p>
				)}
			</CardBody>
		</Card>
	);
}

function MovementCard({ groups, dense = false }) {
	return (
		<Card className="flex min-h-0 flex-col overflow-hidden lg:h-full">
			<CardBody
				className={
					dense
						? 'flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden p-1'
						: `${compactBody} flex w-full flex-1 items-center justify-center`
				}
			>
				<MovementDonut groups={groups} size={dense ? 80 : 88} />
			</CardBody>
		</Card>
	);
}

export default function Dashboard() {
	const navigate = useNavigate();
	const user = useAuthStore((s) => s.user);
	const { data, isLoading } = useDashboard();
	const { data: heatmap } = useTrainingHeatmap(HEATMAP_DAYS);
	const { data: volumeSeries } = useTrainingSeries(CHART_DAYS);
	const { data: weightProfile } = useWeightProfile();
	const { data: weightSeries } = useWeightSeries({ days: CHART_DAYS });
	const weightStatsParams = useMemo(() => {
		const end = localDateKey();
		const start = format(subDays(parseISO(end), CHART_DAYS - 1), 'yyyy-MM-dd');
		return { date__gte: start, date__lte: end };
	}, []);
	const { data: weightStats } = useWeightStats(weightStatsParams);
	const { data: weightHeatmap } = useWeightHeatmap(HEATMAP_DAYS);
	const { data: recentSets } = useRecentSets(RECENT_SET_LIMIT);
	const { data: recentSessions } = useRecentSessions(RECENT_SESSION_LIMIT);
	const { data: rpeSessionsPage } = sessionsApi.useList({
		status: 'completed',
		page_size: RPE_SESSION_LIMIT
	});

	const volumeData = useMemo(
		() =>
			(volumeSeries?.points || []).map((d) => ({
				...d,
				// Match Body Trend: only plot real sessions in the area (gaps stay null).
				volume_kg: d.trained || d.volume_kg > 0 ? d.volume_kg : null
			})),
		[volumeSeries?.points]
	);
	const volumeDomain = useMemo(() => valueDomain(volumeData, 'volume_kg'), [volumeData]);
	const weightChartData = useMemo(
		() => padWeightPoints(weightSeries?.points || [], CHART_DAYS),
		[weightSeries?.points]
	);

	if (isLoading || !data) return <LoadingScreen />;

	const { training, weight } = data;
	const firstName = (user?.full_name || '').split(' ')[0];
	const weightUnit = weightProfile?.unit || weightSeries?.unit || weight.unit || 'kg';
	const rpeSessions = rpeSessionsPage?.results || [];

	return (
		<div className="lg:-my-6 lg:flex lg:h-[calc(100dvh-4rem)] lg:min-h-0 lg:flex-col lg:overflow-hidden lg:py-2">
			<PageHeader
				title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
				icon={LayoutDashboard}
				description={
					training.last_session
						? `Last workout ${formatDate(training.last_session.date, 'EEE, MMM d')}`
						: 'No workouts logged yet — start with a routine.'
				}
				actions={
					<>
						<Button variant="secondary" size="sm" onClick={() => navigate('/body')}>
							<Scale size={16} />
							Body
						</Button>
						<Button variant="secondary" size="sm" onClick={() => navigate('/history')}>
							<History size={16} />
							History
						</Button>
					</>
				}
				className="lg:mb-2 lg:shrink-0 lg:gap-2"
			/>

			<motion.div
				variants={container}
				initial="initial"
				animate="animate"
				className="space-y-4 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-2 lg:space-y-0"
			>
				<motion.div
					variants={item}
					className="grid grid-cols-1 gap-2 lg:h-24 lg:max-h-24 lg:shrink-0 lg:grid-cols-4 lg:gap-2 lg:overflow-hidden"
				>
					<div className="min-h-0 min-w-0 lg:h-full">
						<TodayCard
							training={training}
							activeSession={data.active_session}
							suggested={data.suggested_routine}
							todayIsRest={data.today_is_rest}
						/>
					</div>

					<div className="grid min-h-0 grid-cols-2 grid-rows-2 gap-1 lg:h-full">
						<StatCard
							dense
							icon={Flame}
							label="Streak"
							value={training.streak_days}
							className="px-2 py-1"
						/>
						<StatCard
							dense
							icon={Dumbbell}
							label="Workouts"
							value={training.total_sessions}
							onClick={() => navigate('/history')}
							className="px-2 py-1"
						/>
						<StatCard
							dense
							icon={Activity}
							label="Volume"
							value={`${Math.round(training.volume_this_week_kg)} kg`}
							trend={
								training.volume_change_pct > 0
									? 'up'
									: training.volume_change_pct < 0
										? 'down'
										: 'flat'
							}
							className="px-2 py-1"
						/>
						<StatCard
							dense
							icon={Scale}
							label="Weight"
							value={weight.current != null ? formatWeight(weight.current, weight.unit) : '—'}
							onClick={() => navigate('/body')}
							className="px-2 py-1"
						/>
					</div>

					<Card className="flex min-h-0 flex-col overflow-hidden lg:h-full">
						<CardBody className="min-h-0 flex-1 overflow-hidden p-0!">
							<div className="h-full min-h-0">
								<RpeSessionChart sessions={rpeSessions} />
							</div>
						</CardBody>
					</Card>

					<MovementCard dense groups={data.muscle_groups} />
				</motion.div>

				<motion.div
					variants={item}
					className="grid grid-cols-1 gap-4 lg:h-[190px] lg:max-h-[190px] lg:shrink-0 lg:grid-cols-2 lg:gap-2"
				>
					<Card className="flex min-h-0 flex-col">
						<CardHeader className={compactHeader} title="Volume" />
						<CardBody className={`${compactBody} flex min-h-0 flex-1 flex-col py-1`}>
							<div className={`${chartHeight} min-h-0 flex-1`}>
								<DashAreaChart
									data={volumeData}
									dataKey="volume_kg"
									name="Volume (kg)"
									gradientId="volumeFill"
									tooltipLabel={(v) => `${Math.round(Number(v))} kg`}
									domain={volumeDomain}
								/>
							</div>
						</CardBody>
					</Card>

					<Card className="flex min-h-0 flex-col overflow-hidden">
						<CardHeader className={compactHeader} title="Training days" />
						<CardBody
							className={`${compactBody} flex min-h-0 flex-1 flex-col justify-center overflow-hidden pt-1`}
						>
							<CompactActivityTile
								timeline={heatmap?.timeline || []}
								weeks={HEATMAP_WEEKS}
								emptyLabel="Rest day"
							/>
						</CardBody>
					</Card>
				</motion.div>

				<motion.div
					variants={item}
					className="grid grid-cols-1 gap-4 lg:h-[190px] lg:max-h-[190px] lg:shrink-0 lg:grid-cols-2 lg:gap-2"
				>
					<WeightTrendCard unit={weightUnit} chartData={weightChartData} stats={weightStats} />
					<WeightLoggedDaysCard weightHeatmap={weightHeatmap} />
				</motion.div>

				<motion.div variants={item} className="lg:shrink-0">
					<RecentSetsPanel setsData={recentSets} sessionsData={recentSessions} />
				</motion.div>
			</motion.div>
		</div>
	);
}
