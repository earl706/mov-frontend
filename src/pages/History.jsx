import { useEffect, useMemo, useState } from 'react';
import { Activity, Dumbbell, Flame, History as HistoryIcon, Plus, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { CompactActivityTile } from '../components/analytics/ActivityHeatmap';
import { SetWorkRestBarChart } from '../components/analytics/SetWorkRestBarChart';
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
	Pagination,
	StatCard
} from '../components/ui';
import { SessionIntensityBadge } from '../components/workouts/MildBadge';
import { formatDate, formatDurationSeconds } from '../lib/format';
import {
	sessionsApi,
	useDeleteSet,
	useLogSet,
	useToggleSickDay,
	useTrainingHeatmap,
	useTrainingSeries,
	useTrainingStats
} from '../lib/resources';
import { formatTimerDisplay, parseTimerInput, sanitizeTimerInput } from '../lib/timerFormat';
import { sessionSetChartData } from '../lib/workoutSession';

const STATUS_TONE = { completed: 'success', active: 'primary', abandoned: 'neutral' };
const PAGE_SIZE = 5;
const MAX_SETS = 30;

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

function SessionSetChart({ session, compact = false, onClick }) {
	const sets = useMemo(() => sessionSetChartData(session), [session]);
	if (!sets.length) return null;

	return (
		<div
			onClick={onClick}
			role={compact ? 'img' : undefined}
			aria-label={compact ? 'Work and rest per set' : undefined}
			className={compact ? 'cursor-pointer' : undefined}
		>
			<SetWorkRestBarChart
				sets={sets}
				compact
				className={compact ? undefined : 'mb-3 h-44 w-full'}
			/>
		</div>
	);
}

function DurationInput({ seconds, onCommit, label, disabled }) {
	const [text, setText] = useState(() => formatTimerDisplay(seconds || 0));
	useEffect(() => {
		setText(formatTimerDisplay(seconds || 0));
	}, [seconds]);

	return (
		<label className="flex min-w-0 flex-1 items-center gap-1">
			<span className="text-muted shrink-0 text-[10px] font-medium uppercase">{label}</span>
			<input
				value={text}
				disabled={disabled}
				onChange={(e) => setText(sanitizeTimerInput(e.target.value))}
				onBlur={() => onCommit(parseTimerInput(text))}
				onKeyDown={(e) => {
					if (e.key === 'Enter') e.currentTarget.blur();
				}}
				aria-label={label}
				className="border-line bg-surface text-fg w-full rounded-sm border px-1.5 py-0.5 text-xs tabular-nums"
			/>
		</label>
	);
}

function setLogPayload(exercise, set, overrides = {}) {
	return {
		session_exercise: exercise.id,
		index: set.index,
		reps: set.reps,
		hold_seconds: set.hold_seconds,
		load_kg: set.load_kg,
		work_seconds: set.work_seconds,
		rest_seconds: set.rest_seconds,
		rpe: set.rpe,
		skipped: Boolean(set.skipped),
		notes: set.notes || '',
		...overrides
	};
}

