import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
	AlertTriangle,
	Check,
	Coffee,
	Dumbbell,
	Feather,
	Pause,
	Play,
	RotateCcw,
	Square,
	Timer,
	Trash2
} from 'lucide-react';

import { PageHeader } from '../components/layout/PageHeader';
import {
	Badge,
	Button,
	Card,
	CardBody,
	CardHeader,
	EmptyState,
	Input,
	LoadingScreen,
	Modal,
	Select
} from '../components/ui';
import { MildBadge } from '../components/workouts/MildBadge';
import { WorkoutSummary } from '../components/workouts/WorkoutSummary';
import { useWorkoutAutoAdvance } from '../hooks/useWorkoutAutoAdvance';
import { cn } from '../lib/format';
import { formatTimerDisplay } from '../lib/timerFormat';
import {
	routinesApi,
	useAbandonSession,
	useActiveSession,
	useCompleteSession,
	useStartSession,
	useSuggestedRoutine
} from '../lib/resources';
import { isExerciseFinished, loggedSets } from '../lib/workoutSession';
import {
	selectCanUndoLastSet,
	selectDisplaySeconds,
	selectRestRemaining,
	selectResting,
	useWorkoutTimerStore
} from '../stores/workoutTimerStore';

function describePrescription(sessionExercise) {
	const { track_mode, planned_sets, planned_reps, planned_hold_seconds, target_load_kg } =
		sessionExercise;
	const volume =
		track_mode === 'hold'
			? `${planned_sets} × ${planned_hold_seconds}s hold`
			: `${planned_sets} × ${planned_reps}`;
	return target_load_kg ? `${volume} @ ${Number(target_load_kg)} kg` : volume;
}

// -----------------------------------------------------------------------------
// Routine picker (sessions must start from a saved routine)
// -----------------------------------------------------------------------------

function RoutinePicker() {
	const navigate = useNavigate();
	const { data, isLoading } = routinesApi.useList({ is_active: true, page_size: 100 });
	const { data: suggested } = useSuggestedRoutine();
	const start = useStartSession();
	const routines = data?.results || [];
	const suggestedId = suggested?.template?.id;
	const restDay = suggested?.reason === 'rest';
	const scheduled = suggested?.reason === 'scheduled';

	if (isLoading) return <LoadingScreen />;

	if (!routines.length) {
		return (
			<EmptyState
				icon={Dumbbell}
				title="No routines yet"
				description="Workouts start from a saved routine so every session has a plan. Build one first."
				action={<Button onClick={() => navigate('/routines')}>Create a routine</Button>}
			/>
		);
	}

	return (
		<div className="space-y-3">
			{restDay && (
				<Card>
					<CardBody className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<div className="min-w-0 flex-1">
							<Badge>Rest day</Badge>
							<p className="text-fg mt-1.5 text-base font-semibold">Scheduled rest</p>
							<p className="text-muted text-xs">
								No routine is assigned today. You can still start one below.
							</p>
						</div>
						<Button variant="ghost" size="sm" onClick={() => navigate('/routines')}>
							Edit split
						</Button>
					</CardBody>
				</Card>
			)}

			{suggested?.template && (
				<Card className="border-primary/40">
					<CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center">
						<div className="min-w-0 flex-1">
							<Badge tone="primary">{scheduled ? 'Today' : 'Up next'}</Badge>
							<p className="text-fg mt-1.5 text-base font-semibold">{suggested.template.name}</p>
							<p className="text-muted text-xs">
								{suggested.template.exercise_count} exercises · {suggested.template.planned_sets}{' '}
								sets · ~{suggested.template.estimated_minutes} min
								{suggested.template.last_performed
									? ` · last done ${suggested.template.last_performed}`
									: ' · never done'}
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Button
								onClick={() => start.mutate({ template: suggested.template.id })}
								loading={start.isPending}
							>
								<Play size={16} />
								Start
							</Button>
							<Button
								variant="secondary"
								onClick={() => start.mutate({ template: suggested.template.id, mild: true })}
								loading={start.isPending}
							>
								<Feather size={16} />
								Start Mild
							</Button>
						</div>
					</CardBody>
				</Card>
			)}

			<Card>
				<CardHeader title="All routines" subtitle="Pick what you are training today" />
				<CardBody className="space-y-2">
					{routines.map((routine) => (
						<div
							key={routine.id}
							className="border-line flex items-center gap-3 rounded-md border px-3 py-2.5"
						>
							<div className="min-w-0 flex-1">
								<p className="text-fg truncate text-sm font-medium">{routine.name}</p>
								<p className="text-muted text-xs">
									{routine.exercise_count} exercises · {routine.planned_sets} sets · ~
									{routine.estimated_minutes} min
								</p>
							</div>
							{routine.id === suggestedId && <Badge tone="primary">Suggested</Badge>}
							<div className="flex shrink-0 items-center gap-1.5">
								<Button
									size="sm"
									variant="ghost"
									onClick={() => start.mutate({ template: routine.id })}
									loading={start.isPending}
								>
									Start
								</Button>
								<Button
									size="sm"
									variant="ghost"
									onClick={() => start.mutate({ template: routine.id, mild: true })}
									loading={start.isPending}
								>
									<Feather size={14} />
									Start Mild
								</Button>
							</div>
						</div>
					))}
				</CardBody>
			</Card>
		</div>
	);
}

