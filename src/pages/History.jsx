import { useMemo, useState } from 'react';
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis
} from 'recharts';
import { Activity, Dumbbell, Flame, History as HistoryIcon, Trash2 } from 'lucide-react';

import { CompactActivityTile } from '../components/analytics/ActivityHeatmap';
import { PageHeader } from '../components/layout/PageHeader';
import {
	Badge,
	Button,
	Card,
	CardBody,
	CardHeader,
	EmptyState,
	LoadingScreen,
	Modal,
	StatCard
} from '../components/ui';
import { formatDate, formatDurationSeconds } from '../lib/format';
import {
	sessionsApi,
	useTrainingHeatmap,
	useTrainingSeries,
	useTrainingStats
} from '../lib/resources';

const STATUS_TONE = { completed: 'success', active: 'primary', abandoned: 'neutral' };

function isRoutineSession(session) {
	return session.template != null || Boolean(session.template_name);
}

function sessionRowTitle(session) {
	return isRoutineSession(session) ? 'Routine session' : 'Workout';
}

function sessionRowSubtitle(session) {
	const stats = `${formatDate(session.date, 'EEE, MMM d, yyyy')} · ${session.total_sets} sets · ${Number(session.total_volume_kg)} kg · ${formatDurationSeconds(session.duration_seconds)} · ${Number(session.calories_burned)} kcal`;
	return session.template_name ? `${session.template_name} · ${stats}` : stats;
}

function sessionSetChartData(session) {
	const rows = [];
	for (const exercise of session.exercises || []) {
		for (const set of exercise.sets || []) {
			if (set.skipped) continue;
			rows.push({
				key: `${exercise.id}-${set.index}`,
				tick: String(rows.length + 1),
				name: exercise.exercise_name,
				index: set.index,
				work: set.work_seconds || 0,
				rest: set.rest_seconds || 0
			});
		}
	}
	return rows;
}

function setTimeTooltip() {
	return (
		<Tooltip
			labelFormatter={(_, payload) => {
				const row = payload?.[0]?.payload;
				return row ? `${row.name} · set ${row.index}` : '';
			}}
			formatter={(value, name) => [formatDurationSeconds(value), name]}
			contentStyle={{
				background: 'var(--surface)',
				border: '1px solid var(--line)',
				borderRadius: 8,
				fontSize: 12
			}}
		/>
	);
}

