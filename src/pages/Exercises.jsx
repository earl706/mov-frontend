import { useMemo, useState } from 'react';
import { Dumbbell, Pencil, Plus, TrendingUp, Trash2 } from 'lucide-react';

import { PageHeader } from '../components/layout/PageHeader';
import {
	Badge,
	Button,
	Card,
	CardBody,
	CardHeader,
	Input,
	LoadingScreen,
	Modal,
	Select,
	Textarea
} from '../components/ui';
import { exercisesApi, useExerciseHistory } from '../lib/resources';
import { formatDate } from '../lib/format';

const MOVEMENT_GROUPS = [
	{ value: 'push', label: 'Push' },
	{ value: 'pull', label: 'Pull' },
	{ value: 'legs', label: 'Legs' },
	{ value: 'core', label: 'Core' },
	{ value: 'full_body', label: 'Full body' }
];

const LOAD_TYPES = [
	{ value: 'bodyweight', label: 'Bodyweight' },
	{ value: 'dumbbell', label: 'Dumbbell' },
	{ value: 'barbell', label: 'Barbell' },
	{ value: 'machine', label: 'Machine' },
	{ value: 'other', label: 'Other' }
];

const BLANK = {
	name: '',
	movement_group: 'push',
	load_type: 'bodyweight',
	track_mode: 'reps',
	per_side: false,
	met: '5.00',
	default_sets: 3,
	default_reps: 10,
	default_hold_seconds: 0,
	default_load_kg: '',
	default_rest_set_seconds: 90,
	default_rest_rep_seconds: 0,
	notes: ''
};

function ExerciseForm({ open, initial, onClose }) {
	const create = exercisesApi.useCreate();
	const update = exercisesApi.useUpdate();
	const editing = Boolean(initial?.id);
	const [form, setForm] = useState(initial || BLANK);

	// Remount via `key` in the parent keeps this in sync with the row being edited.
	const patch = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

	const submit = async (e) => {
		e.preventDefault();
		const body = {
			...form,
			met: Number(form.met).toFixed(2),
			default_load_kg: form.default_load_kg === '' ? null : Number(form.default_load_kg).toFixed(2),
			default_reps: form.track_mode === 'hold' ? 0 : Number(form.default_reps) || 0,
			default_hold_seconds: form.track_mode === 'hold' ? Number(form.default_hold_seconds) || 0 : 0
		};
		if (editing) await update.mutateAsync({ id: initial.id, ...body });
		else await create.mutateAsync(body);
		onClose();
	};

	return (
		<Modal
			open={open}
			onClose={onClose}
			title={editing ? 'Edit exercise' : 'New exercise'}
			size="md"
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button form="exercise-form" loading={create.isPending || update.isPending}>
						{editing ? 'Save' : 'Create'}
					</Button>
				</>
			}
		>
			<form id="exercise-form" onSubmit={submit} className="space-y-3">
				<Input
					label="Name"
					value={form.name}
					onChange={(e) => patch('name', e.target.value)}
					required
				/>
				<div className="grid grid-cols-2 gap-3">
					<Select
						label="Movement group"
						value={form.movement_group}
						onChange={(e) => patch('movement_group', e.target.value)}
					>
						{MOVEMENT_GROUPS.map((group) => (
							<option key={group.value} value={group.value}>
								{group.label}
							</option>
						))}
					</Select>
					<Select
						label="Equipment"
						value={form.load_type}
						onChange={(e) => patch('load_type', e.target.value)}
					>
						{LOAD_TYPES.map((type) => (
							<option key={type.value} value={type.value}>
								{type.label}
							</option>
						))}
					</Select>
				</div>
				<div className="grid grid-cols-2 gap-3">
					<Select
						label="Tracked as"
						value={form.track_mode}
						onChange={(e) => patch('track_mode', e.target.value)}
					>
						<option value="reps">Reps</option>
						<option value="hold">Timed hold</option>
					</Select>
					<Input
						label="MET (calorie intensity)"
						type="number"
						step="0.1"
						min="1"
						max="20"
						value={form.met}
						onChange={(e) => patch('met', e.target.value)}
					/>
				</div>
				<label className="text-fg flex cursor-pointer items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={form.per_side}
						onChange={(e) => patch('per_side', e.target.checked)}
						className="accent-primary"
					/>
					Trained one side at a time (doubles logged volume)
				</label>

				<p className="text-fg pt-1 text-sm font-medium">Defaults for new routines</p>
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
					<Input
						label="Sets"
						type="number"
						min="1"
						max="30"
						value={form.default_sets}
						onChange={(e) => patch('default_sets', e.target.value)}
					/>
					{form.track_mode === 'hold' ? (
						<Input
							label="Hold (s)"
							type="number"
							min="1"
							max="3600"
							value={form.default_hold_seconds}
							onChange={(e) => patch('default_hold_seconds', e.target.value)}
						/>
					) : (
						<Input
							label="Reps"
							type="number"
							min="0"
							max="500"
							value={form.default_reps}
							onChange={(e) => patch('default_reps', e.target.value)}
						/>
					)}
					<Input
						label="Load (kg)"
						type="number"
						step="0.5"
						min="0"
						max="500"
						value={form.default_load_kg}
						onChange={(e) => patch('default_load_kg', e.target.value)}
						placeholder="None"
					/>
					<Input
						label="Rest / set (s)"
						type="number"
						min="0"
						max="3600"
						value={form.default_rest_set_seconds}
						onChange={(e) => patch('default_rest_set_seconds', e.target.value)}
					/>
					<Input
						label="Rest / rep (s)"
						type="number"
						min="0"
						max="600"
						value={form.default_rest_rep_seconds}
						onChange={(e) => patch('default_rest_rep_seconds', e.target.value)}
					/>
				</div>
				<Textarea
					label="Cues / notes"
					rows={2}
					value={form.notes}
					onChange={(e) => patch('notes', e.target.value)}
					placeholder="Optional form reminders"
				/>
			</form>
		</Modal>
	);
}

