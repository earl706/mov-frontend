export const HABIT_FREQUENCIES = [
	{ value: 'daily', label: 'Daily' },
	{ value: 'eod', label: 'Every other day' },
	{ value: 'biweekly', label: '2× per week' },
	{ value: 'weekly', label: 'Weekly' }
];

export const PROGRESSION_PRESET = {
	id: 'progression',
	label: 'Progression (Daily → EOD → 2×/wk → Weekly)',
	phases: [
		{ from_week: 1, to_week: 1, frequency: 'daily', target_per_period: 1 },
		{ from_week: 2, to_week: 2, frequency: 'eod', target_per_period: 1 },
		{ from_week: 3, to_week: 3, frequency: 'biweekly', target_per_period: 2 },
		{ from_week: 4, to_week: null, frequency: 'weekly', target_per_period: 1 }
	]
};

export const TIMING_LABELS = {
	on_time: 'On time',
	early: 'Early',
	late: 'Late'
};

export const STATUS_LABELS = {
	completed: 'Completed',
	due: 'Due today',
	early: 'Early — not due yet'
};

export function defaultHabitForm() {
	return {
		name: '',
		description: '',
		color: '#10b981',
		schedule_mode: 'fixed',
		frequency: 'daily',
		target_per_period: 1,
		schedule_phases: []
	};
}

export function habitToForm(habit) {
	return {
		name: habit.name || '',
		description: habit.description || '',
		color: habit.color || '#10b981',
		schedule_mode: habit.schedule_mode || 'fixed',
		frequency: habit.frequency || habit.cadence || 'daily',
		target_per_period: habit.target_per_period ?? 1,
		schedule_phases: (habit.schedule_phases || []).map((p) => ({
			from_week: p.from_week,
			to_week: p.to_week ?? '',
			frequency: p.frequency,
			target_per_period: p.target_per_period ?? 1
		}))
	};
}

export function formToPayload(form) {
	const payload = {
		name: form.name,
		description: form.description || '',
		color: form.color,
		schedule_mode: form.schedule_mode,
		target_per_period: Number(form.target_per_period) || 1
	};
	if (form.schedule_mode === 'fixed') {
		payload.frequency = form.frequency;
		payload.schedule_phases = [];
		if (form.frequency === 'biweekly' && payload.target_per_period < 2) {
			payload.target_per_period = 2;
		}
	} else {
		payload.frequency = 'daily';
		payload.schedule_phases = form.schedule_phases.map((p) => ({
			from_week: Number(p.from_week),
			to_week: p.to_week === '' || p.to_week == null ? null : Number(p.to_week),
			frequency: p.frequency,
			target_per_period:
				p.frequency === 'biweekly'
					? Math.max(2, Number(p.target_per_period) || 2)
					: Number(p.target_per_period) || 1
		}));
		if (payload.schedule_phases.length) {
			const last = payload.schedule_phases[payload.schedule_phases.length - 1];
			last.to_week = null;
		}
	}
	return payload;
}

export function newPhaseRow(fromWeek = 1) {
	return {
		from_week: fromWeek,
		to_week: fromWeek,
		frequency: 'daily',
		target_per_period: 1
	};
}

export function formatNextDue(iso) {
	if (!iso) return '—';
	const d = new Date(`${iso}T12:00:00`);
	const today = new Date();
	today.setHours(12, 0, 0, 0);
	const diff = Math.round((d - today) / 86400000);
	if (diff === 0) return 'Today';
	if (diff === 1) return 'Tomorrow';
	if (diff < 0) return 'Overdue';
	return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
