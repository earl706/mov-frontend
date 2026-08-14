/** Display helpers for body weight (canonical storage is kg). */

export const KG_PER_LB = 0.45359237;

/** Backend rows that store raw kilograms need converting before display. */
export function fromKg(value, unit = 'kg') {
	if (value == null) return null;
	const kg = Number(value);
	return unit === 'lb' ? kg / KG_PER_LB : kg;
}

export function formatWeight(value, unit = 'kg') {
	if (value == null || Number.isNaN(Number(value))) return '—';
	return `${Number(value).toFixed(2)} ${unit}`;
}

export function formatDelta(value, unit = 'kg') {
	if (value == null || Number.isNaN(Number(value))) return '—';
	const n = Number(value);
	const sign = n > 0 ? '+' : '';
	return `${sign}${n.toFixed(2)} ${unit}`;
}

export function localDateKey(d = new Date()) {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export function localTimeValue(d = new Date()) {
	const h = String(d.getHours()).padStart(2, '0');
	const m = String(d.getMinutes()).padStart(2, '0');
	return `${h}:${m}`;
}