function HistoryModal({ exercise, onClose }) {
	const { data, isLoading } = useExerciseHistory(exercise?.id);
	return (
		<Modal
			open={Boolean(exercise)}
			onClose={onClose}
			title={exercise ? `${exercise.name} history` : ''}
			size="md"
			footer={
				<Button variant="ghost" onClick={onClose}>
					Close
				</Button>
			}
		>
			{isLoading && <p className="text-muted text-sm">Loading…</p>}
			{data?.progression?.suggestion && (
				<div className="border-primary/40 bg-primary/5 mb-3 flex items-start gap-2 rounded-md border px-3 py-2">
					<TrendingUp size={16} className="text-primary mt-0.5 shrink-0" />
					<div>
						<p className="text-fg text-sm font-medium">{data.progression.suggestion}</p>
						{data.progression.basis && (
							<p className="text-muted text-xs">Based on {data.progression.basis}</p>
						)}
					</div>
				</div>
			)}
			<div className="space-y-2">
				{(data?.history || []).map((row) => (
					<div key={row.date} className="border-line rounded-md border px-3 py-2">
						<p className="text-fg text-sm font-medium">
							{formatDate(row.date, 'EEE, MMM d, yyyy')}
						</p>
						<p className="text-muted text-xs">
							{row.sets} sets · {row.reps} reps
							{row.top_load ? ` · top ${row.top_load} kg` : ''}
							{row.volume_kg ? ` · ${row.volume_kg} kg volume` : ''}
						</p>
					</div>
				))}
				{!isLoading && !(data?.history || []).length && (
					<p className="text-muted text-sm">No logged sets for this exercise yet.</p>
				)}
			</div>
		</Modal>
	);
}

