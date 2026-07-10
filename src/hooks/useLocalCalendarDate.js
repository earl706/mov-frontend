import { useEffect, useState } from 'react';

function formatLocalDate(date = new Date()) {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

function msUntilNextMidnight() {
	const now = new Date();
	const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
	return next.getTime() - now.getTime();
}

export function useLocalCalendarDate() {
	const [date, setDate] = useState(formatLocalDate);

	useEffect(() => {
		let timeoutId;
		const schedule = () => {
			timeoutId = window.setTimeout(() => {
				setDate(formatLocalDate());
				schedule();
			}, msUntilNextMidnight());
		};
		schedule();
		return () => window.clearTimeout(timeoutId);
	}, []);

	return date;
}
