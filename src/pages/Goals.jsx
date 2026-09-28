import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Target } from 'lucide-react';

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
	ProgressBar,
	Select
} from '../components/ui';
import { formatDate } from '../lib/format';
import { fromKg } from '../lib/weightFormat';
import { exercisesApi, goalsApi, useGoalsProgress, useWeightProfile } from '../lib/resources';
import { toast } from '../stores/toastStore';

const PACE_TONE = { ahead: 'success', on: 'primary', behind: 'warning' };
const VOLUME_WINDOWS = [
	{ id: 'week', label: 'This week' },
	{ id: 'month', label: 'This month' },
	{ id: 'year', label: 'This year' }
];

function yearAhead() {
	const day = new Date();
	day.setFullYear(day.getFullYear() + 1);
	return day.toISOString().slice(0, 10);
}

function todayKey() {
	return new Date().toISOString().slice(0, 10);
}

function paceLabel(pace) {
	if (pace === 'ahead') return 'Ahead';
	if (pace === 'behind') return 'Behind';
	return 'On track';
}

function roundDisplay(value) {
	if (value == null || Number.isNaN(Number(value))) return '—';
	const n = Number(value);
	return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function VolumeTargets({ goals, exerciseId = null, unitLabel = 'kg' }) {
	const qc = useQueryClient();
	const invalidate = () => {
		qc.invalidateQueries({ queryKey: ['goals'] });
		qc.invalidateQueries({ queryKey: ['exercises', 'history'] });
		qc.invalidateQueries({ queryKey: ['dashboard'] });
	};
	const create = goalsApi.useCreate({
		onSuccess: () => {
			invalidate();
			toast.success('Volume target saved.');
		},
		onError: () => toast.error('Could not save volume target.')
	});
	const update = goalsApi.useUpdate({
		onSuccess: () => {
			invalidate();
			toast.success('Volume target saved.');
		},
		onError: () => toast.error('Could not save volume target.')
	});
	const scoped = (goals || []).filter(
		(row) => row.kind === 'volume' && (row.exercise ?? null) === (exerciseId ?? null)
	);
	const [draft, setDraft] = useState({});

	const save = (windowId) => {
		const existing = scoped.find((row) => row.window === windowId);
		const raw = draft[windowId];
		const value = raw === undefined || raw === '' ? existing?.target_value : Number(raw);
		if (value == null || Number.isNaN(value) || value <= 0) {
			toast.error('Enter a volume target greater than 0.');
			return;
		}
		const body = {
			kind: 'volume',
			window: windowId,
			exercise: exerciseId,
			target_value_input: value
		};
		if (existing) update.mutate({ id: existing.id, ...body });
		else create.mutate(body);
	};

	return (
		<div className="space-y-3">
			{VOLUME_WINDOWS.map((window) => {
				const row = scoped.find((item) => item.window === window.id);
				const actual = row?.progress?.actual_kg ?? 0;
				const target = row?.target_value ?? 0;
				const pct = row?.progress?.progress_pct ?? 0;
				return (
					<div key={window.id} className="space-y-1.5">
						<div className="flex items-center justify-between gap-2">
							<p className="text-fg text-sm font-medium">{window.label}</p>
							<p className="text-muted text-xs tabular-nums">
								{Math.round(actual)} / {target ? Math.round(target) : '—'} {unitLabel}
							</p>
						</div>
						<ProgressBar value={pct} tone={row?.progress?.hit ? 'success' : 'primary'} />
						<div className="flex items-end gap-2">
							<Input
								label={`Target (${unitLabel})`}
								type="number"
								min="1"
								step="1"
								value={draft[window.id] ?? row?.target_value ?? ''}
								onChange={(e) => setDraft((prev) => ({ ...prev, [window.id]: e.target.value }))}
							/>
							<Button
								size="sm"
								variant="secondary"
								className="mb-0.5 shrink-0"
								onClick={() => save(window.id)}
								loading={create.isPending || update.isPending}
							>
								Save
							</Button>
						</div>
					</div>
				);
			})}
		</div>
	);
}

function LoadGoalForm({ exercises, unit, onClose, initial }) {
	const qc = useQueryClient();
	const saved = () => {
		qc.invalidateQueries({ queryKey: ['goals'] });
		qc.invalidateQueries({ queryKey: ['exercises', 'history'] });
		toast.success('Load goal saved.');
		onClose();
	};
	const create = goalsApi.useCreate({
		onSuccess: saved,
		onError: (err) => {
			const data = err?.response?.data;
			const msg =
				data?.exercise?.[0] ||
				data?.target_value_input?.[0] ||
				data?.target_date?.[0] ||
				data?.detail ||
				'Could not save load goal.';
			toast.error(typeof msg === 'string' ? msg : 'Could not save load goal.');
		}
	});
	const update = goalsApi.useUpdate({
		onSuccess: saved,
		onError: () => toast.error('Could not save load goal.')
	});
	const [exercise, setExercise] = useState(initial?.exercise || '');
	const [start, setStart] = useState(
		initial?.start_value != null ? String(initial.start_value) : ''
	);
	const [target, setTarget] = useState(
		initial?.target_value != null ? String(initial.target_value) : ''
	);
	const [date, setDate] = useState(initial?.target_date || yearAhead());
	const [increment, setIncrement] = useState(
		initial?.increment != null ? String(initial.increment) : unit === 'lb' ? '5' : '2.5'
	);

	const liftables = exercises.filter((row) => row.track_mode !== 'hold');

	const submit = (e) => {
		e.preventDefault();
		const body = {
			kind: 'load',
			window: 'deadline',
			exercise: Number(exercise),
			target_date: date,
			target_value_input: Number(target),
			increment_input: Number(increment)
		};
		if (start !== '') body.start_value_input = Number(start);
		if (initial?.id) update.mutate({ id: initial.id, ...body });
		else create.mutate({ ...body, start_date: todayKey() });
	};

	return (
		<form id="load-goal-form" onSubmit={submit} className="space-y-3">
			<Select
				label="Exercise"
				value={exercise}
				onChange={(e) => setExercise(e.target.value)}
				required
				disabled={Boolean(initial?.id)}
			>
				<option value="">Choose a lift</option>
				{liftables.map((row) => (
					<option key={row.id} value={row.id}>
						{row.name}
						{row.per_side ? ' (per side)' : ''}
					</option>
				))}
			</Select>
			<div className="grid grid-cols-2 gap-3">
				<Input
					label={`Start (${unit})`}
					type="number"
					min="0"
					step="0.25"
					value={start}
					onChange={(e) => setStart(e.target.value)}
					placeholder="Last top load"
				/>
				<Input
					label={`Destination (${unit})`}
					type="number"
					min="0.25"
					step="0.25"
					value={target}
					onChange={(e) => setTarget(e.target.value)}
					required
				/>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<Input
					label="Arrive by"
					type="date"
					value={date}
					onChange={(e) => setDate(e.target.value)}
					required
				/>
				<Input
					label={`Plate (${unit})`}
					type="number"
					min="0.25"
					step="0.25"
					value={increment}
					onChange={(e) => setIncrement(e.target.value)}
				/>
			</div>
		</form>
	);
}

function LoadGoalCard({ goal, unit }) {
	const qc = useQueryClient();
	const abandon = goalsApi.useUpdate({
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['goals'] });
			toast.success('Load goal abandoned.');
		},
		onError: () => toast.error('Could not update the goal.')
	});
	const prog = goal.progress || {};
	const per = goal.per_side ? ' / arm' : '';
	return (
		<Card>
			<CardHeader
				title={goal.exercise_name || 'Lift'}
				subtitle={`${paceLabel(prog.pace)} · ${formatDate(prog.effective_target_date, 'MMM d, yyyy')}`}
				action={<Badge tone={PACE_TONE[prog.pace] || 'primary'}>{paceLabel(prog.pace)}</Badge>}
			/>
			<CardBody className="space-y-3">
				<ProgressBar value={prog.progress_pct || 0} showLabel />
				<p className="text-muted text-sm">
					Checkpoint {roundDisplay(fromKg(prog.checkpoint_kg, unit))} {unit}
					{per}
					{prog.actual_top_kg != null
						? ` · last ${roundDisplay(fromKg(prog.actual_top_kg, unit))} ${unit}`
						: ' · no sets yet'}
					{` · goal ${roundDisplay(goal.target_value)} ${unit}${per}`}
				</p>
				{prog.missed_weeks > 0 && (
					<p className="text-warning text-xs">
						Date slid {prog.missed_weeks} week{prog.missed_weeks === 1 ? '' : 's'} for missed
						expected sessions.
					</p>
				)}
				<Button
					size="sm"
					variant="ghost"
					onClick={() => abandon.mutate({ id: goal.id, status: 'abandoned' })}
					loading={abandon.isPending}
				>
					Abandon
				</Button>
			</CardBody>
		</Card>
	);
}

