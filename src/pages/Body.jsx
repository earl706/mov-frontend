import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis
} from 'recharts';
import {
	ChevronLeft,
	ChevronRight,
	Flame,
	Plus,
	Scale,
	Target,
	TrendingDown,
	TrendingUp,
	Trash2,
	X
} from 'lucide-react';

import { CompactActivityTile } from '../components/analytics/ActivityHeatmap';
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
	Select,
	StatCard,
	Textarea
} from '../components/ui';
import { formatDate } from '../lib/format';
import {
	formatDelta,
	formatWeight,
	fromKg,
	localDateKey,
	localTimeValue
} from '../lib/weightFormat';
import {
	measurementsApi,
	progressPhotosApi,
	useBodyComposition,
	useCalorieSummary,
	useFitnessProfile,
	useLogWeight,
	useMeasurementMutations,
	useUpdateFitnessProfile,
	useUpdateWeightProfile,
	useWeightHeatmap,
	useWeightProfile,
	useWeightSeries,
	useWeightStats,
	weightEntriesApi
} from '../lib/resources';
import { toast } from '../stores/toastStore';

/** Matches the backend cap in apps/weight/models.py. */
const MAX_WEIGHT = { kg: 400, lb: 880 };

const MEASUREMENT_FIELDS = [
	{ key: 'neck', label: 'Neck', hint: 'Below the larynx, sloping down' },
	{ key: 'waist', label: 'Waist', hint: 'At the navel' },
	{ key: 'hip', label: 'Hip', hint: 'Widest point of the glutes' },
	{ key: 'chest', label: 'Chest' },
	{ key: 'arm', label: 'Arm', hint: 'Flexed upper arm' },
	{ key: 'thigh', label: 'Thigh' },
	{ key: 'calf', label: 'Calf' }
];

const BMI_TONE = {
	underweight: 'warning',
	healthy: 'success',
	overweight: 'warning',
	obese: 'danger'
};

const RANGES = [
	{ id: '7', label: '7d', days: 7 },
	{ id: '30', label: '30d', days: 30 },
	{ id: '90', label: '90d', days: 90 },
	{ id: 'all', label: 'All', days: null },
	{ id: 'custom', label: 'Custom', days: null }
];

const CHART_TYPES = [
	{ id: 'line', label: 'Line' },
	{ id: 'area', label: 'Area' },
	{ id: 'bar', label: 'Weekly' }
];

function OnboardingModal({ open, profile, onClose }) {
	const save = useUpdateWeightProfile();
	const [unit, setUnit] = useState(profile?.unit || 'kg');
	const [goalMode, setGoalMode] = useState(profile?.goal_mode || 'reach');
	const [target, setTarget] = useState(profile?.target ?? '');
	const [targetMin, setTargetMin] = useState(profile?.target_min ?? '');
	const [targetMax, setTargetMax] = useState(profile?.target_max ?? '');
	const [weeklyRate, setWeeklyRate] = useState(profile?.weekly_rate ?? '');
	const [startWeight, setStartWeight] = useState(profile?.start_weight ?? '');
	const [reminderEnabled, setReminderEnabled] = useState(!!profile?.reminder_enabled);
	const [reminderTime, setReminderTime] = useState((profile?.reminder_time || '09:00').slice(0, 5));

	const submit = async (e) => {
		e.preventDefault();
		const body = {
			unit,
			goal_mode: goalMode,
			onboarding_complete: true,
			reminder_enabled: reminderEnabled,
			reminder_time: reminderEnabled ? reminderTime : null,
			start_date: localDateKey(),
			start_weight_input: startWeight === '' ? null : Number(startWeight)
		};
		if (goalMode === 'reach') body.target_input = target === '' ? null : Number(target);
		if (goalMode === 'range') {
			body.target_min_input = targetMin === '' ? null : Number(targetMin);
			body.target_max_input = targetMax === '' ? null : Number(targetMax);
		}
		if (goalMode === 'rate') {
			body.weekly_rate_input = weeklyRate === '' ? null : Number(weeklyRate);
		}
		await save.mutateAsync(body);
		onClose();
	};

	return (
		<Modal
			open={open}
			onClose={onClose}
			title="Set up Body tracking"
			size="md"
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Skip for now
					</Button>
					<Button form="body-onboarding" loading={save.isPending}>
						Save & continue
					</Button>
				</>
			}
		>
			<form id="body-onboarding" onSubmit={submit} className="space-y-4">
				<p className="text-muted text-sm">
					Choose your unit and goal. You can change these anytime in Settings.
				</p>
				<Select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
					<option value="kg">Kilograms (kg)</option>
					<option value="lb">Pounds (lb)</option>
				</Select>
				<Input
					label={`Starting weight (${unit})`}
					type="number"
					step="0.01"
					min="0.01"
					max={MAX_WEIGHT[unit]}
					value={startWeight}
					onChange={(e) => setStartWeight(e.target.value)}
					placeholder="Optional"
				/>
				<Select label="Goal type" value={goalMode} onChange={(e) => setGoalMode(e.target.value)}>
					<option value="reach">Reach a target weight</option>
					<option value="range">Stay in a range</option>
					<option value="rate">Lose/gain per week</option>
				</Select>
				{goalMode === 'reach' && (
					<Input
						label={`Target weight (${unit})`}
						type="number"
						step="0.01"
						min="0.01"
						max={MAX_WEIGHT[unit]}
						value={target}
						onChange={(e) => setTarget(e.target.value)}
						required
					/>
				)}
				{goalMode === 'range' && (
					<div className="grid grid-cols-2 gap-3">
						<Input
							label={`Min (${unit})`}
							type="number"
							step="0.01"
							value={targetMin}
							onChange={(e) => setTargetMin(e.target.value)}
							required
						/>
						<Input
							label={`Max (${unit})`}
							type="number"
							step="0.01"
							value={targetMax}
							onChange={(e) => setTargetMax(e.target.value)}
							required
						/>
					</div>
				)}
				{goalMode === 'rate' && (
					<Input
						label={`Weekly change (${unit}/week, negative = lose)`}
						type="number"
						step="0.01"
						value={weeklyRate}
						onChange={(e) => setWeeklyRate(e.target.value)}
						required
					/>
				)}
				<label className="text-fg flex cursor-pointer items-center gap-2 text-sm">
					<input
						type="checkbox"
						checked={reminderEnabled}
						onChange={(e) => setReminderEnabled(e.target.checked)}
						className="accent-primary"
					/>
					Remind me if I have not logged by
				</label>
				{reminderEnabled && (
					<Input
						label="Reminder time"
						type="time"
						value={reminderTime}
						onChange={(e) => setReminderTime(e.target.value)}
						required
					/>
				)}
			</form>
		</Modal>
	);
}