function SessionDetail({ session, onClose, onSessionChange }) {
	const logSet = useLogSet();
	const deleteSet = useDeleteSet();
	const busy = logSet.isPending || deleteSet.isPending;

	if (!session) return null;

	const apply = (updated) => {
		if (updated) onSessionChange?.(updated);
	};

	const saveTiming = async (exercise, set, field, seconds) => {
		if (seconds === (set[field] || 0)) return;
		const updated = await logSet.mutateAsync({
			sessionId: session.id,
			...setLogPayload(exercise, set, { [field]: seconds })
		});
		apply(updated);
	};

	const addSet = async (exercise) => {
		const sets = exercise.sets || [];
		if (sets.length >= MAX_SETS) return;
		const last = sets[sets.length - 1];
		const updated = await logSet.mutateAsync({
			sessionId: session.id,
			session_exercise: exercise.id,
			index: (last?.index ?? 0) + 1,
			reps: last?.reps ?? exercise.planned_reps ?? 0,
			hold_seconds: last?.hold_seconds ?? exercise.planned_hold_seconds ?? 0,
			load_kg: last?.load_kg ?? exercise.target_load_kg ?? null,
			work_seconds: 0,
			rest_seconds: exercise.rest_set_seconds ?? 0,
			rpe: last?.rpe ?? null,
			skipped: false,
			notes: ''
		});
		apply(updated);
	};

	const removeSet = async (exercise, set) => {
		const updated = await deleteSet.mutateAsync({
			sessionId: session.id,
			session_exercise: exercise.id,
			index: set.index
		});
		apply(updated);
	};

	return (
		<Modal
			open
			onClose={onClose}
			title={session.template_name || 'Workout'}
			size="xl"
			footer={
				<Button variant="ghost" onClick={onClose}>
					Close
				</Button>
			}
		>
			<p className="text-muted mb-3 flex flex-wrap items-center gap-2 text-sm">
				<SessionIntensityBadge intensity={session.intensity} />
				<span>
					{formatDate(session.date, 'EEEE, MMM d, yyyy')} · {session.total_sets} sets ·{' '}
					{session.total_reps} reps · {Number(session.total_volume_kg)} kg ·{' '}
					{Number(session.calories_burned)} kcal
				</span>
			</p>
			<p className="text-muted mb-3 text-xs">
				Edit work and rest on each set. Add or remove sets — volume and calories update on save.
			</p>

			<SessionSetChart session={session} />
			<div className="grid grid-cols-3 gap-1">
				{(session.exercises || []).map((exercise) => {
					const sets = exercise.sets || [];
					return (
						<div key={exercise.id} className="border-line rounded-md border px-3 py-2">
							<div className="flex items-center gap-2">
								<p className="text-fg min-w-0 flex-1 truncate text-sm font-medium">
									{exercise.exercise_name}
								</p>
								{exercise.skipped && <Badge>Skipped</Badge>}
							</div>
							{sets.length ? (
								<div className="mt-1.5 space-y-1.5">
									{sets.map((set) => (
										<div key={set.id} className="space-y-1">
											<p className="text-muted text-xs">
												Set {set.index}:{' '}
												{exercise.track_mode === 'hold'
													? `${set.hold_seconds}s hold`
													: `${set.reps} reps`}
												{set.load_kg ? ` @ ${Number(set.load_kg)} kg` : ''}
												{set.rpe ? ` · RPE ${set.rpe}` : ''}
												{set.skipped ? ' · skipped' : ''}
											</p>
											<div className="flex items-center gap-1.5">
												<DurationInput
													seconds={set.work_seconds}
													label="Work"
													disabled={busy}
													onCommit={(seconds) =>
														saveTiming(exercise, set, 'work_seconds', seconds).catch(() => {})
													}
												/>
												<DurationInput
													seconds={set.rest_seconds}
													label="Rest"
													disabled={busy}
													onCommit={(seconds) =>
														saveTiming(exercise, set, 'rest_seconds', seconds).catch(() => {})
													}
												/>
												<button
													type="button"
													onClick={() => removeSet(exercise, set).catch(() => {})}
													disabled={busy}
													className="text-muted hover:text-danger cursor-pointer p-1 disabled:opacity-50"
													aria-label={`Remove set ${set.index}`}
												>
													<Trash2 size={13} />
												</button>
											</div>
										</div>
									))}
								</div>
							) : (
								<p className="text-muted mt-1 text-xs">No sets logged.</p>
							)}
							<Button
								size="sm"
								variant="ghost"
								className="mt-1.5 h-7 px-2 text-xs"
								disabled={busy || sets.length >= MAX_SETS}
								onClick={() => addSet(exercise).catch(() => {})}
							>
								<Plus size={12} />
								Add set
							</Button>
						</div>
					);
				})}
			</div>
			{session.notes && <p className="text-muted mt-3 text-sm">“{session.notes}”</p>}
		</Modal>
	);
}

export default function HistoryPage() {
	const { data: stats } = useTrainingStats(28);
	const { data: series } = useTrainingSeries(30);
	const { data: heatmap } = useTrainingHeatmap(84);
	const sickToggle = useToggleSickDay();
	const [page, setPage] = useState(1);
	const { data, isLoading, isFetching } = sessionsApi.useList({
		page,
		page_size: PAGE_SIZE,
		ordering: '-date'
	});
	const remove = sessionsApi.useRemove();
	const [detail, setDetail] = useState(null);
	const [deleteTarget, setDeleteTarget] = useState(null);

	const sessions = data?.results || [];
	const totalCount = data?.count ?? 0;
	const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
	const chartData = useMemo(
		() => (series?.points || []).map((point) => ({ ...point, label: point.date })),
		[series]
	);

	if (isLoading && !data) return <LoadingScreen />;

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
						<CompactActivityTile
							timeline={heatmap?.timeline || []}
							weeks={12}
							emptyLabel="No workout"
							showSchedule
							onToggleSick={sickToggle.toggle}
						/>
					</CardBody>
				</Card>
			</div>

			<Card>
				<CardHeader
					title="Workouts"
					subtitle={
						totalCount ? `${totalCount} total · click a session to edit sets` : 'No workouts yet'
					}
				/>
				<CardBody className={isFetching ? 'space-y-2 opacity-70' : 'space-y-2'}>
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
							<SessionIntensityBadge intensity={session.intensity} />
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
					<Pagination
						page={page}
						totalPages={totalPages}
						count={totalCount}
						pageSize={PAGE_SIZE}
						onPageChange={setPage}
					/>
				</CardBody>
			</Card>

			<SessionDetail session={detail} onClose={() => setDetail(null)} onSessionChange={setDetail} />

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
								const wasLastOnPage = sessions.length === 1 && page > 1;
								remove.mutate(deleteTarget.id, {
									onSuccess: () => {
										setDeleteTarget(null);
										if (wasLastOnPage) setPage((p) => Math.max(1, p - 1));
									}
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