// -----------------------------------------------------------------------------
// Nested timer rings: sets (outer, warning), session (middle, primary), rest (inner)
// -----------------------------------------------------------------------------

const RING_TONE = {
	primary: 'var(--primary)',
	success: 'var(--success)',
	warning: 'var(--warning)',
	danger: 'var(--danger)'
};

function RingArc({ cx, cy, r, stroke, pct, color }) {
	const c = 2 * Math.PI * r;
	const clamped = Math.max(0, Math.min(100, pct));
	return (
		<>
			<circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
			<circle
				cx={cx}
				cy={cy}
				r={r}
				fill="none"
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeDasharray={c}
				strokeDashoffset={c - (clamped / 100) * c}
				style={{
					stroke: color,
					transition: 'stroke-dashoffset 0.5s linear, stroke 0.35s ease'
				}}
			/>
		</>
	);
}

function TimerRings({
	sessionExercise,
	totals,
	restPct,
	restTone,
	size = 300,
	stroke = 8,
	children
}) {
	const setsDone = sessionExercise ? loggedSets(sessionExercise) : 0;
	const setsGoal = sessionExercise ? Math.max(1, sessionExercise.planned_sets) : 0;
	const setsPct = setsGoal ? Math.min(100, (setsDone / setsGoal) * 100) : 0;
	const sessionPct = totals.planned ? Math.min(100, (totals.done / totals.planned) * 100) : 0;

	const gap = 2;
	const cx = size / 2;
	const outerR = (size - stroke) / 2;
	const middleR = outerR - stroke - gap;
	const innerR = middleR - stroke - gap;

	return (
		<div
			className="relative inline-flex items-center justify-center"
			style={{ width: size, height: size }}
		>
			<svg
				width={size}
				height={size}
				className="-rotate-90"
				aria-label={`Sets ${setsDone}/${setsGoal}, session ${totals.done}/${totals.planned}${
					restPct > 0 ? `, rest ${Math.round(restPct)}%` : ''
				}`}
			>
				<RingArc
					cx={cx}
					cy={cx}
					r={outerR}
					stroke={stroke}
					pct={setsPct}
					color={RING_TONE.warning}
				/>
				<RingArc
					cx={cx}
					cy={cx}
					r={middleR}
					stroke={stroke}
					pct={sessionPct}
					color={RING_TONE.primary}
				/>
				<RingArc
					cx={cx}
					cy={cx}
					r={innerR}
					stroke={stroke}
					pct={restPct}
					color={RING_TONE[restTone] || RING_TONE.primary}
				/>
			</svg>
			<div className="absolute inset-0 flex items-center justify-center">{children}</div>
		</div>
	);
}

// -----------------------------------------------------------------------------
// The set timer
// -----------------------------------------------------------------------------

