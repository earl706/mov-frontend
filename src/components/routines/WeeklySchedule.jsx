import { useState } from 'react';

import { cn } from '../../lib/format';
import { useUpdateWeeklySchedule, useWeeklySchedule } from '../../lib/resources';
import { Badge, Button, Card, CardBody, CardHeader, Modal } from '../ui';

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function assignmentPayload(days, weekday, templateId) {
	return {
		days: days
			.map((day) => {
				if (day.weekday === weekday) {
					return templateId ? { weekday, template: templateId } : null;
				}
				return day.template ? { weekday: day.weekday, template: day.template.id } : null;
			})
			.filter(Boolean)
	};
}

export function WeeklySchedule({ routines }) {
	const { data, isLoading } = useWeeklySchedule();
	const save = useUpdateWeeklySchedule();
	const [picking, setPicking] = useState(null);

	const days = data?.days || [];
	const assignable = (routines || []).filter((routine) => routine.is_active);
	const trainingDays = days.filter((day) => day.template?.is_active).length;

	const assign = (weekday, templateId) => {
		save.mutate(assignmentPayload(days, weekday, templateId), {
			onSuccess: () => setPicking(null)
		});
	};

	if (isLoading || !days.length) return null;

	return (
		<>
			<Card>
				<CardHeader
					title="Weekly split"
					subtitle={
						data.configured
							? `${trainingDays} training day${trainingDays === 1 ? '' : 's'} · unassigned days are rest`
							: 'Tap a day to assign a routine. Unassigned days are rest.'
					}
				/>
				<CardBody>
					<div className="grid grid-cols-7 gap-1.5 sm:gap-2">
						{days.map((day) => {
							const isToday = day.weekday === data.today_weekday;
							const rest = !day.template;
							return (
								<button
									key={day.weekday}
									type="button"
									onClick={() => setPicking(day.weekday)}
									className={cn(
										'border-line flex cursor-pointer flex-col items-center gap-1 rounded-md border px-1 py-2 text-center',
										'hover:bg-surface-2',
										isToday && 'border-primary',
										rest && 'text-muted'
									)}
									aria-label={`${WEEKDAY_FULL[day.weekday]}: ${day.template?.name || 'Rest'}`}
								>
									<span className="text-[11px] font-medium tracking-wide uppercase">
										{WEEKDAY_SHORT[day.weekday]}
									</span>
									<span className={cn('w-full truncate text-xs font-semibold', !rest && 'text-fg')}>
										{day.template?.name || 'Rest'}
									</span>
									<span
										className="h-1.5 w-1.5 rounded-full"
										style={{
											background: day.template?.color || 'transparent',
											outline: rest ? '1px solid var(--line)' : undefined
										}}
									/>
								</button>
							);
						})}
					</div>
				</CardBody>
			</Card>

			<Modal
				open={picking != null}
				onClose={() => setPicking(null)}
				title={picking != null ? WEEKDAY_FULL[picking] : ''}
				size="sm"
			>
				{picking != null && (
					<div className="space-y-2">
						<p className="text-muted text-sm">
							Pick the routine for this day, or leave it as rest.
						</p>
						{!assignable.length && (
							<p className="text-muted text-sm">Create an active routine first.</p>
						)}
						{assignable.map((routine) => {
							const selected = days[picking]?.template?.id === routine.id;
							return (
								<button
									key={routine.id}
									type="button"
									onClick={() => assign(picking, routine.id)}
									disabled={save.isPending}
									className={cn(
										'border-line flex w-full cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-left',
										'hover:bg-surface-2 disabled:cursor-default',
										selected && 'border-primary'
									)}
								>
									<span
										className="h-2.5 w-2.5 shrink-0 rounded-full"
										style={{ background: routine.color }}
									/>
									<span className="text-fg min-w-0 flex-1 truncate text-sm font-medium">
										{routine.name}
									</span>
									{selected && <Badge tone="primary">Assigned</Badge>}
								</button>
							);
						})}
						<Button
							variant="ghost"
							className="w-full"
							onClick={() => assign(picking, null)}
							loading={save.isPending}
						>
							Rest
						</Button>
					</div>
				)}
			</Modal>
		</>
	);
}
