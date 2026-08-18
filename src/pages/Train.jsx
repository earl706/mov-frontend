import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Check, Dumbbell, Pause, Play, Square, Timer, Trash2 } from 'lucide-react';

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
	ProgressRing,
	Select
} from '../components/ui';
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
						<Button
							onClick={() => start.mutate({ template: suggested.template.id })}
							loading={start.isPending}
						>
							<Play size={16} />
							Start
						</Button>
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
							<Button
								size="sm"
								variant="ghost"
								onClick={() => start.mutate({ template: routine.id })}
								loading={start.isPending}
							>
								Start
							</Button>
						</div>
					))}
				</CardBody>
			</Card>
		</div>
	);
}

// -----------------------------------------------------------------------------
// Compact session progress (reps this set, sets this exercise, session sets)
// -----------------------------------------------------------------------------

function SessionProgress({ sessionExercise, totals }) {
	const timer = useWorkoutTimerStore();
	const isHold = sessionExercise?.track_mode === 'hold';
	const sameExercise = sessionExercise && timer.sessionExerciseId === sessionExercise.id;
	const repsDone = sameExercise ? timer.repsDone : 0;
	const repsGoal = sessionExercise ? (isHold ? 1 : sessionExercise.planned_reps || 1) : 0;
	const setsDone = sessionExercise ? loggedSets(sessionExercise) : 0;
	const setsGoal = sessionExercise ? Math.max(1, sessionExercise.planned_sets) : 0;

	const rings = [
		{
			key: 'reps',
			caption: isHold ? 'Hold' : 'Reps',
			value: repsGoal ? (repsDone / repsGoal) * 100 : 0,
			label: sessionExercise ? `${repsDone}/${repsGoal}` : '—'
		},
		{
			key: 'sets',
			caption: 'Sets',
			value: setsGoal ? (setsDone / setsGoal) * 100 : 0,
			label: sessionExercise ? `${setsDone}/${setsGoal}` : '—'
		},
		{
			key: 'session',
			caption: 'Session',
			value: totals.planned ? (totals.done / totals.planned) * 100 : 0,
			label: `${totals.done}/${totals.planned}`
		}
	];

	return (
		<Card className="lg:col-span-2">
			<CardHeader title="Progress" subtitle="This set, this exercise, this workout" />
			<CardBody>
				<div className="grid grid-cols-3 gap-2">
					{rings.map((ring) => (
						<div key={ring.key} className="flex flex-col items-center gap-1.5">
							<ProgressRing value={ring.value} size={72} stroke={6} label={ring.label} />
							<p className="text-muted text-xs">{ring.caption}</p>
						</div>
					))}
				</div>
			</CardBody>
		</Card>
	);
}

// -----------------------------------------------------------------------------
// The set timer
// -----------------------------------------------------------------------------

function SetTimer({ sessionExercise, onSetLogged }) {
	const { finishSet, logging } = useWorkoutAutoAdvance();
	const timer = useWorkoutTimerStore();
	const displaySeconds = useWorkoutTimerStore(selectDisplaySeconds);
	const restRemaining = useWorkoutTimerStore(selectRestRemaining);
	const resting = useWorkoutTimerStore(selectResting);
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

	const phaseLabel = alarmActive
		? timer.phase === 'rest_rep'
			? 'Rep rest over'
			: 'Rest over'
		: timer.phase === 'rest_exercise'
			? 'Rest'
			: timer.phase === 'rest_set'
				? 'Rest'
				: timer.phase === 'rest_rep'
					? 'Rest between reps'
					: timer.phase === 'work'
						? isHold
							? 'Hold'
							: 'Working set'
						: 'Ready';

	return (
		<Card>
			<CardHeader
				title={headerExercise.exercise_name}
				subtitle={
					timer.phase === 'rest_exercise'
						? `Up next · ${describePrescription(headerExercise)}`
						: `Set ${timer.setIndex} of ${sessionExercise.planned_sets} · ${describePrescription(sessionExercise)}`
				}
				action={
					<Badge
						tone={
							alarmActive ? 'danger' : resting ? 'success' : timer.running ? 'primary' : 'neutral'
						}
					>
						{phaseLabel}
					</Badge>
				}
			/>
			<CardBody className="space-y-4">
				<div className="flex justify-center">
					<ProgressRing
						value={restPct}
						size={240}
						stroke={8}
						tone={ringTone}
						aria-label={resting ? 'Rest remaining' : 'Set timer'}
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
					</ProgressRing>
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
										disabled={!working}
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
										disabled={working}
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
										disabled={!working || !timer.running}
										className="h-10 w-full justify-center"
									>
										<Pause size={16} />
										Pause
									</Button>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
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
							disabled={restOrAlarm}
						>
							Skip this set
						</Button>
					</div>
				</div>
			</CardBody>
		</Card>
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
		await complete.mutateAsync({
			sessionId: session.id,
			perceived_effort: effort === '' ? null : Number(effort),
			notes
		});
		clearSession();
		setFinishOpen(false);
		setNotes('');
		refetch();
	};

	const discard = async () => {
		await abandon.mutateAsync(session.id);
		clearSession();
		refetch();
	};

	return (
		<div>
			<PageHeader
				title={session.template_name || 'Workout'}
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

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
				<div className="lg:col-span-3">
					{current ? (
						<SetTimer sessionExercise={current} onSetLogged={refetch} />
					) : (
						<EmptyState
							icon={Check}
							title="Every set is logged"
							description="Finish the workout to save it and update your streak."
							action={<Button onClick={() => setFinishOpen(true)}>Finish workout</Button>}
						/>
					)}
				</div>

				<SessionProgress sessionExercise={current} totals={totals} />
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
