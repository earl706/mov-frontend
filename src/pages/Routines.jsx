import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
	ArrowDown,
	ArrowUp,
	ChevronRight,
	Feather,
	ListChecks,
	Play,
	Plus,
	Trash2,
	Wind
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
	Textarea
} from '../components/ui';
import { WeeklySchedule } from '../components/routines/WeeklySchedule';
import { exercisesApi, routinesApi, useStartSession } from '../lib/resources';
import { toast } from '../stores/toastStore';

/** A routine entry carries the prescription; defaults come from the exercise. */
function entryFromExercise(exercise, order) {
	return {
		key: `new-${order}-${exercise.id}`,
		exercise: exercise.id,
		exercise_name: exercise.name,
		track_mode: exercise.track_mode,
		per_side: exercise.per_side,
		order,
		sets: exercise.default_sets,
		reps: exercise.default_reps,
		hold_seconds: exercise.default_hold_seconds,
		target_load_kg: exercise.default_load_kg ?? '',
		rest_set_seconds: exercise.default_rest_set_seconds,
		rest_rep_seconds: exercise.default_rest_rep_seconds,
		rest_exercise_seconds: '',
		notes: ''
	};
}

function toPayloadEntry(entry, index) {
	return {
		exercise: entry.exercise,
		order: index + 1,
		sets: Number(entry.sets) || 1,
		reps: entry.track_mode === 'hold' ? 0 : Number(entry.reps) || 0,
		hold_seconds: entry.track_mode === 'hold' ? Number(entry.hold_seconds) || 0 : 0,
		target_load_kg:
			entry.target_load_kg === '' || entry.target_load_kg == null
				? null
				: Number(entry.target_load_kg).toFixed(2),
		rest_set_seconds: Number(entry.rest_set_seconds) || 0,
		rest_rep_seconds: Number(entry.rest_rep_seconds) || 0,
		rest_exercise_seconds:
			entry.rest_exercise_seconds === '' || entry.rest_exercise_seconds == null
				? null
				: Number(entry.rest_exercise_seconds),
		notes: entry.notes || ''
	};
}

// -----------------------------------------------------------------------------
// List
// -----------------------------------------------------------------------------