export function DashboardGoalsCard({ goals = [], unit = 'kg' }) {
	const navigate = useNavigate();
	const globalVol = goals.filter((row) => row.kind === 'volume' && !row.exercise);
	const loads = goals.filter((row) => row.kind === 'load').slice(0, 3);
	const empty = !globalVol.length && !loads.length;

	return (
		<Card className="flex min-h-0 flex-col overflow-hidden">
			<CardHeader
				className="p-3 pb-1 lg:p-2.5 lg:pb-0.5"
				title="Goals"
				subtitle="Load + volume"
				action={
					<Button size="sm" variant="ghost" onClick={() => navigate('/goals')}>
						Open
					</Button>
				}
			/>
			<CardBody className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-3 pt-0 lg:p-2.5 lg:pt-0">
				{empty && (
					<p className="text-muted text-[10px] leading-snug">
						Set a weekly volume or a lift destination on Goals.
					</p>
				)}
				{VOLUME_WINDOWS.map((window) => {
					const row = globalVol.find((item) => item.window === window.id);
					if (!row) return null;
					return (
						<div key={window.id}>
							<div className="text-muted flex justify-between text-[10px]">
								<span>{window.label}</span>
								<span className="tabular-nums">
									{Math.round(row.progress?.actual_kg || 0)}/{Math.round(row.target_value)} kg
								</span>
							</div>
							<ProgressBar value={row.progress?.progress_pct || 0} />
						</div>
					);
				})}
				{loads.map((goal) => (
					<p key={goal.id} className="text-fg truncate text-[11px]">
						{goal.exercise_name}{' '}
						<span className="text-muted">
							{roundDisplay(fromKg(goal.progress?.checkpoint_kg, unit))} →{' '}
							{roundDisplay(goal.target_value)} {unit}
						</span>
					</p>
				))}
			</CardBody>
		</Card>
	);
}