function SetTimer({ sessionExercise, totals, onSetLogged }) {
	const { finishSet, undoLastSet, logging, undoing } = useWorkoutAutoAdvance();
	const timer = useWorkoutTimerStore();
	const displaySeconds = useWorkoutTimerStore(selectDisplaySeconds);
	const restRemaining = useWorkoutTimerStore(selectRestRemaining);
	const resting = useWorkoutTimerStore(selectResting);
	const undoAvailable = useWorkoutTimerStore(selectCanUndoLastSet);
	const [undoOpen, setUndoOpen] = useState(false);
	const alarmActive = timer.alarmActive;
	const working = timer.phase === 'work';
	const restOrAlarm = resting || alarmActive;
	const restTotal =
		timer.restEndAt != null && timer.restStartedAt != null
			? (timer.restEndAt - timer.restStartedAt) / 1000
			: 0;
	const restPct = restTotal > 0 ? (restRemaining / restTotal) * 100 : 0;
	const ringTone = alarmActive ? 'danger' : resting ? 'success' : 'primary';

	// Re-render every second while a clock is moving.
	const ticking = timer.running || timer.restEndAt != null;
	useEffect(() => {
		if (!ticking) return undefined;
		const id = window.setInterval(() => useWorkoutTimerStore.setState({}), 500);
		return () => window.clearInterval(id);
	}, [ticking]);

	const isHold = timer.trackMode === 'hold';
	const headerExercise =
		timer.phase === 'rest_exercise' && timer.pendingNextExercise
			? timer.pendingNextExercise
			: sessionExercise;

	const submitSet = async ({ skipped = false } = {}) => {
		await finishSet({ skipped });
		onSetLogged?.();
	};

	const confirmUndo = async () => {
		await undoLastSet();
		setUndoOpen(false);
		onSetLogged?.();
	};

	// Space toggles Start set / Stop set (ignored while typing in fields).
	useEffect(() => {
		const onKeyDown = (event) => {
			if (
				event.code !== 'Space' ||
				event.repeat ||
				event.metaKey ||
				event.ctrlKey ||
				event.altKey
			) {
				return;
			}
			const target = event.target;
			const tag = target?.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
				return;
			}
			event.preventDefault();
			if (logging || undoing) return;
			if (useWorkoutTimerStore.getState().phase === 'work') {
				void finishSet({ skipped: false }).then(() => onSetLogged?.());
			} else {
				useWorkoutTimerStore.getState().startSet();
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [logging, undoing, finishSet, onSetLogged]);

	const PhaseIcon = alarmActive ? AlertTriangle : resting ? Coffee : working ? Timer : Play;

	const badgeTone = alarmActive
		? 'danger'
		: resting
			? 'success'
			: timer.running
				? 'primary'
				: 'neutral';

	return (
		<>
			<Card>
				<CardHeader
					title={headerExercise.exercise_name}
					subtitle={
						timer.phase === 'rest_exercise'
							? `Up next · ${describePrescription(headerExercise)}`
							: `Set ${timer.setIndex} of ${sessionExercise.planned_sets} · ${describePrescription(sessionExercise)}`
					}
				/>
				<CardBody className="space-y-4">
					<div className="flex justify-center">
						<TimerRings
							sessionExercise={sessionExercise}
							totals={totals}
							restPct={restPct}
							restTone={ringTone}
						>
							<p
								className={cn(
									'font-mono text-5xl font-semibold tabular-nums transition-colors duration-300 sm:text-6xl',
									alarmActive && 'text-danger animate-pulse',
									!alarmActive && resting && 'text-success',
									!alarmActive && !resting && timer.running && 'text-primary',
									!alarmActive && !resting && !timer.running && 'text-fg'
								)}
							>
								{formatTimerDisplay(displaySeconds)}
							</p>
						</TimerRings>
					</div>

					<div className="space-y-2">
						<div className="relative h-10">
							<AnimatePresence initial={false}>
								{working ? (
									<motion.div
										key="stop"
										className="absolute inset-0"
										initial={{ opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -8 }}
										transition={{ duration: 0.2, ease: 'easeOut' }}
									>
										<Button
											variant="primary"
											onClick={() => submitSet()}
											loading={logging}
											disabled={!working || undoing}
											className="h-10 w-full justify-center"
										>
											<Square size={16} />
											Stop set
										</Button>
									</motion.div>
								) : (
									<motion.div
										key="start"
										className="absolute inset-0"
										initial={{ opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -8 }}
										transition={{ duration: 0.2, ease: 'easeOut' }}
									>
										<Button
											onClick={timer.startSet}
											disabled={working || undoing}
											className={cn('h-10 w-full justify-center', alarmActive && 'animate-pulse')}
										>
											<Play size={16} />
											Start set
										</Button>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
						<div className="relative h-10">
							<AnimatePresence initial={false}>
								{working && !timer.running ? (
									<motion.div
										key="resume"
										className="absolute inset-0"
										initial={{ opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -8 }}
										transition={{ duration: 0.2, ease: 'easeOut' }}
									>
										<Button
											variant="secondary"
											onClick={timer.startSet}
											className="h-10 w-full justify-center"
										>
											<Play size={16} />
											Resume
										</Button>
									</motion.div>
								) : (
									<motion.div
										key="pause"
										className="absolute inset-0"
										initial={{ opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -8 }}
										transition={{ duration: 0.2, ease: 'easeOut' }}
									>
										<Button
											variant="secondary"
											onClick={timer.pauseSet}
											disabled={!working || !timer.running || undoing}
											className="h-10 w-full justify-center"
										>
											<Pause size={16} />
											Pause
										</Button>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
						{undoAvailable && (
							<Button
								variant="ghost"
								onClick={() => setUndoOpen(true)}
								loading={undoing}
								disabled={logging}
								className="h-10 w-full justify-center"
							>
								<RotateCcw size={16} />
								Undo last set
							</Button>
						)}
					</div>

					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						<Input
							label="Load (kg)"
							type="number"
							step="0.5"
							min="0"
							max="500"
							value={timer.loadInput}
							onChange={(e) => timer.setLoadInput(e.target.value)}
							placeholder={timer.targetLoad || 'Bodyweight'}
						/>
						<Select
							label="RPE"
							value={timer.rpeInput}
							onChange={(e) => timer.setRpeInput(e.target.value)}
						>
							<option value="">—</option>
							{[5, 6, 7, 8, 9, 10].map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</Select>
						<div className="flex items-end">
							<Button
								variant="ghost"
								className="w-full"
								onClick={() => submitSet({ skipped: true })}
								loading={logging}
								disabled={restOrAlarm || undoing}
							>
								Skip this set
							</Button>
						</div>
					</div>
				</CardBody>
			</Card>

			<Modal
				open={undoOpen}
				onClose={() => setUndoOpen(false)}
				title="Undo last set?"
				size="sm"
				footer={
					<>
						<Button variant="ghost" onClick={() => setUndoOpen(false)} disabled={undoing}>
							Keep rest
						</Button>
						<Button onClick={confirmUndo} loading={undoing}>
							Undo last set
						</Button>
					</>
				}
			>
				<p className="text-muted text-sm">
					Removes the set you just logged and returns you to that set with the same work time, load,
					and RPE. Rest time since stopping is discarded.
				</p>
			</Modal>
		</>
	);
}

// -----------------------------------------------------------------------------
// Page
// -----------------------------------------------------------------------------

export default function TrainPage() {
	const { data, isLoading, refetch } = useActiveSession();
	const complete = useCompleteSession();
	const abandon = useAbandonSession();
	const [finishOpen, setFinishOpen] = useState(false);
	const [effort, setEffort] = useState('7');
	const [notes, setNotes] = useState('');
	const [summarySession, setSummarySession] = useState(null);

	const session = data?.session || null;
	const attachSession = useWorkoutTimerStore((s) => s.attachSession);
	const clearSession = useWorkoutTimerStore((s) => s.clearSession);
	const loadSet = useWorkoutTimerStore((s) => s.loadSet);
	const storedSessionId = useWorkoutTimerStore((s) => s.sessionId);
	const storedExerciseId = useWorkoutTimerStore((s) => s.sessionExerciseId);

	useEffect(() => {
		if (session) attachSession({ id: session.id, name: session.template_name });
		else if (storedSessionId != null) clearSession();
	}, [session, attachSession, clearSession, storedSessionId]);

	const exercises = useMemo(() => session?.exercises || [], [session]);

	/** The exercise the timer should be pointing at right now. */
	const current = useMemo(() => exercises.find((e) => !isExerciseFinished(e)) || null, [exercises]);

	// Keep the timer's prescription in sync with the server's view of progress.
	// Do not clobber an in-progress set or rest countdown.
	useEffect(() => {
		if (!current) return;
		const store = useWorkoutTimerStore.getState();
		if (store.phase !== 'idle') return;
		const nextIndex = loggedSets(current) + 1;
		const sameSet = store.sessionExerciseId === current.id && store.setIndex === nextIndex;
		if (!sameSet) loadSet(current, nextIndex);
	}, [current, storedExerciseId, loadSet]);

	const totals = useMemo(() => {
		const planned = exercises.reduce((sum, e) => (e.skipped ? sum : sum + e.planned_sets), 0);
		const done = exercises.reduce((sum, e) => sum + loggedSets(e), 0);
		return { planned, done };
	}, [exercises]);

	if (isLoading) return <LoadingScreen />;

	if (summarySession) {
		return <WorkoutSummary session={summarySession} onDone={() => setSummarySession(null)} />;
	}

	if (!session) {
		return (
			<div>
				<PageHeader
					title="Workout"
					icon={Timer}
					description="Start from a routine, then time every set. Rest waits for Start set."
				/>
				<RoutinePicker />
			</div>
		);
	}

	const finish = async () => {
		const completed = await complete.mutateAsync({
			sessionId: session.id,
			perceived_effort: effort === '' ? null : Number(effort),
			notes
		});
		clearSession();
		setFinishOpen(false);
		setNotes('');
		setEffort('7');
		setSummarySession(completed);
	};

	const discard = async () => {
		await abandon.mutateAsync(session.id);
		clearSession();
		refetch();
	};

	return (
		<div>
			<PageHeader
				title={
					<span className="inline-flex items-center gap-2">
						{session.template_name || 'Workout'}
						{session.is_mild && <MildBadge />}
					</span>
				}
				icon={Timer}
				description={`${totals.done} of ${totals.planned} planned sets logged`}
				actions={
					<>
						<Button variant="ghost" onClick={discard} loading={abandon.isPending}>
							<Trash2 size={16} />
							Discard
						</Button>
						<Button onClick={() => setFinishOpen(true)}>
							<Check size={16} />
							Finish
						</Button>
					</>
				}
			/>

			<div className="space-y-4">
				{current ? (
					<SetTimer sessionExercise={current} totals={totals} onSetLogged={refetch} />
				) : (
					<EmptyState
						icon={Check}
						title="Every set is logged"
						description="Finish the workout to save it and update your streak."
						action={<Button onClick={() => setFinishOpen(true)}>Finish workout</Button>}
					/>
				)}
			</div>

			<Modal
				open={finishOpen}
				onClose={() => setFinishOpen(false)}
				title="Finish workout"
				size="sm"
				footer={
					<>
						<Button variant="ghost" onClick={() => setFinishOpen(false)}>
							Keep going
						</Button>
						<Button onClick={finish} loading={complete.isPending}>
							Save workout
						</Button>
					</>
				}
			>
				<div className="space-y-3">
					<p className="text-muted text-sm">
						{totals.done} sets logged. Calories and volume are calculated when you save.
					</p>
					<Select
						label="How hard was it? (RPE)"
						value={effort}
						onChange={(e) => setEffort(e.target.value)}
					>
						<option value="">Skip</option>
						{[4, 5, 6, 7, 8, 9, 10].map((n) => (
							<option key={n} value={n}>
								{n}
							</option>
						))}
					</Select>
					<Input
						label="Notes"
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="Optional"
					/>
				</div>
			</Modal>
		</div>
	);
}
