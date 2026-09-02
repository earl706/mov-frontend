import { useMemo } from 'react';
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis
} from 'recharts';

import { formatDate, formatDurationSeconds } from '../../lib/format';

const tooltipStyle = {
	background: 'var(--surface)',
	border: '1px solid var(--line)',
	borderRadius: 8,
	fontSize: 12
};

function SetWorkRestTooltip({ active, payload }) {
	if (!active || !payload?.length) return null;
	const row = payload[0]?.payload;
	if (!row || row.is_gap) return null;

	const dateLabel = row.session_date ? formatDate(row.session_date, 'EEE, MMM d') : '';
	const sessionLabel = row.template_name ? `${row.template_name} · ${dateLabel}` : dateLabel;

	return (
		<div style={tooltipStyle} className="px-2.5 py-2">
			<p className="text-fg text-xs font-medium">
				{row.exercise_name} · set {row.set_index}
			</p>
			{sessionLabel && <p className="text-muted text-[11px]">{sessionLabel}</p>}
			<p className="text-muted mt-1 text-[11px]">
				Work {formatDurationSeconds(row.work_seconds ?? row.work)} · Rest{' '}
				{formatDurationSeconds(row.rest_seconds ?? row.rest)}
			</p>
		</div>
	);
}

/** Stacked work/rest bars for set-level timing (History detail + dashboard recent sets). */
export function SetWorkRestBarChart({ sets, compact = false, strip = false, className = '' }) {
	const data = useMemo(() => {
		const rows = strip ? (sets || []).filter((row) => !row.is_gap) : sets || [];
		return rows.map((row) => ({
			...row,
			work: row.work_seconds ?? row.work ?? 0,
			rest: row.rest_seconds ?? row.rest ?? 0
		}));
	}, [sets, strip]);

	if (!data.length) return null;

	const chartClass =
		className ||
		(strip ? 'h-20 w-full' : compact ? 'h-12 w-28 shrink-0 sm:h-14 sm:w-40' : 'h-44 w-full');
	const margin = strip
		? { top: 2, right: 0, left: 0, bottom: 0 }
		: compact
			? { top: 2, right: 0, left: 0, bottom: 2 }
			: { top: 4, right: 4, left: -12, bottom: 0 };
	const maxBarSize = strip ? 4 : compact ? 10 : 14;
	const barCategoryGap = strip ? 0 : compact ? 2 : 4;
	const showAxes = !compact && !strip;

	return (
		<div className={chartClass}>
			<ResponsiveContainer width="100%" height="100%">
				<BarChart data={data} margin={margin} barCategoryGap={barCategoryGap}>
					{showAxes && <CartesianGrid stroke="var(--line)" vertical={false} />}
					{showAxes && (
						<XAxis
							dataKey="tick"
							tick={{ fill: 'var(--muted)', fontSize: 11 }}
							axisLine={false}
							tickLine={false}
							interval={0}
						/>
					)}
					{showAxes && (
						<YAxis
							tick={{ fill: 'var(--muted)', fontSize: 11 }}
							axisLine={false}
							tickLine={false}
							tickFormatter={(value) => formatDurationSeconds(value)}
						/>
					)}
					<Tooltip content={<SetWorkRestTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
					{showAxes && <Legend wrapperStyle={{ fontSize: 12 }} />}
					<Bar
						dataKey="work"
						name="Work"
						stackId="time"
						fill="var(--primary)"
						maxBarSize={maxBarSize}
					>
						{data.map((row, index) => (
							<Cell key={`work-${index}`} fill={row.is_gap ? 'transparent' : 'var(--primary)'} />
						))}
					</Bar>
					<Bar
						dataKey="rest"
						name="Rest"
						stackId="time"
						fill="var(--success)"
						maxBarSize={maxBarSize}
						radius={strip ? [2, 2, 0, 0] : [4, 4, 0, 0]}
					>
						{data.map((row, index) => (
							<Cell key={`rest-${index}`} fill={row.is_gap ? 'transparent' : 'var(--success)'} />
						))}
					</Bar>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
