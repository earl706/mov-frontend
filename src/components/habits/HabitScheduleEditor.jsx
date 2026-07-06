import { Plus, Trash2 } from 'lucide-react';

import { HABIT_FREQUENCIES, newPhaseRow } from '../../lib/habitSchedule';
import { Button, Select } from '../ui';

export function HabitScheduleEditor({ phases, onChange, onApplyPreset }) {
	const update = (index, patch) => {
		onChange(phases.map((p, i) => (i === index ? { ...p, ...patch } : p)));
	};

	const addPhase = () => {
		const last = phases[phases.length - 1];
		const nextFrom = last
			? last.to_week === ''
				? last.from_week + 1
				: Number(last.to_week) + 1
			: 1;
		onChange([...phases, newPhaseRow(nextFrom)]);
	};

	const removePhase = (index) => {
		onChange(phases.filter((_, i) => i !== index));
	};

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="text-muted text-xs font-medium tracking-wide uppercase">Week phases</p>
				{onApplyPreset && (
					<Button type="button" size="sm" variant="ghost" onClick={onApplyPreset}>
						Apply progression preset
					</Button>
				)}
			</div>
			{phases.length === 0 && (
				<p className="text-muted text-sm">
					Add phases to define how the schedule changes each week.
				</p>
			)}
			{phases.map((phase, index) => (
				<div
					key={index}
					className="border-line bg-surface-2 grid grid-cols-2 gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
				>
					<label className="space-y-1">
						<span className="text-muted text-[11px]">From week</span>
						<input
							type="number"
							min={1}
							value={phase.from_week}
							onChange={(e) => update(index, { from_week: Number(e.target.value) || 1 })}
							className="border-line bg-surface w-full rounded-lg border px-2 py-1.5 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="text-muted text-[11px]">To week</span>
						<input
							type="number"
							min={phase.from_week}
							value={phase.to_week}
							placeholder={index === phases.length - 1 ? '∞' : ''}
							onChange={(e) =>
								update(index, { to_week: e.target.value === '' ? '' : Number(e.target.value) })
							}
							disabled={index === phases.length - 1}
							className="border-line bg-surface w-full rounded-lg border px-2 py-1.5 text-sm disabled:opacity-50"
						/>
					</label>
					<Select
						label="Frequency"
						value={phase.frequency}
						onChange={(e) => update(index, { frequency: e.target.value })}
					>
						{HABIT_FREQUENCIES.map((f) => (
							<option key={f.value} value={f.value}>
								{f.label}
							</option>
						))}
					</Select>
					<div className="flex items-end justify-end">
						<button
							type="button"
							onClick={() => removePhase(index)}
							disabled={phases.length <= 1}
							className="text-muted hover:text-danger cursor-pointer rounded-lg p-2 disabled:cursor-default disabled:opacity-40"
							aria-label="Remove phase"
						>
							<Trash2 size={16} />
						</button>
					</div>
					{phase.frequency === 'biweekly' && (
						<label className="col-span-2 space-y-1 sm:col-span-4">
							<span className="text-muted text-[11px]">Times per week</span>
							<input
								type="number"
								min={2}
								max={7}
								value={phase.target_per_period}
								onChange={(e) =>
									update(index, { target_per_period: Math.max(2, Number(e.target.value) || 2) })
								}
								className="border-line bg-surface w-full max-w-[8rem] rounded-lg border px-2 py-1.5 text-sm"
							/>
						</label>
					)}
				</div>
			))}
			<Button type="button" size="sm" variant="secondary" onClick={addPhase}>
				<Plus size={15} /> Add phase
			</Button>
		</div>
	);
}
