import { useEffect, useState } from 'react';

import {
	HABIT_FREQUENCIES,
	PROGRESSION_PRESET,
	defaultHabitForm,
	formToPayload,
	habitToForm,
	newPhaseRow
} from '../../lib/habitSchedule';
import { habitsApi } from '../../lib/resources';
import { HabitScheduleEditor } from './HabitScheduleEditor';
import { Button, Input, Modal, Select, Textarea } from '../ui';

const HABIT_COLORS = ['#10b981', '#6366f1', '#ef4444', '#f59e0b', '#ec4899'];

export function HabitFormModal({ open, onClose, habit }) {
	const isEdit = Boolean(habit);
	const [form, setForm] = useState(defaultHabitForm);
	const create = habitsApi.useCreate();
	const update = habitsApi.useUpdate();

	useEffect(() => {
		if (open) {
			setForm(habit ? habitToForm(habit) : defaultHabitForm());
		}
	}, [open, habit]);

	const setMode = (schedule_mode) => {
		setForm((f) => ({
			...f,
			schedule_mode,
			schedule_phases:
				schedule_mode === 'phased' && f.schedule_phases.length === 0
					? [newPhaseRow(1)]
					: f.schedule_phases
		}));
	};

	const applyPreset = () => {
		setForm((f) => ({
			...f,
			schedule_mode: 'phased',
			schedule_phases: PROGRESSION_PRESET.phases.map((p) => ({
				from_week: p.from_week,
				to_week: p.to_week ?? '',
				frequency: p.frequency,
				target_per_period: p.target_per_period
			}))
		}));
	};

	const submit = async (e) => {
		e.preventDefault();
		const payload = formToPayload(form);
		if (isEdit) await update.mutateAsync({ id: habit.id, ...payload });
		else await create.mutateAsync(payload);
		onClose();
	};

	return (
		<Modal
			open={open}
			onClose={onClose}
			title={isEdit ? 'Edit habit' : 'New habit'}
			size="lg"
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button form="habit-form" type="submit" loading={create.isPending || update.isPending}>
						{isEdit ? 'Save' : 'Create'}
					</Button>
				</>
			}
		>
			<form id="habit-form" onSubmit={submit} className="space-y-4">
				<Input
					label="Name"
					value={form.name}
					onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
					required
					autoFocus
				/>
				<Textarea
					label="Description"
					rows={2}
					value={form.description}
					onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
				/>

				<div>
					<p className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
						Schedule type
					</p>
					<div className="grid grid-cols-2 gap-2">
						{[
							{ id: 'fixed', label: 'Fixed frequency' },
							{ id: 'phased', label: 'Phased by week' }
						].map((opt) => (
							<button
								key={opt.id}
								type="button"
								onClick={() => setMode(opt.id)}
								className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium ${
									form.schedule_mode === opt.id
										? 'border-primary bg-primary/10 text-primary'
										: 'border-line text-fg hover:bg-surface-2'
								}`}
							>
								{opt.label}
							</button>
						))}
					</div>
				</div>

				{form.schedule_mode === 'fixed' ? (
					<>
						<Select
							label="Frequency"
							value={form.frequency}
							onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
						>
							{HABIT_FREQUENCIES.map((f) => (
								<option key={f.value} value={f.value}>
									{f.label}
								</option>
							))}
						</Select>
						{(form.frequency === 'weekly' || form.frequency === 'biweekly') && (
							<Input
								label={form.frequency === 'biweekly' ? 'Times per week' : 'Target per week'}
								type="number"
								min={form.frequency === 'biweekly' ? 2 : 1}
								max={7}
								value={form.target_per_period}
								onChange={(e) =>
									setForm((f) => ({ ...f, target_per_period: Number(e.target.value) || 1 }))
								}
							/>
						)}
					</>
				) : (
					<HabitScheduleEditor
						phases={form.schedule_phases}
						onChange={(schedule_phases) => setForm((f) => ({ ...f, schedule_phases }))}
						onApplyPreset={applyPreset}
					/>
				)}

				<div>
					<p className="text-muted mb-2 text-sm font-medium">Color</p>
					<div className="flex gap-2">
						{HABIT_COLORS.map((c) => (
							<button
								key={c}
								type="button"
								onClick={() => setForm((f) => ({ ...f, color: c }))}
								className="h-8 w-8 cursor-pointer rounded-full"
								style={{
									background: c,
									outline: form.color === c ? `2px solid ${c}` : 'none',
									outlineOffset: 2
								}}
							/>
						))}
					</div>
				</div>
			</form>
		</Modal>
	);
}