export function RoutinesPage() {
	const navigate = useNavigate();
	const { data, isLoading } = routinesApi.useList({ page_size: 100, ordering: 'name' });
	const create = routinesApi.useCreate();
	const remove = routinesApi.useRemove();
	const start = useStartSession();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState('');
	const [description, setDescription] = useState('');

	const routines = data?.results || [];

	const submit = async (e) => {
		e.preventDefault();
		const routine = await create.mutateAsync({ name, description });
		setOpen(false);
		setName('');
		setDescription('');
		navigate(`/routines/${routine.id}`);
	};

	if (isLoading) return <LoadingScreen />;

	return (
		<div>
			<PageHeader
				title="Routines"
				icon={ListChecks}
				description="Saved workout plans and the days you train them. Every session starts from a routine."
				actions={
					<Button onClick={() => setOpen(true)}>
						<Plus size={16} />
						New routine
					</Button>
				}
			/>

			{routines.length > 0 && (
				<div className="mb-4">
					<WeeklySchedule routines={routines} />
				</div>
			)}

			{!routines.length ? (
				<EmptyState
					icon={ListChecks}
					title="No routines yet"
					description="Group the exercises you train together — for example Upper A, Lower A, or Full body. Then assign them to weekdays."
					action={<Button onClick={() => setOpen(true)}>Create your first routine</Button>}
				/>
			) : (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					{routines.map((routine) => (
						<Card key={routine.id} className="pt-3">
							<CardBody className="space-y-3">
								<div className="flex items-start gap-2">
									<div className="min-w-0 flex-1">
										<button
											type="button"
											onClick={() => navigate(`/routines/${routine.id}`)}
											className="text-fg hover:text-primary cursor-pointer text-left text-base font-semibold"
										>
											{routine.name}
										</button>
										{routine.description && (
											<p className="text-muted mt-0.5 line-clamp-2 text-xs">
												{routine.description}
											</p>
										)}
									</div>
									{!routine.is_active && <Badge>Archived</Badge>}
								</div>

								<div className="text-muted flex flex-wrap gap-x-3 gap-y-1 text-xs">
									<span>{routine.exercise_count} exercises</span>
									<span>{routine.planned_sets} sets</span>
									<span>~{routine.estimated_minutes} min</span>
									<span>
										{routine.last_performed ? `Last done ${routine.last_performed}` : 'Never done'}
									</span>
								</div>

								<div className="flex flex-wrap items-center gap-2">
									<Button
										size="sm"
										disabled={!routine.exercise_count}
										onClick={() =>
											start.mutate(
												{ template: routine.id },
												{
													onSuccess: () => navigate('/train')
												}
											)
										}
										loading={start.isPending}
									>
										<Play size={15} />
										Start
									</Button>
									<Button
										size="sm"
										variant="secondary"
										disabled={!routine.exercise_count}
										onClick={() =>
											start.mutate(
												{ template: routine.id, intensity: 'mild' },
												{
													onSuccess: () => navigate('/train')
												}
											)
										}
										loading={start.isPending}
										title="Start Mild — half sets (per-side kept even)"
									>
										<Feather size={15} />
										Start Mild
									</Button>
									<Button
										size="sm"
										variant="ghost"
										disabled={!routine.exercise_count}
										onClick={() =>
											start.mutate(
												{ template: routine.id, intensity: 'extra_mild' },
												{
													onSuccess: () => navigate('/train')
												}
											)
										}
										loading={start.isPending}
										title="Start Extra Mild — quarter sets (per-side kept even)"
									>
										<Wind size={15} />
										Start Extra Mild
									</Button>
									<Button
										size="sm"
										variant="ghost"
										onClick={() => navigate(`/routines/${routine.id}`)}
									>
										Edit
										<ChevronRight size={14} />
									</Button>
									<button
										type="button"
										className="text-muted hover:text-danger ml-auto cursor-pointer"
										aria-label={`Delete ${routine.name}`}
										onClick={() => {
											if (confirm(`Delete “${routine.name}”? Past workouts are kept.`))
												remove.mutate(routine.id);
										}}
									>
										<Trash2 size={15} />
									</button>
								</div>
							</CardBody>
						</Card>
					))}
				</div>
			)}

			<Modal
				open={open}
				onClose={() => setOpen(false)}
				title="New routine"
				size="sm"
				footer={
					<>
						<Button variant="ghost" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button form="new-routine" loading={create.isPending}>
							Create
						</Button>
					</>
				}
			>
				<form id="new-routine" onSubmit={submit} className="space-y-3">
					<Input
						label="Name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Upper A"
						required
					/>
					<Textarea
						label="Description"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Optional"
						rows={2}
					/>
				</form>
			</Modal>
		</div>
	);
}

// -----------------------------------------------------------------------------
// Detail / editor
// -----------------------------------------------------------------------------

export function RoutineDetailPage() {
	const { id } = useParams();
	const { data: routine, isLoading } = routinesApi.useDetail(id);

	if (isLoading || !routine) return <LoadingScreen />;
	// Remounting on save resets the editor from the server's copy of the routine.
	return <RoutineEditor key={`${routine.id}-${routine.updated_at}`} routine={routine} />;
}

function entryFromSaved(entry) {
	return {
		key: `saved-${entry.id}`,
		exercise: entry.exercise,
		exercise_name: entry.exercise_name,
		track_mode: entry.track_mode,
		per_side: entry.per_side,
		order: entry.order,
		sets: entry.sets,
		reps: entry.reps,
		hold_seconds: entry.hold_seconds,
		target_load_kg: entry.target_load_kg ?? '',
		rest_set_seconds: entry.rest_set_seconds,
		rest_rep_seconds: entry.rest_rep_seconds,
		rest_exercise_seconds: entry.rest_exercise_seconds ?? '',
		notes: entry.notes || ''
	};
}