function LogForm({ profile, existingToday, onLogged }) {
	const log = useLogWeight();
	const [date, setDate] = useState(localDateKey());
	const [time, setTime] = useState(localTimeValue());
	const [weight, setWeight] = useState('');
	const [overwriteOpen, setOverwriteOpen] = useState(false);
	const unit = profile?.unit || 'kg';
	const isToday = date === localDateKey();
	const needsConfirm = isToday && existingToday;

	const submit = async (overwrite = false) => {
		await log.mutateAsync({
			date,
			time: time.length === 5 ? `${time}:00` : time,
			weight_input: Number(weight),
			unit_input: unit,
			overwrite
		});
		setWeight('');
		setOverwriteOpen(false);
		onLogged?.();
	};

	const onSubmit = (e) => {
		e.preventDefault();
		if (needsConfirm && !overwriteOpen) {
			setOverwriteOpen(true);
			return;
		}
		submit(needsConfirm);
	};

	return (
		<>
			<form
				onSubmit={onSubmit}
				className="border-line bg-surface grid grid-cols-2 gap-3 rounded-md border p-4 sm:grid-cols-4"
			>
				<Input
					label="Date"
					type="date"
					max={localDateKey()}
					value={date}
					onChange={(e) => setDate(e.target.value)}
					required
				/>
				<Input
					label="Time"
					type="time"
					value={time}
					onChange={(e) => setTime(e.target.value)}
					required
				/>
				<Input
					label={`Weight (${unit})`}
					type="number"
					step="0.01"
					min="0.01"
					max={MAX_WEIGHT[unit]}
					value={weight}
					onChange={(e) => setWeight(e.target.value)}
					placeholder="0.00"
					required
				/>
				<div className="flex items-end">
					<Button type="submit" className="w-full" loading={log.isPending}>
						{needsConfirm ? 'Update today' : 'Log weight'}
					</Button>
				</div>
			</form>
			<Modal
				open={overwriteOpen}
				onClose={() => setOverwriteOpen(false)}
				title="Replace today’s entry?"
				size="sm"
				footer={
					<>
						<Button variant="ghost" onClick={() => setOverwriteOpen(false)}>
							Cancel
						</Button>
						<Button onClick={() => submit(true)} loading={log.isPending}>
							Replace
						</Button>
					</>
				}
			>
				<p className="text-muted text-sm">
					You already logged {formatWeight(existingToday?.weight, unit)} today. Replace it with{' '}
					{formatWeight(weight, unit)}?
				</p>
			</Modal>
		</>
	);
}

// -----------------------------------------------------------------------------
// Body composition
// -----------------------------------------------------------------------------

/** Attributes the composition maths needs but that live on the fitness profile. */
function CompositionInputs({ profile, lengthUnit }) {
	const save = useUpdateFitnessProfile();
	const [sex, setSex] = useState(profile?.sex || 'unspecified');
	const [birthdate, setBirthdate] = useState(profile?.birthdate || '');
	const [height, setHeight] = useState(profile?.height ?? '');
	const [activity, setActivity] = useState(profile?.activity_level || 'moderate');

	// Hydrate once the fitness profile arrives (Body page does not block on it).
	useEffect(() => {
		if (!profile) return;
		setSex(profile.sex || 'unspecified');
		setBirthdate(profile.birthdate || '');
		setHeight(profile.height ?? '');
		setActivity(profile.activity_level || 'moderate');
	}, [profile?.updated_at]);

	const submit = (e) => {
		e.preventDefault();
		save.mutate({
			sex,
			birthdate: birthdate || null,
			height_input: height === '' ? null : Number(height),
			activity_level: activity
		});
	};

	return (
		<form onSubmit={submit} className="space-y-3">
			<div className="grid grid-cols-2 gap-3">
				<Select label="Sex" value={sex} onChange={(e) => setSex(e.target.value)}>
					<option value="unspecified">Prefer not to say</option>
					<option value="male">Male</option>
					<option value="female">Female</option>
				</Select>
				<Input
					label={`Height (${lengthUnit})`}
					type="number"
					step="0.1"
					value={height}
					onChange={(e) => setHeight(e.target.value)}
					placeholder="Required for BMI"
				/>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<Input
					label="Birthdate"
					type="date"
					max={localDateKey()}
					value={birthdate}
					onChange={(e) => setBirthdate(e.target.value)}
				/>
				<Select
					label="Daily activity"
					value={activity}
					onChange={(e) => setActivity(e.target.value)}
				>
					<option value="sedentary">Sedentary (desk job)</option>
					<option value="light">Lightly active</option>
					<option value="moderate">Moderately active</option>
					<option value="active">Active</option>
					<option value="very_active">Very active</option>
				</Select>
			</div>
			<Button type="submit" size="sm" loading={save.isPending}>
				Save body inputs
			</Button>
			<p className="text-muted text-xs">
				Sex, height, and age drive the BMI, body-fat, and BMR formulas. Activity turns BMR into a
				maintenance calorie estimate.
			</p>
		</form>
	);
}