export default function ExercisesPage() {
	const [group, setGroup] = useState('');
	const [search, setSearch] = useState('');
	const [formOpen, setFormOpen] = useState(false);
	const [editing, setEditing] = useState(null);
	const [historyFor, setHistoryFor] = useState(null);

	const params = useMemo(() => {
		const next = { page_size: 200, ordering: 'name' };
		if (group) next.movement_group = group;
		if (search.trim()) next.search = search.trim();
		return next;
	}, [group, search]);

	const { data, isLoading } = exercisesApi.useList(params);
	const remove = exercisesApi.useRemove();
	const exercises = data?.results || [];

	if (isLoading) return <LoadingScreen />;

	return (
		<div>
			<PageHeader
				title="Exercises"
				icon={Dumbbell}
				description="Your movement catalog. Seeded exercises can be edited or extended."
				actions={
					<Button
						onClick={() => {
							setEditing(null);
							setFormOpen(true);
						}}
					>
						<Plus size={16} />
						New exercise
					</Button>
				}
			/>

			<Card className="mb-4">
				<CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<Input
						label="Search"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Name or notes"
					/>
					<Select label="Movement group" value={group} onChange={(e) => setGroup(e.target.value)}>
						<option value="">All groups</option>
						{MOVEMENT_GROUPS.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</Select>
				</CardBody>
			</Card>

			<Card>
				<CardHeader title="Catalog" subtitle={`${exercises.length} exercises`} />
				<CardBody className="space-y-2">
					{exercises.map((exercise) => (
						<div
							key={exercise.id}
							className="border-line flex flex-wrap items-center gap-2 rounded-md border px-3 py-2.5"
						>
							<div className="min-w-40 flex-1">
								<p className="text-fg text-sm font-medium">
									{exercise.name}
									{exercise.per_side && <span className="text-muted ml-1 text-xs">(per side)</span>}
								</p>
								<p className="text-muted text-xs">
									{exercise.track_mode === 'hold'
										? `${exercise.default_sets} × ${exercise.default_hold_seconds}s`
										: `${exercise.default_sets} × ${exercise.default_reps}`}
									{exercise.default_load_kg ? ` @ ${Number(exercise.default_load_kg)} kg` : ''} ·{' '}
									{exercise.default_rest_set_seconds}s rest · MET {Number(exercise.met)}
								</p>
							</div>
							<Badge tone="primary" className="capitalize">
								{exercise.movement_group.replace('_', ' ')}
							</Badge>
							<Badge className="capitalize">{exercise.load_type}</Badge>
							{exercise.is_seeded && <Badge tone="accent">Seeded</Badge>}
							<button
								type="button"
								onClick={() => setHistoryFor(exercise)}
								className="text-muted hover:text-primary cursor-pointer p-1"
								aria-label={`History for ${exercise.name}`}
							>
								<TrendingUp size={15} />
							</button>
							<button
								type="button"
								onClick={() => {
									setEditing(exercise);
									setFormOpen(true);
								}}
								className="text-muted hover:text-primary cursor-pointer p-1"
								aria-label={`Edit ${exercise.name}`}
							>
								<Pencil size={15} />
							</button>
							<button
								type="button"
								onClick={() => {
									if (confirm(`Delete “${exercise.name}”? Past workouts keep their logs.`))
										remove.mutate(exercise.id);
								}}
								className="text-muted hover:text-danger cursor-pointer p-1"
								aria-label={`Delete ${exercise.name}`}
							>
								<Trash2 size={15} />
							</button>
						</div>
					))}
					{!exercises.length && (
						<p className="text-muted text-sm">No exercises match those filters.</p>
					)}
				</CardBody>
			</Card>

			{formOpen && (
				<ExerciseForm
					key={editing?.id || 'new'}
					open={formOpen}
					initial={
						editing
							? {
									...editing,
									default_load_kg: editing.default_load_kg ?? '',
									met: String(Number(editing.met))
								}
							: null
					}
					onClose={() => setFormOpen(false)}
				/>
			)}
			<HistoryModal exercise={historyFor} onClose={() => setHistoryFor(null)} />
		</div>
	);
}
