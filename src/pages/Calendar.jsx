import { useMemo, useState } from 'react';
import {
	addMonths,
	eachDayOfInterval,
	endOfMonth,
	endOfWeek,
	format,
	isSameDay,
	isSameMonth,
	parseISO,
	startOfMonth,
	startOfWeek
} from 'date-fns';
import { Calendar as CalIcon, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

import { cn } from '../lib/format';
import { PageHeader } from '../components/layout/PageHeader';
import { Button, Input, Modal, Select } from '../components/ui';
import { eventsApi } from '../lib/resources';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const KIND_COLOR = {
	event: '#6366f1',
	focus_block: '#10b981',
	deadline: '#ef4444',
	meeting: '#ec4899'
};

export default function CalendarPage() {
	const [cursor, setCursor] = useState(new Date());
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(null);
	const { data } = eventsApi.useList({ page_size: 200 });
	const create = eventsApi.useCreate();
	const remove = eventsApi.useRemove();

	const days = useMemo(() => {
		const start = startOfWeek(startOfMonth(cursor));
		const end = endOfWeek(endOfMonth(cursor));
		return eachDayOfInterval({ start, end });
	}, [cursor]);

	const eventsByDay = useMemo(() => {
		const map = {};
		for (const ev of data?.results || []) {
			const key = format(parseISO(ev.start), 'yyyy-MM-dd');
			(map[key] ||= []).push(ev);
		}
		return map;
	}, [data]);

	const openNew = (day) => {
		const base = format(day, "yyyy-MM-dd'T'09:00");
		setForm({ title: '', kind: 'event', start: base, end: format(day, "yyyy-MM-dd'T'10:00") });
		setOpen(true);
	};

	const submit = async (e) => {
		e.preventDefault();
		await create.mutateAsync({
			...form,
			start: new Date(form.start).toISOString(),
			end: new Date(form.end).toISOString(),
			color: KIND_COLOR[form.kind]
		});
		setOpen(false);
	};

	return (
		<div>
			<PageHeader
				title="Calendar"
				icon={CalIcon}
				description={format(cursor, 'MMMM yyyy')}
				actions={
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setCursor(addMonths(cursor, -1))}
							aria-label="Previous month"
						>
							<ChevronLeft size={18} />
						</Button>
						<Button variant="secondary" size="sm" onClick={() => setCursor(new Date())}>
							Today
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setCursor(addMonths(cursor, 1))}
							aria-label="Next month"
						>
							<ChevronRight size={18} />
						</Button>
					</div>
				}
			/>

			<div className="border-line bg-surface overflow-hidden rounded-md border">
				<div className="border-line bg-surface-2 text-muted grid grid-cols-7 border-b text-center text-xs font-medium">
					{WEEKDAYS.map((d) => (
						<div key={d} className="py-2">
							{d}
						</div>
					))}
				</div>
				<div className="grid grid-cols-7">
					{days.map((day) => {
						const key = format(day, 'yyyy-MM-dd');
						const dayEvents = eventsByDay[key] || [];
						const inMonth = isSameMonth(day, cursor);
						const today = isSameDay(day, new Date());
						return (
							<button
								key={key}
								onClick={() => openNew(day)}
								className={cn(
									'group border-line hover:bg-surface-2 min-h-24 cursor-pointer border-r border-b p-1.5 text-left align-top transition-colors',
									!inMonth && 'opacity-40'
								)}
							>
								<span
									className={cn(
										'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs',
										today ? 'bg-primary text-primary-fg' : 'text-fg'
									)}
								>
									{format(day, 'd')}
								</span>
								<div className="mt-1 space-y-1">
									{dayEvents.slice(0, 3).map((ev) => (
										<span
											key={ev.id}
											onClick={(e) => {
												e.stopPropagation();
												remove.mutate(ev.id);
											}}
											className="block cursor-pointer truncate rounded-sm px-1.5 py-0.5 text-[11px] text-white"
											style={{ background: ev.color || KIND_COLOR[ev.kind] }}
											title={`${ev.title} — click to delete`}
										>
											{ev.title}
										</span>
									))}
									{dayEvents.length > 3 && (
										<span className="text-muted px-1 text-[11px]">
											+{dayEvents.length - 3} more
										</span>
									)}
								</div>
							</button>
						);
					})}
				</div>
			</div>

			{form && (
				<Modal
					open={open}
					onClose={() => setOpen(false)}
					title="New event"
					footer={
						<>
							<Button variant="ghost" onClick={() => setOpen(false)}>
								Cancel
							</Button>
							<Button form="event-form" type="submit" loading={create.isPending}>
								<Plus size={15} /> Add
							</Button>
						</>
					}
				>
					<form id="event-form" onSubmit={submit} className="space-y-4">
						<Input
							label="Title"
							value={form.title}
							onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
							required
							autoFocus
						/>
						<Select
							label="Type"
							value={form.kind}
							onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
						>
							<option value="event">Event</option>
							<option value="meeting">Meeting</option>
							<option value="focus_block">Focus block</option>
							<option value="deadline">Deadline</option>
						</Select>
						<div className="grid grid-cols-2 gap-3">
							<Input
								label="Start"
								type="datetime-local"
								value={form.start}
								onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
							/>
							<Input
								label="End"
								type="datetime-local"
								value={form.end}
								onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
							/>
						</div>
					</form>
				</Modal>
			)}
		</div>
	);
}