function CompositionPanel({ composition, profile, weightProfile, lengthUnit, unit }) {
	const saveWeightProfile = useUpdateWeightProfile();
	const estimates = composition?.body_fat_estimates || {};
	const missing = composition?.missing_inputs || [];
	const [manualPct, setManualPct] = useState(() => weightProfile?.manual_body_fat_pct ?? '');

	useEffect(() => {
		if (weightProfile == null) return;
		setManualPct(weightProfile.manual_body_fat_pct ?? '');
	}, [weightProfile?.updated_at, weightProfile?.manual_body_fat_pct]);

	const saveManualPct = (raw) => {
		const next = raw === '' ? null : Number(raw);
		saveWeightProfile.mutate({
			body_fat_method: 'manual',
			manual_body_fat_pct: next
		});
	};

	return (
		<Card>
			<CardHeader
				title="Body composition"
				subtitle="Estimates, not measurements — useful for trends"
				action={
					composition?.bmi_class ? (
						<Badge tone={BMI_TONE[composition.bmi_class] || 'neutral'} className="capitalize">
							{composition.bmi_class}
						</Badge>
					) : null
				}
			/>
			<CardBody className="space-y-4">
				{missing.length > 0 && (
					<p className="text-warning text-xs">Add {missing.join(', ')} to complete the estimate.</p>
				)}

				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					<div>
						<p className="text-muted text-xs">BMI</p>
						<p className="text-fg text-lg font-semibold">{composition?.bmi ?? '—'}</p>
					</div>
					<div>
						<p className="text-muted text-xs">Body fat</p>
						<p className="text-fg text-lg font-semibold">
							{composition?.body_fat_pct != null ? `${composition.body_fat_pct}%` : '—'}
						</p>
					</div>
					<div>
						<p className="text-muted text-xs">Lean mass</p>
						<p className="text-fg text-lg font-semibold">
							{composition?.lean_mass != null ? formatWeight(composition.lean_mass, unit) : '—'}
						</p>
					</div>
					<div>
						<p className="text-muted text-xs">Fat mass</p>
						<p className="text-fg text-lg font-semibold">
							{composition?.fat_mass != null ? formatWeight(composition.fat_mass, unit) : '—'}
						</p>
					</div>
				</div>

				<div className="border-line space-y-3 border-t pt-3">
					<Select
						label="Body fat method"
						value={weightProfile?.body_fat_method || 'navy'}
						onChange={(e) => saveWeightProfile.mutate({ body_fat_method: e.target.value })}
					>
						<option value="navy">
							US Navy circumference{estimates.navy != null ? ` — ${estimates.navy}%` : ''}
						</option>
						<option value="bmi">
							BMI estimate (Deurenberg){estimates.bmi != null ? ` — ${estimates.bmi}%` : ''}
						</option>
						<option value="manual">Manual entry</option>
					</Select>
					{weightProfile?.body_fat_method === 'manual' && (
						<Input
							label="Body fat %"
							type="number"
							step="0.1"
							min="2"
							max="70"
							value={manualPct}
							onChange={(e) => setManualPct(e.target.value)}
							onBlur={(e) => saveManualPct(e.target.value)}
						/>
					)}
				</div>

				<div className="border-line border-t pt-3">
					<CompositionInputs profile={profile} lengthUnit={lengthUnit} />
				</div>
			</CardBody>
		</Card>
	);
}

