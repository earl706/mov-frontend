export function secondsToDigits(totalSeconds) {
	const { hours, minutes, seconds } = hmsFromSeconds(totalSeconds);
	const raw = `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}${String(seconds).padStart(2, '0')}`;
	return raw
		.slice(0, 6)
		.split('')
		.map((d) => Number(d));
}

export function clampTimerDigits(digits) {
	const d = digits.slice(0, 6).map((n) => (Number.isFinite(n) ? Math.min(9, Math.max(0, n)) : 0));
	while (d.length < 6) d.push(0);
	let h = d[0] * 10 + d[1];
	let m = d[2] * 10 + d[3];
	let s = d[4] * 10 + d[5];
	if (h > 99) h = 99;
	if (m > 59) m = 59;
	if (s > 59) s = 59;
	const hh = String(h).padStart(2, '0');
	const mm = String(m).padStart(2, '0');
	const ss = String(s).padStart(2, '0');
	return [...(hh + mm + ss)].map((c) => Number(c));
}

export function digitsToSeconds(digits) {
	const d = clampTimerDigits(digits);
	const h = d[0] * 10 + d[1];
	const m = d[2] * 10 + d[3];
	const s = d[4] * 10 + d[5];
	return h * 3600 + m * 60 + s;
}

export function formatTimerHms(totalSeconds) {
	const safe = Math.max(0, Math.floor(totalSeconds));
	const h = Math.floor(safe / 3600);
	const m = Math.floor((safe % 3600) / 60);
	const s = safe % 60;
	return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatTimerDisplay(totalSeconds) {
	const safe = Math.max(0, Math.floor(totalSeconds));
	const h = Math.floor(safe / 3600);
	const m = Math.floor((safe % 3600) / 60);
	const s = safe % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function parseTimerInput(raw) {
	const trimmed = String(raw ?? '').trim();
	if (!trimmed) return 0;
	if (/^\d+$/.test(trimmed)) {
		const n = Number(trimmed);
		if (trimmed.length <= 2) return n;
		if (trimmed.length <= 4) {
			const m = Number(trimmed.slice(0, -2)) || 0;
			const s = Number(trimmed.slice(-2)) || 0;
			return m * 60 + Math.min(59, s);
		}
		const h = Number(trimmed.slice(0, -4)) || 0;
		const m = Number(trimmed.slice(-4, -2)) || 0;
		const s = Number(trimmed.slice(-2)) || 0;
		return h * 3600 + Math.min(59, m) * 60 + Math.min(59, s);
	}
	const parts = trimmed.split(':').map((p) => Math.max(0, parseInt(p, 10) || 0));
	if (parts.length >= 3)
		return parts[0] * 3600 + Math.min(59, parts[1]) * 60 + Math.min(59, parts[2]);
	if (parts.length === 2) return parts[0] * 60 + Math.min(59, parts[1]);
	return Math.min(59, parts[0]);
}

export function sanitizeTimerInput(raw) {
	return String(raw ?? '')
		.replace(/[^\d:]/g, '')
		.slice(0, 8);
}

export function secondsFromHms(hours, minutes, seconds) {
	return Math.max(
		0,
		(Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60 + (Number(seconds) || 0)
	);
}

export function hmsFromSeconds(total) {
	const safe = Math.max(0, Math.floor(total));
	return {
		hours: Math.floor(safe / 3600),
		minutes: Math.floor((safe % 3600) / 60),
		seconds: safe % 60
	};
}
