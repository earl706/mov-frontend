import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
	Check,
	ChevronRight,
	Dumbbell,
	Minus,
	Pause,
	Play,
	Plus,
	SkipForward,
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
import { useWorkoutAutoAdvance } from '../hooks/useWorkoutAutoAdvance';
import { cn } from '../lib/format';
import { formatTimerDisplay } from '../lib/timerFormat';
import {
	routinesApi,
	useAbandonSession,
	useActiveSession,
	useAdjustSessionExercise,
	useCompleteSession,
	useStartSession,
	useSuggestedRoutine
} from '../lib/resources';
import { isExerciseFinished, loggedSets } from '../lib/workoutSession';
import {
	selectDisplaySeconds,
	selectResting,
	selectWorkSeconds,
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
			{suggested?.template && (
				<Card className="border-primary/40">
					<CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center">
						<div className="min-w-0 flex-1">
							<Badge tone="primary">Up next</Badge>
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
// Per-session overrides (never written back to the routine)
// -----------------------------------------------------------------------------

function ExerciseRow({ session, sessionExercise, isCurrent, onFocus }) {
	const adjust = useAdjustSessionExercise();
	const done = loggedSets(sessionExercise);
	const finished = isExerciseFinished(sessionExercise);

	const changeSets = (delta) => {
		const next = Math.max(done, Math.min(30, sessionExercise.planned_sets + delta));
		if (next === sessionExercise.planned_sets) return;
		adjust.mutate({
			sessionId: session.id,
			exerciseId: sessionExercise.id,
			planned_sets: next
		});
	};

	return (
		<div
			className={cn(
				'border-line rounded-md border px-3 py-2.5',
				isCurrent && 'border-primary/50 bg-primary/5',
				sessionExercise.skipped && 'opacity-60'
			)}
		>
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={onFocus}
					disabled={sessionExercise.skipped}
					className="min-w-0 flex-1 cursor-pointer text-left disabled:cursor-not-allowed"
				>
					<p className="text-fg truncate text-sm font-medium">
						{sessionExercise.exercise_name}
						{sessionExercise.per_side && (
							<span className="text-muted ml-1 text-xs">(per side)</span>
						)}
					</p>
					<p className="text-muted text-xs">
						{done}/{sessionExercise.planned_sets} sets · {describePrescription(sessionExercise)}
					</p>
				</button>
				{finished && !sessionExercise.skipped && (
					<Badge tone="success">
						<Check size={12} />
						Done
					</Badge>
				)}
				{sessionExercise.skipped && <Badge>Skipped</Badge>}
			</div>

			<div className="mt-2 flex flex-wrap items-center gap-1.5">
				<button
					type="button"
					onClick={() => changeSets(-1)}
					className="border-line text-muted hover:text-fg cursor-pointer rounded-sm border p-1"
					aria-label={`Reduce sets for ${sessionExercise.exercise_name}`}
				>
					<Minus size={13} />
				</button>
				<button
					type="button"
					onClick={() => changeSets(1)}
					className="border-line text-muted hover:text-fg cursor-pointer rounded-sm border p-1"
					aria-label={`Add a set to ${sessionExercise.exercise_name}`}
				>
					<Plus size={13} />
				</button>
				<button
					type="button"
					onClick={() =>
						adjust.mutate({
							sessionId: session.id,
							exerciseId: sessionExercise.id,
							skipped: !sessionExercise.skipped
						})
					}
					className="border-line text-muted hover:text-fg ml-1 cursor-pointer rounded-sm border px-2 py-1 text-xs"
				>
					{sessionExercise.skipped ? 'Restore' : 'Skip today'}
				</button>
				{sessionExercise.progression?.suggestion && !finished && (
					<span className="text-muted ml-auto text-xs">
						{sessionExercise.progression.suggestion}
					</span>
				)}
			</div>
		</div>
	);
}

// -----------------------------------------------------------------------------
// The set timer
// -----------------------------------------------------------------------------

function SetTimer({ sessionExercise, onSetLogged }) {
	const { finishSet, logging } = useWorkoutAutoAdvance();
	const timer = useWorkoutTimerStore();
	const displaySeconds = useWorkoutTimerStore(selectDisplaySeconds);
	const workSeconds = useWorkoutTimerStore(selectWorkSeconds);
	const resting = useWorkoutTimerStore(selectResting);
	const alarmActive = timer.alarmActive;

	// Re-render every second while a clock is moving.
	const ticking = timer.running || timer.restEndAt != null;
	useEffect(() => {
		if (!ticking) return undefined;
		const id = window.setInterval(() => useWorkoutTimerStore.setState({}), 500);
		return () => window.clearInterval(id);
	}, [ticking]);

	const isHold = timer.trackMode === 'hold';
	const nextName = timer.pendingNextExercise?.exercise_name;
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
			? nextName
				? `Rest before ${nextName}`
				: 'Rest between exercises'
			: timer.phase === 'rest_set'
				? 'Rest between sets'
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
				<div className="flex flex-col items-center gap-1">
					<p
						className={cn(
							'font-mono text-5xl font-semibold tabular-nums sm:text-6xl',
							alarmActive && 'text-danger animate-pulse',
							!alarmActive && resting && 'text-success',
							!alarmActive && !resting && timer.running && 'text-primary',
							!alarmActive && !resting && !timer.running && 'text-fg'
						)}
					>
						{formatTimerDisplay(displaySeconds)}
					</p>
					<p className="text-muted text-xs">
						{alarmActive
							? timer.phase === 'rest_rep'
								? 'Tap Resume set to keep going.'
								: 'Tap Start set when you are ready.'
							: timer.phase === 'rest_exercise'
								? 'Rest between exercises. The next set waits for Start set.'
								: resting
									? 'Rest between sets. The next set waits for Start set.'
									: isHold
										? `Target ${timer.plannedHoldSeconds}s · ${workSeconds}s held`
										: `${workSeconds}s under tension`}
					</p>
				</div>

				{resting && !alarmActive ? (
					<div className="flex flex-wrap items-center justify-center gap-2">
						<Button variant="ghost" onClick={() => timer.addRestSeconds(-15)}>
							−15s
						</Button>
						<Button variant="ghost" onClick={() => timer.addRestSeconds(15)}>
							+15s
						</Button>
						<Button onClick={() => timer.skipRest()}>
							<SkipForward size={16} />
							Skip rest
						</Button>
					</div>
				) : (
					<div className="flex flex-wrap items-center justify-center gap-2">
						{timer.running ? (
							<Button variant="secondary" onClick={timer.pauseSet}>
								<Pause size={16} />
								Pause
							</Button>
						) : (
							<Button
								onClick={timer.startSet}
								className={alarmActive ? 'animate-pulse' : undefined}
							>
								<Play size={16} />
								{timer.phase === 'rest_rep' || workSeconds > 0 ? 'Resume set' : 'Start set'}
							</Button>
						)}
						{!isHold && (
							<div className="border-line flex items-center gap-2 rounded-md border px-2 py-1">
								<button
									type="button"
									onClick={timer.removeRep}
									className="text-muted hover:text-fg cursor-pointer p-1"
									aria-label="Remove a rep"
								>
									<Minus size={14} />
								</button>
								<span className="text-fg min-w-14 text-center text-sm font-medium tabular-nums">
									{timer.repsDone} / {timer.plannedReps} reps
								</span>
								<button
									type="button"
									onClick={timer.countRep}
									disabled={timer.phase !== 'work'}
									className="text-muted hover:text-fg cursor-pointer p-1 disabled:cursor-not-allowed disabled:opacity-40"
									aria-label="Count a rep"
								>
									<Plus size={14} />
								</button>
							</div>
						)}
						<Button
							variant="primary"
							onClick={() => submitSet()}
							loading={logging}
							disabled={timer.phase !== 'work'}
						>
							<Square size={15} />
							Stop set
						</Button>
					</div>
				)}

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
							disabled={resting}
						>
							Skip this set
						</Button>
					</div>
				</div>

				{timer.restRepSeconds > 0 && !isHold && (
					<p className="text-muted text-center text-xs">
						Counting a rep starts a {timer.restRepSeconds}s rep rest. Rep rests are logged as rest,
						not work.
					</p>
				)}
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
	const [focusedId, setFocusedId] = useState(null);

	useEffect(() => {
		if (session) attachSession({ id: session.id, name: session.template_name });
		else if (storedSessionId != null) clearSession();
	}, [session, attachSession, clearSession, storedSessionId]);

	const exercises = useMemo(() => session?.exercises || [], [session]);

	/** The exercise the timer should be pointing at right now. */
	const current = useMemo(() => {
		const focused = exercises.find(
			(e) => e.id === focusedId && !e.skipped && !isExerciseFinished(e)
		);
		return focused || exercises.find((e) => !isExerciseFinished(e)) || null;
	}, [exercises, focusedId]);

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

				<Card className="lg:col-span-2">
					<CardHeader title="Session plan" subtitle="Adjust today without editing the routine" />
					<CardBody className="space-y-2">
						{exercises.map((sessionExercise) => (
							<ExerciseRow
								key={sessionExercise.id}
								session={session}
								sessionExercise={sessionExercise}
								isCurrent={current?.id === sessionExercise.id}
								onFocus={() => setFocusedId(sessionExercise.id)}
							/>
						))}
					</CardBody>
				</Card>
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

			<p className="text-muted mt-4 flex items-center gap-1 text-xs">
				The timer keeps running if you navigate away.
				<Link to="/history" className="text-primary inline-flex items-center hover:underline">
					Past workouts <ChevronRight size={12} />
				</Link>
			</p>
		</div>
	);
}