function RoutineEditor({ routine }) {
	const navigate = useNavigate();
	const { data: catalog } = exercisesApi.useList({ is_active: true, page_size: 200 });
	const update = routinesApi.useUpdate();
	const start = useStartSession();

	const [name, setName] = useState(routine.name);
	const [description, setDescription] = useState(routine.description || '');
	const [restBetweenExercises, setRestBetweenExercises] = useState(
		routine.default_rest_exercise_seconds ?? 120
	);
	const [entries, setEntries] = useState(() => (routine.exercises || []).map(entryFromSaved));
	const [pickerOpen, setPickerOpen] = useState(false);

	const exercises = catalog?.results || [];
	const usedIds = useMemo(() => new Set(entries.map((entry) => entry.exercise)), [entries]);

	const patchEntry = (key, field, value) =>
		setEntries((rows) => rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)));

	const move = (index, delta) =>
		setEntries((rows) => {
			const next = [...rows];
			const target = index + delta;
			if (target < 0 || target >= next.length) return rows;
			[next[index], next[target]] = [next[target], next[index]];
			return next;
		});

	const save = async () => {
		if (!name.trim()) {
			toast.error('Give the routine a name.');
			return;
		}
		await update.mutateAsync({
			id: routine.id,
			name: name.trim(),
			description,
			default_rest_exercise_seconds: Number(restBetweenExercises) || 0,
			exercises: entries.map(toPayloadEntry)
		});
		toast.success('Routine saved.');
	};

	return (
		<div>
			<PageHeader
				title={routine.name}
				icon={ListChecks}
				description="Set the default sets, reps, load, and rest for each exercise."
				actions={
					<>
						<Button variant="ghost" onClick={() => navigate('/routines')}>
							Back
						</Button>
						<Button
							variant="secondary"
							disabled={!entries.length}
							onClick={() =>
								start.mutate({ template: routine.id }, { onSuccess: () => navigate('/train') })
							}
							loading={start.isPending}
						>
							<Play size={16} />
							Start
						</Button>
						<Button
							variant="ghost"
							disabled={!entries.length}
							onClick={() =>
								start.mutate(
									{ template: routine.id, intensity: 'mild' },
									{ onSuccess: () => navigate('/train') }
								)
							}
							loading={start.isPending}
							title="Start Mild — half sets (per-side kept even)"
						>
							<Feather size={16} />
							Start Mild
						</Button>
						<Button
							variant="ghost"
							disabled={!entries.length}
							onClick={() =>
								start.mutate(
									{ template: routine.id, intensity: 'extra_mild' },
									{ onSuccess: () => navigate('/train') }
								)
							}
							loading={start.isPending}
							title="Start Extra Mild — quarter sets (per-side kept even)"
						>
							<Wind size={16} />
							Start Extra Mild
						</Button>
						<Button onClick={save} loading={update.isPending}>
							Save
						</Button>
					</>
				}
			/>

			<Card className="mb-4">
				<CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
					<Input
						label="Description"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Optional"
					/>
					<Input
						label="Rest between exercises (s)"
						type="number"
						min="0"
						max="3600"
						value={restBetweenExercises}
						onChange={(e) => setRestBetweenExercises(e.target.value)}
					/>
				</CardBody>
			</Card>

			<Card>
				<CardHeader
					title="Exercises"
					subtitle={`${entries.length} in this routine`}
					action={
						<Button size="sm" onClick={() => setPickerOpen(true)}>
							<Plus size={15} />
							Add
						</Button>
					}
				/>
				<CardBody className="space-y-3">
					{!entries.length && (
						<p className="text-muted text-sm">
							Add exercises to make this routine startable. Order matters — it is the order you will
							train them in.
						</p>
					)}
					{entries.map((entry, index) => (
						<div key={entry.key} className="border-line rounded-md border p-3">
							<div className="mb-3 flex items-center gap-2">
								<span className="text-muted w-5 text-xs tabular-nums">{index + 1}</span>
								<p className="text-fg min-w-0 flex-1 truncate text-sm font-medium">
									{entry.exercise_name}
									{entry.per_side && <span className="text-muted ml-1 text-xs">(per side)</span>}
								</p>
								<Badge tone={entry.track_mode === 'hold' ? 'accent' : 'primary'}>
									{entry.track_mode === 'hold' ? 'Timed hold' : 'Reps'}
								</Badge>
								<button
									type="button"
									onClick={() => move(index, -1)}
									disabled={index === 0}
									className="text-muted hover:text-fg cursor-pointer p-1 disabled:opacity-30"
									aria-label="Move up"
								>
									<ArrowUp size={14} />
								</button>
								<button
									type="button"
									onClick={() => move(index, 1)}
									disabled={index === entries.length - 1}
									className="text-muted hover:text-fg cursor-pointer p-1 disabled:opacity-30"
									aria-label="Move down"
								>
									<ArrowDown size={14} />
								</button>
								<button
									type="button"
									onClick={() => setEntries((rows) => rows.filter((row) => row.key !== entry.key))}
									className="text-muted hover:text-danger cursor-pointer p-1"
									aria-label={`Remove ${entry.exercise_name}`}
								>
									<Trash2 size={14} />
								</button>
							</div>

							<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
								<Input
									label="Sets"
									type="number"
									min="1"
									max="30"
									value={entry.sets}
									onChange={(e) => patchEntry(entry.key, 'sets', e.target.value)}
								/>
								{entry.track_mode === 'hold' ? (
									<Input
										label="Hold (s)"
										type="number"
										min="1"
										max="3600"
										value={entry.hold_seconds}
										onChange={(e) => patchEntry(entry.key, 'hold_seconds', e.target.value)}
									/>
								) : (
									<Input
										label="Reps"
										type="number"
										min="0"
										max="500"
										value={entry.reps}
										onChange={(e) => patchEntry(entry.key, 'reps', e.target.value)}
									/>
								)}
								<Input
									label="Load (kg)"
									type="number"
									step="0.5"
									min="0"
									max="500"
									value={entry.target_load_kg}
									onChange={(e) => patchEntry(entry.key, 'target_load_kg', e.target.value)}
									placeholder="Bodyweight"
								/>
								<Input
									label="Rest / set (s)"
									type="number"
									min="0"
									max="3600"
									value={entry.rest_set_seconds}
									onChange={(e) => patchEntry(entry.key, 'rest_set_seconds', e.target.value)}
								/>
								<Input
									label="Rest / rep (s)"
									type="number"
									min="0"
									max="600"
									value={entry.rest_rep_seconds}
									onChange={(e) => patchEntry(entry.key, 'rest_rep_seconds', e.target.value)}
								/>
								<Input
									label="Rest after (s)"
									type="number"
									min="0"
									max="3600"
									value={entry.rest_exercise_seconds}
									onChange={(e) => patchEntry(entry.key, 'rest_exercise_seconds', e.target.value)}
									placeholder={`Default (${restBetweenExercises || 0}s)`}
								/>
							</div>
						</div>
					))}
				</CardBody>
			</Card>

			<Modal
				open={pickerOpen}
				onClose={() => setPickerOpen(false)}
				title="Add an exercise"
				size="md"
				footer={
					<Button variant="ghost" onClick={() => setPickerOpen(false)}>
						Done
					</Button>
				}
			>
				<div className="max-h-96 space-y-2 overflow-y-auto">
					{exercises.map((exercise) => (
						<div
							key={exercise.id}
							className="border-line flex items-center gap-3 rounded-md border px-3 py-2"
						>
							<div className="min-w-0 flex-1">
								<p className="text-fg truncate text-sm font-medium">{exercise.name}</p>
								<p className="text-muted text-xs capitalize">
									{exercise.movement_group.replace('_', ' ')} · {exercise.load_type}
								</p>
							</div>
							<Button
								size="sm"
								variant="ghost"
								onClick={() =>
									setEntries((rows) => [...rows, entryFromExercise(exercise, rows.length + 1)])
								}
							>
								{usedIds.has(exercise.id) ? 'Add again' : 'Add'}
							</Button>
						</div>
					))}
					{!exercises.length && (
						<p className="text-muted text-sm">
							No exercises found. Create some on the Exercises page first.
						</p>
					)}
				</div>
			</Modal>
		</div>
	);
}