function EnergyPanel({ composition, weightProfile, calories }) {
	const save = useUpdateWeightProfile();
	const points = calories?.points || [];
	const [targetKcal, setTargetKcal] = useState(() => weightProfile?.calorie_target_kcal ?? '');

	useEffect(() => {
		if (weightProfile == null) return;
		setTargetKcal(weightProfile.calorie_target_kcal ?? '');
	}, [weightProfile?.updated_at, weightProfile?.calorie_target_kcal]);

	return (
		<Card>
			<CardHeader title="Energy" subtitle="Maintenance, target, and training burn" />
			<CardBody className="space-y-4">
				<div className="grid grid-cols-3 gap-3">
					<div>
						<p className="text-muted text-xs">BMR</p>
						<p className="text-fg text-lg font-semibold">{composition?.bmr_kcal ?? '—'}</p>
					</div>
					<div>
						<p className="text-muted text-xs">Maintenance</p>
						<p className="text-fg text-lg font-semibold">{composition?.tdee_kcal ?? '—'}</p>
					</div>
					<div>
						<p className="text-muted text-xs">Daily target</p>
						<p className="text-fg text-lg font-semibold">
							{composition?.calorie_target_kcal ?? '—'}
						</p>
					</div>
				</div>

				{composition?.goal_adjustment_kcal ? (
					<p className="text-muted text-xs">
						Your weight goal adjusts the target by {composition.goal_adjustment_kcal} kcal/day.
					</p>
				) : null}

				<div className="h-40">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={points}>
							<CartesianGrid stroke="var(--line)" vertical={false} />
							<XAxis
								dataKey="date"
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
							<Bar dataKey="workout_kcal" name="Training kcal" fill="var(--primary)" radius={4} />
						</BarChart>
					</ResponsiveContainer>
				</div>

				<div className="border-line space-y-3 border-t pt-3">
					<Select
						label="Calorie target"
						value={weightProfile?.calorie_target_mode || 'auto'}
						onChange={(e) => save.mutate({ calorie_target_mode: e.target.value })}
					>
						<option value="auto">Derive from maintenance + weight goal</option>
						<option value="manual">Set it myself</option>
					</Select>
					{weightProfile?.calorie_target_mode === 'manual' && (
						<Input
							label="Daily calories"
							type="number"
							min="800"
							max="6000"
							value={targetKcal}
							onChange={(e) => setTargetKcal(e.target.value)}
							onBlur={(e) =>
								save.mutate({
									calorie_target_mode: 'manual',
									calorie_target_kcal: e.target.value === '' ? null : Number(e.target.value)
								})
							}
						/>
					)}
				</div>
			</CardBody>
		</Card>
	);
}

// -----------------------------------------------------------------------------
// Measurements & photos
// -----------------------------------------------------------------------------

function MeasurementsPanel({ lengthUnit }) {
	const { data, isLoading } = measurementsApi.useList({ page_size: 12, ordering: '-date' });
	const { create, remove } = useMeasurementMutations();
	const [open, setOpen] = useState(false);
	const [values, setValues] = useState({});
	const [notes, setNotes] = useState('');

	const rows = data?.results || [];

	const submit = async (e) => {
		e.preventDefault();
		const measurements = Object.fromEntries(
			Object.entries(values).filter(([, value]) => value !== '' && value != null)
		);
		if (!Object.keys(measurements).length) {
			toast.error('Enter at least one measurement.');
			return;
		}
		await create.mutateAsync({ measurements_input: measurements, notes });
		setValues({});
		setNotes('');
		setOpen(false);
	};

	return (
		<Card>
			<CardHeader
				title="Measurements"
				subtitle={`Circumferences in ${lengthUnit} · feeds the Navy body-fat estimate`}
				action={
					<Button size="sm" onClick={() => setOpen(true)}>
						<Plus size={15} />
						Log
					</Button>
				}
			/>
			<CardBody className="space-y-2">
				{isLoading && <p className="text-muted text-sm">Loading…</p>}
				{!isLoading && !rows.length && (
					<p className="text-muted text-sm">
						No measurements yet. Neck, waist, and hip unlock the US Navy body-fat estimate.
					</p>
				)}
				{rows.map((row) => (
					<div
						key={row.id}
						className="border-line flex items-start gap-3 rounded-md border px-3 py-2"
					>
						<div className="min-w-0 flex-1">
							<p className="text-fg text-sm font-medium">
								{formatDate(row.date, 'EEE, MMM d, yyyy')}
							</p>
							<p className="text-muted text-xs">
								{MEASUREMENT_FIELDS.filter((field) => row.measurements?.[field.key] != null)
									.map((field) => `${field.label} ${row.measurements[field.key]}${lengthUnit}`)
									.join(' · ') || 'No values'}
							</p>
							{row.notes && <p className="text-muted mt-0.5 text-xs">“{row.notes}”</p>}
						</div>
						<button
							type="button"
							className="text-muted hover:text-danger cursor-pointer"
							aria-label="Delete measurements"
							onClick={() => {
								if (confirm('Delete these measurements?')) remove.mutate(row.id);
							}}
						>
							<Trash2 size={15} />
						</button>
					</div>
				))}
			</CardBody>

			<Modal
				open={open}
				onClose={() => setOpen(false)}
				title="Log measurements"
				size="md"
				footer={
					<>
						<Button variant="ghost" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button form="measurement-form" loading={create.isPending}>
							Save
						</Button>
					</>
				}
			>
				<form id="measurement-form" onSubmit={submit} className="space-y-3">
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						{MEASUREMENT_FIELDS.map((field) => (
							<Input
								key={field.key}
								label={`${field.label} (${lengthUnit})`}
								type="number"
								step="0.1"
								min="5"
								max="300"
								value={values[field.key] ?? ''}
								onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
								placeholder={field.hint || 'Optional'}
							/>
						))}
					</div>
					<Textarea
						label="Notes"
						rows={2}
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="Optional"
					/>
				</form>
			</Modal>
		</Card>
	);
}