export default function GoalsPage() {
	const [formOpen, setFormOpen] = useState(false);
	const { data, isLoading } = useGoalsProgress();
	const { data: weightProfile } = useWeightProfile();
	const { data: exercisePage } = exercisesApi.useList({ page_size: 200, ordering: 'name' });
	const unit = weightProfile?.unit || 'kg';
	const goals = data?.goals || [];
	const exercises = exercisePage?.results || [];
	const loadGoals = goals.filter((row) => row.kind === 'load');
	const globalVolume = useMemo(
		() => goals.filter((row) => row.kind === 'volume' && !row.exercise),
		[goals]
	);

	if (isLoading) return <LoadingScreen />;

	return (
		<div>
			<PageHeader
				title="Goals"
				icon={Target}
				description="Destination loads per lift, and week / month / year volume. Hints only — routines stay as you wrote them."
				actions={
					<Button onClick={() => setFormOpen(true)}>
						<Plus size={16} />
						Load goal
					</Button>
				}
			/>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader
						title="Training volume"
						subtitle="Whole-body kg × reps this week, month, and year"
					/>
					<CardBody>
						<VolumeTargets goals={globalVolume} />
					</CardBody>
				</Card>
				<Card>
					<CardHeader
						title="How load goals work"
						subtitle="Straight line to the date, snapped to your plate"
					/>
					<CardBody className="text-muted space-y-2 text-sm">
						<p>
							Each lift gets one active destination. Miss a scheduled week of that lift and the date
							slides; the weekly increment does not get steeper.
						</p>
						<p>
							Train extra and the checkpoint rises faster. The saved routine is never rewritten.
						</p>
					</CardBody>
				</Card>
			</div>

			<div className="mt-4 space-y-3">
				<h2 className="text-fg text-sm font-semibold">Load destinations</h2>
				{loadGoals.length === 0 && (
					<EmptyState
						icon={Target}
						title="No load goals yet"
						description="Example: curls 20 kg per side a year from now. Wrist curls can use a smaller plate."
						action={<Button onClick={() => setFormOpen(true)}>Add a load goal</Button>}
					/>
				)}
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
					{loadGoals.map((goal) => (
						<LoadGoalCard key={goal.id} goal={goal} unit={unit} />
					))}
				</div>
			</div>

			<Modal
				open={formOpen}
				onClose={() => setFormOpen(false)}
				title="New load goal"
				size="md"
				footer={
					<>
						<Button variant="ghost" onClick={() => setFormOpen(false)}>
							Cancel
						</Button>
						<Button type="submit" form="load-goal-form">
							Save
						</Button>
					</>
				}
			>
				<LoadGoalForm exercises={exercises} unit={unit} onClose={() => setFormOpen(false)} />
			</Modal>
		</div>
	);
}