function SessionSetChart({ session, compact = false, onClick }) {
	const data = useMemo(() => sessionSetChartData(session), [session]);
	if (!data.length) return null;

	return (
		<div
			className={compact ? 'h-12 w-28 shrink-0 cursor-pointer sm:h-14 sm:w-40' : 'mb-3 h-44'}
			onClick={onClick}
			role={compact ? 'img' : undefined}
			aria-label={compact ? 'Work and rest per set' : undefined}
		>
			<ResponsiveContainer width="100%" height="100%">
				<BarChart
					data={data}
					margin={
						compact
							? { top: 2, right: 0, left: 0, bottom: 2 }
							: { top: 4, right: 4, left: -12, bottom: 0 }
					}
					barCategoryGap={compact ? 2 : 8}
				>
					{!compact && <CartesianGrid stroke="var(--line)" vertical={false} />}
					{!compact && (
						<XAxis
							dataKey="tick"
							tick={{ fill: 'var(--muted)', fontSize: 11 }}
							axisLine={false}
							tickLine={false}
						/>
					)}
					{!compact && (
						<YAxis
							tick={{ fill: 'var(--muted)', fontSize: 11 }}
							axisLine={false}
							tickLine={false}
							tickFormatter={(value) => formatDurationSeconds(value)}
						/>
					)}
					{setTimeTooltip()}
					{!compact && <Legend wrapperStyle={{ fontSize: 12 }} />}
					<Bar
						dataKey="work"
						name="Work"
						stackId="time"
						fill="var(--primary)"
						maxBarSize={compact ? 10 : undefined}
					/>
					<Bar
						dataKey="rest"
						name="Rest"
						stackId="time"
						fill="var(--success)"
						maxBarSize={compact ? 10 : undefined}
						radius={[4, 4, 0, 0]}
					/>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}

function SessionDetail({ session, onClose }) {
	if (!session) return null;
	return (
		<Modal
			open
			onClose={onClose}
			title={session.template_name || 'Workout'}
			size="md"
			footer={
				<Button variant="ghost" onClick={onClose}>
					Close
				</Button>
			}
		>
			<p className="text-muted mb-3 text-sm">
				{formatDate(session.date, 'EEEE, MMM d, yyyy')} · {session.total_sets} sets ·{' '}
				{session.total_reps} reps · {Number(session.total_volume_kg)} kg ·{' '}
				{Number(session.calories_burned)} kcal
			</p>

			<SessionSetChart session={session} />
			<div className="space-y-3">
				{(session.exercises || []).map((exercise) => (
					<div key={exercise.id} className="border-line rounded-md border px-3 py-2">
						<div className="flex items-center gap-2">
							<p className="text-fg min-w-0 flex-1 truncate text-sm font-medium">
								{exercise.exercise_name}
							</p>
							{exercise.skipped && <Badge>Skipped</Badge>}
						</div>
						{(exercise.sets || []).length ? (
							<div className="mt-1.5 space-y-1">
								{exercise.sets.map((set) => (
									<p key={set.id} className="text-muted text-xs">
										Set {set.index}:{' '}
										{exercise.track_mode === 'hold'
											? `${set.hold_seconds}s hold`
											: `${set.reps} reps`}
										{set.load_kg ? ` @ ${Number(set.load_kg)} kg` : ''} ·{' '}
										{formatDurationSeconds(set.work_seconds)} work
										{set.rest_seconds ? ` · ${formatDurationSeconds(set.rest_seconds)} rest` : ''}
										{set.rpe ? ` · RPE ${set.rpe}` : ''}
										{set.skipped ? ' · skipped' : ''}
									</p>
								))}
							</div>
						) : (
							<p className="text-muted mt-1 text-xs">No sets logged.</p>
						)}
					</div>
				))}
			</div>
			{session.notes && <p className="text-muted mt-3 text-sm">“{session.notes}”</p>}
		</Modal>
	);
}

export default function HistoryPage() {
	const { data: stats } = useTrainingStats(28);
	const { data: series } = useTrainingSeries(30);
	const { data: heatmap } = useTrainingHeatmap(84);
	const { data, isLoading } = sessionsApi.useList({ page_size: 40, ordering: '-date' });
	const remove = sessionsApi.useRemove();
	const [detail, setDetail] = useState(null);
	const [deleteTarget, setDeleteTarget] = useState(null);

	const sessions = data?.results || [];
	const chartData = useMemo(
		() => (series?.points || []).map((point) => ({ ...point, label: point.date })),
		[series]
	);

	if (isLoading) return <LoadingScreen />;

	return (
		<div>
			<PageHeader
				title="History"
				icon={HistoryIcon}
				description="Every logged workout, with volume and consistency trends."
			/>

			<div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
				<StatCard
					icon={Flame}
					label="Current streak"
					value={stats?.streak_days ?? 0}
					sublabel={`Best ${stats?.longest_streak_days ?? 0} days`}
				/>
				<StatCard
					icon={Dumbbell}
					label="Sets this week"
					value={stats?.this_week?.sets ?? 0}
					sublabel={`${stats?.this_week?.sessions ?? 0} sessions`}
				/>
				<StatCard
					icon={Activity}
					label="Volume this week"
					value={`${Math.round(stats?.this_week?.volume_kg ?? 0)} kg`}
					sublabel={
						stats?.volume_change_pct != null ? `${stats.volume_change_pct}% vs last week` : '—'
					}
					trend={
						stats?.volume_change_pct > 0 ? 'up' : stats?.volume_change_pct < 0 ? 'down' : 'flat'
					}
				/>
				<StatCard
					icon={Flame}
					label="Calories this week"
					value={Math.round(stats?.this_week?.calories ?? 0)}
					sublabel="kcal from training"
				/>
			</div>

			<div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader title="Daily volume" subtitle="Last 30 days" />
					<CardBody>
						<div className="h-56">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={chartData}>
									<CartesianGrid stroke="var(--line)" vertical={false} />
									<XAxis
										dataKey="label"
										tickFormatter={(d) => formatDate(d, 'MMM d')}
										tick={{ fill: 'var(--muted)', fontSize: 11 }}
										axisLine={false}
										tickLine={false}
									/>
									<YAxis
										tick={{ fill: 'var(--muted)', fontSize: 11 }}
										axisLine={false}
										tickLine={false}
									/>
									<Tooltip
										labelFormatter={(d) => formatDate(d, 'EEE, MMM d')}
										contentStyle={{
											background: 'var(--surface)',
											border: '1px solid var(--line)',
											borderRadius: 8,
											fontSize: 12
										}}
									/>
									<Bar dataKey="volume_kg" name="Volume (kg)" fill="var(--primary)" radius={4} />
									<Bar dataKey="sets" name="Sets" fill="var(--accent)" radius={4} />
								</BarChart>
							</ResponsiveContainer>
						</div>
					</CardBody>
				</Card>

				<Card>
					<CardHeader title="Training days" subtitle="Last 12 weeks" />
					<CardBody className="flex justify-center">
						<CompactActivityTile timeline={heatmap?.timeline || []} weeks={12} />
					</CardBody>
				</Card>
			</div>

			<Card>
				<CardHeader title="Workouts" subtitle={`${sessions.length} most recent`} />
				<CardBody className="space-y-2">
					{!sessions.length && (
						<EmptyState
							icon={HistoryIcon}
							title="No workouts logged yet"
							description="Start a routine from the Workout page and your sessions will appear here."
						/>
					)}
					{sessions.map((session) => (
						<div
							key={session.id}
							className="border-line flex flex-wrap items-center gap-2 rounded-md border px-3 py-2.5"
						>
							<button
								type="button"
								onClick={() => setDetail(session)}
								className="min-w-40 flex-1 cursor-pointer text-left"
							>
								<p className="text-fg text-sm font-medium">{sessionRowTitle(session)}</p>
								<p className="text-muted text-xs">{sessionRowSubtitle(session)}</p>
							</button>
							<SessionSetChart session={session} compact onClick={() => setDetail(session)} />
							<Badge tone={STATUS_TONE[session.status]}>{session.status}</Badge>
							<button
								type="button"
								onClick={() => {
									setDeleteTarget(session);
								}}
								className="text-muted hover:text-danger cursor-pointer p-1"
								aria-label="Delete workout"
							>
								<Trash2 size={15} />
							</button>
						</div>
					))}
				</CardBody>
			</Card>

			<SessionDetail session={detail} onClose={() => setDetail(null)} />

			<Modal
				open={deleteTarget != null}
				onClose={() => setDeleteTarget(null)}
				title="Delete workout"
				size="sm"
				footer={
					<>
						<Button
							variant="ghost"
							onClick={() => setDeleteTarget(null)}
							disabled={remove.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="danger"
							onClick={() => {
								if (!deleteTarget) return;
								remove.mutate(deleteTarget.id, {
									onSuccess: () => setDeleteTarget(null)
								});
							}}
							loading={remove.isPending}
						>
							Delete
						</Button>
					</>
				}
			>
				<p className="text-muted text-sm">Delete this workout? Its sets are removed too.</p>
			</Modal>
		</div>
	);
}