function ProgressPhotoViewer({ photos, index, unit, onClose, onChangeIndex }) {
	const photo = index != null ? photos[index] : null;
	const count = photos.length;
	const canStep = count > 1;

	const step = (delta) => {
		if (!canStep) return;
		onChangeIndex((index + delta + count) % count);
	};

	useEffect(() => {
		if (index == null) return undefined;
		const onKey = (event) => {
			if (event.key === 'Escape') {
				onClose();
				return;
			}
			if (count <= 1) return;
			if (event.key === 'ArrowLeft') {
				event.preventDefault();
				onChangeIndex((index - 1 + count) % count);
			}
			if (event.key === 'ArrowRight') {
				event.preventDefault();
				onChangeIndex((index + 1) % count);
			}
		};
		document.addEventListener('keydown', onKey);
		document.body.style.overflow = 'hidden';
		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = '';
		};
	}, [index, count, onClose, onChangeIndex]);

	if (photo == null) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
			role="dialog"
			aria-modal="true"
			aria-label={`${photo.pose} progress photo`}
		>
			<div
				className="absolute inset-0 cursor-pointer bg-black/80"
				onClick={onClose}
				aria-hidden="true"
			/>
			<button
				type="button"
				onClick={onClose}
				aria-label="Close photo"
				className="absolute top-3 right-3 z-10 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-white hover:bg-white/10"
			>
				<X size={20} />
			</button>
			{canStep && (
				<button
					type="button"
					onClick={() => step(-1)}
					aria-label="Previous photo"
					className="absolute left-2 z-10 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-white hover:bg-white/10 sm:left-4"
				>
					<ChevronLeft size={28} />
				</button>
			)}
			{canStep && (
				<button
					type="button"
					onClick={() => step(1)}
					aria-label="Next photo"
					className="absolute right-2 z-10 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-white hover:bg-white/10 sm:right-4"
				>
					<ChevronRight size={28} />
				</button>
			)}
			<figure className="relative z-10 flex max-h-[90vh] max-w-[min(92vw,56rem)] flex-col items-center">
				{photo.url && (
					<img
						src={photo.url}
						alt={`${photo.pose} progress photo from ${photo.date}`}
						className="max-h-[78vh] w-auto max-w-full rounded-md object-contain"
					/>
				)}
				<figcaption className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-sm text-white">
					<span className="capitalize">
						{photo.pose} · {formatDate(photo.date, 'EEE, MMM d, yyyy')}
					</span>
					{photo.weight_kg ? (
						<span className="text-white/70">
							{formatWeight(fromKg(photo.weight_kg, unit), unit)}
						</span>
					) : null}
					{count > 1 ? (
						<span className="text-white/70">
							{index + 1} / {count}
						</span>
					) : null}
				</figcaption>
			</figure>
		</div>
	);
}

function ProgressPhotosPanel({ unit }) {
	const { data, isLoading } = progressPhotosApi.useList({ page_size: 28, ordering: '-date' });
	const create = progressPhotosApi.useCreate();
	const remove = progressPhotosApi.useRemove();
	const [pose, setPose] = useState('front');
	const [file, setFile] = useState(null);
	const [viewerIndex, setViewerIndex] = useState(null);

	const photos = data?.results || [];

	const submit = async (e) => {
		e.preventDefault();
		if (!file) {
			toast.error('Choose a photo first.');
			return;
		}
		const body = new FormData();
		body.append('image', file);
		body.append('pose', pose);
		body.append('date', localDateKey());
		await create.mutateAsync(body);
		setFile(null);
		e.target.reset();
	};

	useEffect(() => {
		if (viewerIndex == null) return;
		if (!photos.length) {
			setViewerIndex(null);
			return;
		}
		if (viewerIndex >= photos.length) setViewerIndex(photos.length - 1);
	}, [photos.length, viewerIndex]);

	return (
		<>
			<Card>
				<CardHeader title="Progress photos" subtitle="Same pose, same light, same time of day" />
				<CardBody className="space-y-3">
					<form onSubmit={submit} className="flex flex-wrap items-end gap-2">
						<Select
							label="Pose"
							value={pose}
							onChange={(e) => setPose(e.target.value)}
							className="w-32"
						>
							<option value="front">Front</option>
							<option value="side">Side</option>
							<option value="back">Back</option>
						</Select>
						<Input
							label="Photo"
							type="file"
							accept="image/*"
							onChange={(e) => setFile(e.target.files?.[0] || null)}
						/>
						<Button type="submit" loading={create.isPending}>
							Upload
						</Button>
					</form>

					{isLoading && <p className="text-muted text-sm">Loading…</p>}
					{!isLoading && !photos.length && (
						<p className="text-muted text-sm">
							No photos yet. A monthly photo often shows change the scale hides.
						</p>
					)}
					{photos.length > 0 && (
						<div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
							{photos.map((photo, index) => (
								<figure key={photo.id} className="border-line overflow-hidden rounded-md border">
									{photo.url && (
										<button
											type="button"
											onClick={() => setViewerIndex(index)}
											className="block w-full cursor-pointer"
											aria-label={`Open ${photo.pose} photo from ${formatDate(photo.date, 'MMM d')}`}
										>
											<img
												src={photo.url}
												alt={`${photo.pose} progress photo from ${photo.date}`}
												className="aspect-[3/4] w-full object-cover"
											/>
										</button>
									)}
									<figcaption className="flex items-center gap-1 px-2 py-1.5">
										<div className="min-w-0 flex-1">
											<p className="text-fg truncate text-xs font-medium capitalize">
												{photo.pose} · {formatDate(photo.date, 'MMM d')}
											</p>
											{photo.weight_kg && (
												<p className="text-muted text-xs">
													{formatWeight(fromKg(photo.weight_kg, unit), unit)}
												</p>
											)}
										</div>
										<button
											type="button"
											className="text-muted hover:text-danger cursor-pointer"
											aria-label="Delete photo"
											onClick={() => {
												if (confirm('Delete this photo?')) remove.mutate(photo.id);
											}}
										>
											<Trash2 size={13} />
										</button>
									</figcaption>
								</figure>
							))}
						</div>
					)}
				</CardBody>
			</Card>
			<ProgressPhotoViewer
				photos={photos}
				index={viewerIndex}
				unit={unit}
				onClose={() => setViewerIndex(null)}
				onChangeIndex={setViewerIndex}
			/>
		</>
	);
}

function WeightTooltip({ active, payload, label, unit }) {
	if (!active || !payload?.length) return null;
	return (
		<div className="border-line bg-surface rounded-lg border px-3 py-2 text-xs shadow-lg">
			<p className="text-fg font-medium">{formatDate(label, 'EEE, MMM d')}</p>
			{payload.map((p) => (
				<p key={p.dataKey} className="text-muted">
					{p.name}: {Number(p.value).toFixed(2)} {unit}
				</p>
			))}
		</div>
	);
}

export default function BodyPage() {
	const { data: profile, isLoading: profileLoading } = useWeightProfile();
	const [range, setRange] = useState('30');
	const [customFrom, setCustomFrom] = useState('');
	const [customTo, setCustomTo] = useState(localDateKey());
	const [chartType, setChartType] = useState('line');
	const [onboardingDismissed, setOnboardingDismissed] = useState(false);
	const [editEntry, setEditEntry] = useState(null);
	const [editWeight, setEditWeight] = useState('');
	const [editTime, setEditTime] = useState('');

	const seriesParams = useMemo(() => {
		if (range === 'custom' && customFrom) {
			return { date__gte: customFrom, date__lte: customTo || localDateKey() };
		}
		if (range === 'all') return {};
		const days = RANGES.find((r) => r.id === range)?.days || 30;
		return { days };
	}, [range, customFrom, customTo]);

	const { data: series } = useWeightSeries(seriesParams);
	const { data: stats } = useWeightStats(
		range === 'custom' && customFrom
			? { date__gte: customFrom, date__lte: customTo || localDateKey() }
			: {}
	);
	const { data: heatmap } = useWeightHeatmap(84);
	const { data: composition } = useBodyComposition();
	const { data: calories } = useCalorieSummary(14);
	const { data: fitnessProfile } = useFitnessProfile();
	const { data: listData, isLoading: listLoading } = weightEntriesApi.useList({
		ordering: '-date',
		page_size: 30
	});
	const update = weightEntriesApi.useUpdate();
	const remove = weightEntriesApi.useRemove();
	const saveProfile = useUpdateWeightProfile();

	const entries = listData?.results || [];
	const todayKey = localDateKey();
	const existingToday = entries.find((e) => e.date === todayKey);
	const unit = profile?.unit || series?.unit || 'kg';
	const lengthUnit = fitnessProfile?.length_unit || 'cm';
	const showOnboarding = profile && !profile.onboarding_complete && !onboardingDismissed;

	const goalLine = series?.goal_line;
	const chartData = series?.points || [];
	const weeklyData = series?.weekly || [];

	if (profileLoading) return <LoadingScreen />;

	const saveEdit = async () => {
		if (!editEntry) return;
		await update.mutateAsync({
			id: editEntry.id,
			time: editTime.length === 5 ? `${editTime}:00` : editTime,
			weight_input: Number(editWeight),
			unit_input: unit
		});
		setEditEntry(null);
	};

	return (
		<div>
			<PageHeader title="Body" icon={Scale} description="Track weight, goals, and consistency." />

			<div className="mb-4">
				<LogForm profile={profile} existingToday={existingToday} />
			</div>

			{!entries.length && (
				<div className="mb-4">
					<EmptyState
						icon={Scale}
						title="No weigh-ins yet"
						description="Log your first weight above. Set a unit and goal to unlock progress stats."
						action={
							!profile?.onboarding_complete ? (
								<Button onClick={() => setOnboardingDismissed(false)}>Set up goals</Button>
							) : null
						}
					/>
				</div>
			)}

			{stats && (
				<div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
					<StatCard
						icon={Scale}
						label="Current"
						value={stats.current != null ? Number(stats.current).toFixed(2) : '—'}
						sublabel={unit}
					/>
					<StatCard
						icon={stats.delta_7d != null && stats.delta_7d > 0 ? TrendingUp : TrendingDown}
						label="7-day change"
						value={formatDelta(stats.delta_7d, unit)}
						trend={stats.delta_7d > 0 ? 'up' : stats.delta_7d < 0 ? 'down' : 'flat'}
					/>
					<StatCard icon={Flame} label="Streak" value={stats.streak_days ?? 0} sublabel="days" />
					<StatCard
						icon={Target}
						label="Goal"
						value={
							stats.goal?.progress_pct != null
								? `${stats.goal.progress_pct}%`
								: stats.goal?.remaining != null
									? formatDelta(stats.goal.remaining, unit)
									: '—'
						}
						sublabel={
							stats.goal?.projected_date
								? `Est. ${formatDate(stats.goal.projected_date, 'MMM d')}`
								: stats.goal?.in_range
									? 'In range'
									: unit
						}
					/>
				</div>
			)}

			<div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader
						title="Trend"
						subtitle={`${unit} · 7-day rolling average`}
						action={
							<div className="flex flex-wrap gap-1">
								{CHART_TYPES.map((c) => (
									<button
										key={c.id}
										type="button"
										onClick={() => setChartType(c.id)}
										className={`cursor-pointer rounded-sm px-2 py-1 text-xs ${
											chartType === c.id ? 'bg-primary/15 text-primary' : 'text-muted hover:text-fg'
										}`}
									>
										{c.label}
									</button>
								))}
							</div>
						}
					/>
					<CardBody>
						<div className="mb-3 flex flex-wrap gap-1">
							{RANGES.map((r) => (
								<button
									key={r.id}
									type="button"
									onClick={() => setRange(r.id)}
									className={`cursor-pointer rounded-sm px-2.5 py-1 text-xs font-medium ${
										range === r.id
											? 'bg-primary/15 text-primary'
											: 'bg-surface-2 text-muted hover:text-fg'
									}`}
								>
									{r.label}
								</button>
							))}
						</div>
						{range === 'custom' && (
							<div className="mb-3 grid grid-cols-2 gap-2">
								<Input
									label="From"
									type="date"
									max={localDateKey()}
									value={customFrom}
									onChange={(e) => setCustomFrom(e.target.value)}
								/>
								<Input
									label="To"
									type="date"
									max={localDateKey()}
									value={customTo}
									onChange={(e) => setCustomTo(e.target.value)}
								/>
							</div>
						)}
						<div className="h-56">
							{chartType === 'bar' ? (
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={weeklyData}>
										<CartesianGrid stroke="var(--line)" vertical={false} />
										<XAxis
											dataKey="week"
											tick={{ fill: 'var(--muted)', fontSize: 11 }}
											axisLine={false}
											tickLine={false}
										/>
										<YAxis
											tick={{ fill: 'var(--muted)', fontSize: 11 }}
											axisLine={false}
											tickLine={false}
											domain={['auto', 'auto']}
										/>
										<Tooltip />
										<Bar dataKey="change" name="Weekly Δ" fill="var(--primary)" radius={4} />
									</BarChart>
								</ResponsiveContainer>
							) : chartType === 'area' ? (
								<ResponsiveContainer width="100%" height="100%">
									<AreaChart data={chartData}>
										<defs>
											<linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
												<stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
												<stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
											</linearGradient>
										</defs>
										<XAxis
											dataKey="date"
											tickFormatter={(d) => formatDate(d, 'MMM d')}
											tick={{ fill: 'var(--muted)', fontSize: 11 }}
											axisLine={false}
											tickLine={false}
										/>
										<YAxis
											tick={{ fill: 'var(--muted)', fontSize: 11 }}
											axisLine={false}
											tickLine={false}
											domain={['auto', 'auto']}
										/>
										<Tooltip content={<WeightTooltip unit={unit} />} />
										{typeof goalLine === 'number' && (
											<ReferenceLine y={goalLine} stroke="var(--success)" strokeDasharray="4 4" />
										)}
										{goalLine?.min != null && (
											<ReferenceLine
												y={goalLine.min}
												stroke="var(--warning)"
												strokeDasharray="4 4"
											/>
										)}
										{goalLine?.max != null && (
											<ReferenceLine
												y={goalLine.max}
												stroke="var(--warning)"
												strokeDasharray="4 4"
											/>
										)}
										<Area
											type="monotone"
											dataKey="weight"
											name="Weight"
											stroke="var(--primary)"
											strokeWidth={2}
											fill="url(#weightFill)"
										/>
										<Line
											type="monotone"
											dataKey="rolling_avg"
											name="7-day avg"
											stroke="var(--accent)"
											strokeWidth={1.5}
											dot={false}
										/>
									</AreaChart>
								</ResponsiveContainer>
							) : (
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={chartData}>
										<XAxis
											dataKey="date"
											tickFormatter={(d) => formatDate(d, 'MMM d')}
											tick={{ fill: 'var(--muted)', fontSize: 11 }}
											axisLine={false}
											tickLine={false}
										/>
										<YAxis
											tick={{ fill: 'var(--muted)', fontSize: 11 }}
											axisLine={false}
											tickLine={false}
											domain={['auto', 'auto']}
										/>
										<Tooltip content={<WeightTooltip unit={unit} />} />
										{typeof goalLine === 'number' && (
											<ReferenceLine y={goalLine} stroke="var(--success)" strokeDasharray="4 4" />
										)}
										{goalLine?.min != null && (
											<ReferenceLine
												y={goalLine.min}
												stroke="var(--warning)"
												strokeDasharray="4 4"
											/>
										)}
										{goalLine?.max != null && (
											<ReferenceLine
												y={goalLine.max}
												stroke="var(--warning)"
												strokeDasharray="4 4"
											/>
										)}
										<Line
											type="monotone"
											dataKey="weight"
											name="Weight"
											stroke="var(--primary)"
											strokeWidth={2}
											dot={{ r: 3 }}
										/>
										<Line
											type="monotone"
											dataKey="rolling_avg"
											name="7-day avg"
											stroke="var(--accent)"
											strokeWidth={1.5}
											dot={false}
											strokeDasharray="4 4"
										/>
									</LineChart>
								</ResponsiveContainer>
							)}
						</div>
						{stats && (
							<p className="text-muted mt-2 text-xs">
								Range min {formatWeight(stats.min, unit)} · max {formatWeight(stats.max, unit)} ·
								avg {formatWeight(stats.avg, unit)}
								{stats.rate_per_week != null && ` · ${formatDelta(stats.rate_per_week, unit)}/week`}
							</p>
						)}
					</CardBody>
				</Card>

				<Card>
					<CardHeader title="Logged days" subtitle="Last 12 weeks" />
					<CardBody className="flex justify-center">
						<CompactActivityTile
							timeline={(heatmap?.timeline || []).map((d) => ({
								...d,
								intensity: d.logged ? 1 : 0
							}))}
							weeks={12}
						/>
					</CardBody>
					<div className="border-line space-y-3 border-t px-4 py-4">
						<p className="text-fg text-sm font-medium">Quick settings</p>
						<Select
							label="Unit"
							value={profile?.unit || 'kg'}
							onChange={(e) => saveProfile.mutate({ unit: e.target.value })}
						>
							<option value="kg">kg</option>
							<option value="lb">lb</option>
						</Select>
						<label className="text-fg flex cursor-pointer items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={!!profile?.reminder_enabled}
								onChange={(e) =>
									saveProfile.mutate({
										reminder_enabled: e.target.checked,
										reminder_time: profile?.reminder_time || '09:00:00'
									})
								}
								className="accent-primary"
							/>
							Weigh-in reminder
						</label>
						{profile?.reminder_enabled && (
							<Input
								label="Reminder time"
								type="time"
								value={(profile.reminder_time || '09:00').slice(0, 5)}
								onChange={(e) =>
									saveProfile.mutate({
										reminder_enabled: true,
										reminder_time: e.target.value
									})
								}
							/>
						)}
						<Link to="/settings" className="text-primary text-xs font-medium hover:underline">
							Full goal settings →
						</Link>
					</div>
				</Card>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<CompositionPanel
					composition={composition}
					profile={fitnessProfile}
					weightProfile={profile}
					lengthUnit={lengthUnit}
					unit={unit}
				/>
				<EnergyPanel composition={composition} weightProfile={profile} calories={calories} />
			</div>

			<MeasurementsPanel lengthUnit={lengthUnit} />
			<ProgressPhotosPanel unit={unit} />

			<Card>
				<CardHeader title="History" subtitle="One entry per day" />
				<CardBody className="space-y-2">
					{listLoading && <p className="text-muted text-sm">Loading…</p>}
					{!listLoading && entries.length === 0 && (
						<p className="text-muted text-sm">No entries yet.</p>
					)}
					{entries.map((entry) => (
						<div
							key={entry.id}
							className="border-line flex items-center gap-3 rounded-md border px-3 py-2.5"
						>
							<div className="min-w-0 flex-1">
								<p className="text-fg text-sm font-medium">{formatWeight(entry.weight, unit)}</p>
								<p className="text-muted text-xs">
									{formatDate(entry.date, 'EEE, MMM d, yyyy')} · {(entry.time || '').slice(0, 5)}
									{entry.locked ? ' · locked' : ''}
								</p>
							</div>
							{!entry.locked && (
								<>
									<button
										type="button"
										className="text-muted hover:text-primary cursor-pointer text-xs font-medium"
										onClick={() => {
											setEditEntry(entry);
											setEditWeight(String(entry.weight));
											setEditTime((entry.time || '').slice(0, 5));
										}}
									>
										Edit
									</button>
									<button
										type="button"
										className="text-muted hover:text-danger cursor-pointer"
										aria-label="Delete entry"
										onClick={() => {
											if (confirm('Delete this weigh-in?')) remove.mutate(entry.id);
										}}
									>
										<Trash2 size={15} />
									</button>
								</>
							)}
						</div>
					))}
				</CardBody>
			</Card>

			<OnboardingModal
				open={!!showOnboarding}
				profile={profile}
				onClose={() => setOnboardingDismissed(true)}
			/>

			<Modal
				open={!!editEntry}
				onClose={() => setEditEntry(null)}
				title="Edit weigh-in"
				size="sm"
				footer={
					<>
						<Button variant="ghost" onClick={() => setEditEntry(null)}>
							Cancel
						</Button>
						<Button onClick={saveEdit} loading={update.isPending}>
							Save
						</Button>
					</>
				}
			>
				<div className="space-y-3">
					<Input
						label="Time"
						type="time"
						value={editTime}
						onChange={(e) => setEditTime(e.target.value)}
					/>
					<Input
						label={`Weight (${unit})`}
						type="number"
						step="0.01"
						min="0.01"
						max={MAX_WEIGHT[unit]}
						value={editWeight}
						onChange={(e) => setEditWeight(e.target.value)}
					/>
				</div>
			</Modal>
		</div>
	);
}
