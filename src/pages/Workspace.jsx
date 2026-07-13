import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
	Bell,
	Check,
	CheckCheck,
	Info,
	Lightbulb,
	Pin,
	Plus,
	Repeat,
	StickyNote,
	Trash2,
	TriangleAlert
} from 'lucide-react';
import { cn, fromNow } from '../lib/format';
import { CompactHabitGrid } from '../components/analytics/ActivityHeatmap';
import { HabitFormModal } from '../components/habits/HabitFormModal';
import { PageHeader } from '../components/layout/PageHeader';
import { formatNextDue, STATUS_LABELS, TIMING_LABELS } from '../lib/habitSchedule';
import {
	Button,
	Badge,
	Card,
	EmptyState,
	Input,
	ListToolbar,
	LoadingScreen,
	Modal,
	Pagination,
	ProgressRing,
	Textarea
} from '../components/ui';
import {
	habitsApi,
	notesApi,
	notificationsApi,
	projectsApi,
	useHabitCheckIn,
	useMarkAllRead,
	useMarkRead
} from '../lib/resources';
import { useListControls } from '../hooks/useListControls';

const KINDS = { '/habits': 'habits', '/notes': 'notes', '/notifications': 'notifications' };
const LEVEL_META = {
	info: { icon: Info, tone: 'var(--primary)' },
	success: { icon: CheckCheck, tone: 'var(--success)' },
	warning: { icon: TriangleAlert, tone: 'var(--warning)' },
	insight: { icon: Lightbulb, tone: 'var(--accent)' }
};
const NOTE_EMPTY = { title: '', content: '' };

function HabitCard({ habit, onEdit }) {
	const checkIn = useHabitCheckIn();
	const remove = habitsApi.useRemove();
	const [confirmOpen, setConfirmOpen] = useState(false);
	const m = habit.momentum || {};
	const today = new Date().toISOString().slice(0, 10);
	const doneToday = (habit.recent_logs || []).includes(today);
	const status = habit.today_status || {};
	const timing = status.timing || (doneToday ? 'on_time' : null);

	const onDelete = async () => {
		await remove.mutateAsync(habit.id);
		setConfirmOpen(false);
	};

	const checkInLabel = doneToday
		? `Completed${timing ? ` · ${TIMING_LABELS[timing] || timing}` : ''}`
		: status.status === 'early'
			? `Log early · ${STATUS_LABELS.early}`
			: status.status === 'due' && status.timing === 'late'
				? 'Log · overdue'
				: 'Mark complete';

	return (
		<Card as={motion.div} layout className="relative p-5">
			<div className="absolute top-4 right-4 flex gap-1">
				<button
					type="button"
					onClick={() => onEdit(habit)}
					className="text-muted hover:text-primary cursor-pointer text-xs font-medium"
				>
					Edit
				</button>
				<button
					type="button"
					onClick={() => setConfirmOpen(true)}
					className="text-muted hover:text-danger cursor-pointer"
					aria-label={`Delete ${habit.name}`}
				>
					<Trash2 size={15} />
				</button>
			</div>
			<div className="flex items-start gap-3 pr-14">
				<ProgressRing value={m.momentum ?? 0} size={52} stroke={5} tone="success" />
				<div className="min-w-0">
					<h3 className="text-fg font-semibold">{habit.name}</h3>
					<p className="text-muted text-xs">
						{habit.current_phase_label || habit.schedule_summary} · {m.current_streak ?? 0} period
						streak
					</p>
					<p className="text-muted mt-0.5 text-[11px]">
						Next due {formatNextDue(habit.next_due_date)}
					</p>
				</div>
			</div>
			<div className="mt-4 w-full">
				<CompactHabitGrid
					logs={habit.recent_logs}
					createdAt={habit.created_at}
					color={habit.color}
				/>
			</div>
			{!doneToday && status.status === 'due' && status.timing === 'late' && (
				<Badge tone="warning" className="mt-3">
					Overdue
				</Badge>
			)}
			<button
				onClick={() => checkIn.mutate({ id: habit.id, undo: doneToday })}
				disabled={checkIn.isPending}
				className={cn(
					'mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium disabled:cursor-default',
					doneToday ? 'bg-success/15 text-success' : 'bg-surface-2 text-fg hover:bg-line'
				)}
			>
				<Check size={16} />
				{checkInLabel}
			</button>
			<Modal
				open={confirmOpen}
				onClose={() => setConfirmOpen(false)}
				title="Delete habit?"
				size="sm"
				footer={
					<>
						<Button variant="ghost" onClick={() => setConfirmOpen(false)}>
							Cancel
						</Button>
						<Button variant="danger" onClick={onDelete} loading={remove.isPending}>
							<Trash2 size={15} /> Delete
						</Button>
					</>
				}
			>
				<p className="text-muted text-sm">
					This will permanently delete <span className="text-fg font-medium">{habit.name}</span> and
					all its check-in history.
				</p>
			</Modal>
		</Card>
	);
}

function HabitsView() {
	const { setPage, search, setSearch, ordering, setOrdering, filters, setFilter, queryParams } =
		useListControls({ defaultOrdering: 'name' });
	const { data, isLoading } = habitsApi.useList({
		...queryParams,
		...(filters.frequency ? { frequency: filters.frequency } : {}),
		...(filters.is_active === 'true'
			? { is_active: true }
			: filters.is_active === 'false'
				? { is_active: false }
				: {})
	});
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState(null);
	const habits = data?.results || [];
	const openCreate = () => {
		setEditing(null);
		setOpen(true);
	};
	const openEdit = (habit) => {
		setEditing(habit);
		setOpen(true);
	};
	return (
		<>
			<PageHeader
				title="Habits"
				icon={Repeat}
				description="Momentum rewards consistency."
				actions={
					<Button onClick={openCreate}>
						<Plus size={16} /> New habit
					</Button>
				}
			/>
			<ListToolbar
				search={search}
				onSearchChange={setSearch}
				searchPlaceholder="Search habits…"
				ordering={ordering}
				onOrderingChange={setOrdering}
				sortOptions={[
					{ value: 'name', label: 'Name (A–Z)' },
					{ value: '-name', label: 'Name (Z–A)' },
					{ value: '-created_at', label: 'Newest first' }
				]}
				filters={[
					{
						key: 'frequency',
						label: 'Frequency',
						value: filters.frequency || '',
						onChange: (v) => setFilter('frequency', v),
						options: [
							{ value: '', label: 'All frequencies' },
							{ value: 'daily', label: 'Daily' },
							{ value: 'eod', label: 'Every other day' },
							{ value: 'biweekly', label: '2× per week' },
							{ value: 'weekly', label: 'Weekly' }
						]
					},
					{
						key: 'is_active',
						label: 'Status',
						value: filters.is_active || '',
						onChange: (v) => setFilter('is_active', v),
						options: [
							{ value: '', label: 'All habits' },
							{ value: 'true', label: 'Active only' },
							{ value: 'false', label: 'Inactive only' }
						]
					}
				]}
			/>
			{isLoading ? (
				<LoadingScreen />
			) : habits.length === 0 ? (
				<EmptyState
					icon={Repeat}
					title="No habits yet"
					action={
						<Button onClick={openCreate}>
							<Plus size={16} /> New habit
						</Button>
					}
				/>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{habits.map((h) => (
						<HabitCard key={h.id} habit={h} onEdit={openEdit} />
					))}
				</div>
			)}
			<Pagination
				page={data?.page ?? 1}
				totalPages={data?.total_pages ?? 1}
				count={data?.count ?? 0}
				pageSize={queryParams.page_size}
				onPageChange={setPage}
			/>
			<HabitFormModal
				key={`${editing?.id ?? 'new'}-${open}`}
				open={open}
				onClose={() => setOpen(false)}
				habit={editing}
			/>
		</>
	);
}

function NotesView() {
	const { setPage, search, setSearch, ordering, setOrdering, filters, setFilter, queryParams } =
		useListControls({ defaultOrdering: '-is_pinned,-updated_at' });
	const { data: projectData } = projectsApi.useList({ page_size: 100 });
	const projects = projectData?.results || [];
	const { data, isLoading } = notesApi.useList({
		...queryParams,
		...(filters.project ? { project: filters.project } : {}),
		...(filters.is_pinned === 'true'
			? { is_pinned: true }
			: filters.is_pinned === 'false'
				? { is_pinned: false }
				: {})
	});
	const create = notesApi.useCreate();
	const update = notesApi.useUpdate();
	const remove = notesApi.useRemove();
	const [editing, setEditing] = useState(null);
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(NOTE_EMPTY);
	const notes = data?.results || [];
	const startNew = () => {
		setEditing(null);
		setForm(NOTE_EMPTY);
		setOpen(true);
	};
	const startEdit = (note) => {
		setEditing(note);
		setForm({ title: note.title, content: note.content });
		setOpen(true);
	};
	const submit = async (e) => {
		e.preventDefault();
		if (editing) await update.mutateAsync({ id: editing.id, ...form });
		else await create.mutateAsync(form);
		setOpen(false);
	};
	return (
		<>
			<PageHeader
				title="Notes"
				icon={StickyNote}
				description="Capture ideas."
				actions={
					<Button onClick={startNew}>
						<Plus size={16} /> New note
					</Button>
				}
			/>
			<ListToolbar
				search={search}
				onSearchChange={setSearch}
				searchPlaceholder="Search notes…"
				ordering={ordering}
				onOrderingChange={setOrdering}
				sortOptions={[
					{ value: '-is_pinned,-updated_at', label: 'Pinned first' },
					{ value: '-updated_at', label: 'Recently updated' },
					{ value: 'title', label: 'Title (A–Z)' }
				]}
				filters={[
					{
						key: 'project',
						label: 'Project',
						value: filters.project || '',
						onChange: (v) => setFilter('project', v),
						options: [
							{ value: '', label: 'All projects' },
							...projects.map((p) => ({ value: String(p.id), label: p.name }))
						]
					},
					{
						key: 'is_pinned',
						label: 'Pinned',
						value: filters.is_pinned || '',
						onChange: (v) => setFilter('is_pinned', v),
						options: [
							{ value: '', label: 'All notes' },
							{ value: 'true', label: 'Pinned only' },
							{ value: 'false', label: 'Unpinned only' }
						]
					}
				]}
			/>
			{isLoading ? (
				<LoadingScreen />
			) : notes.length === 0 ? (
				<EmptyState
					icon={StickyNote}
					title="No notes yet"
					action={
						<Button onClick={startNew}>
							<Plus size={16} /> New note
						</Button>
					}
				/>
			) : (
				<div className="columns-1 gap-4 sm:columns-2 lg:columns-3 [&>*]:mb-4">
					{notes.map((note) => (
						<Card
							as={motion.div}
							layout
							key={note.id}
							className="hover:border-primary/40 cursor-pointer break-inside-avoid p-4"
							onClick={() => startEdit(note)}
						>
							<div className="flex items-start justify-between gap-2">
								<h3 className="text-fg font-semibold">{note.title}</h3>
								<div className="flex shrink-0 gap-1">
									<button
										onClick={(e) => {
											e.stopPropagation();
											update.mutate({ id: note.id, is_pinned: !note.is_pinned });
										}}
										className={cn('cursor-pointer', note.is_pinned ? 'text-warning' : 'text-muted')}
									>
										<Pin size={15} className={note.is_pinned ? 'fill-warning' : ''} />
									</button>
									<button
										onClick={(e) => {
											e.stopPropagation();
											remove.mutate(note.id);
										}}
										className="text-muted hover:text-danger cursor-pointer"
									>
										<Trash2 size={15} />
									</button>
								</div>
							</div>
							{note.content && (
								<p className="text-muted mt-2 line-clamp-6 text-sm whitespace-pre-wrap">
									{note.content}
								</p>
							)}
							<div className="text-muted mt-3 flex items-center gap-2 text-xs">
								{note.project_name && (
									<span className="bg-surface-2 rounded-sm px-2 py-0.5">{note.project_name}</span>
								)}
								<span>{fromNow(note.updated_at)}</span>
							</div>
						</Card>
					))}
				</div>
			)}
			<Pagination
				page={data?.page ?? 1}
				totalPages={data?.total_pages ?? 1}
				count={data?.count ?? 0}
				pageSize={queryParams.page_size}
				onPageChange={setPage}
			/>
			<Modal
				open={open}
				onClose={() => setOpen(false)}
				title={editing ? 'Edit note' : 'New note'}
				size="lg"
				footer={
					<>
						<Button variant="ghost" onClick={() => setOpen(false)}>
							Cancel
						</Button>
						<Button form="note-form" type="submit" loading={create.isPending || update.isPending}>
							Save
						</Button>
					</>
				}
			>
				<form id="note-form" onSubmit={submit} className="space-y-4">
					<Input
						label="Title"
						value={form.title}
						onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
						required
						autoFocus
					/>
					<Textarea
						label="Content"
						rows={10}
						value={form.content}
						onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
					/>
				</form>
			</Modal>
		</>
	);
}

function NotificationsView() {
	const navigate = useNavigate();
	const { setPage, search, setSearch, ordering, setOrdering, filters, setFilter, queryParams } =
		useListControls({ defaultOrdering: '-created_at' });
	const { data, isLoading } = notificationsApi.useList({
		...queryParams,
		...(filters.is_read === 'true'
			? { is_read: true }
			: filters.is_read === 'false'
				? { is_read: false }
				: {}),
		...(filters.level ? { level: filters.level } : {})
	});
	const markAll = useMarkAllRead();
	const markRead = useMarkRead();
	const items = data?.results || [];
	const hasUnread = items.some((n) => !n.is_read);
	const onClick = (n) => {
		if (!n.is_read) markRead.mutate(n.id);
		if (n.link) navigate(n.link);
	};
	return (
		<>
			<PageHeader
				title="Notifications"
				icon={Bell}
				actions={
					hasUnread && (
						<Button
							variant="secondary"
							onClick={() => markAll.mutate()}
							loading={markAll.isPending}
						>
							<CheckCheck size={16} /> Mark all read
						</Button>
					)
				}
			/>
			<ListToolbar
				search={search}
				onSearchChange={setSearch}
				searchPlaceholder="Search notifications…"
				ordering={ordering}
				onOrderingChange={setOrdering}
				sortOptions={[
					{ value: '-created_at', label: 'Newest first' },
					{ value: 'created_at', label: 'Oldest first' }
				]}
				filters={[
					{
						key: 'is_read',
						label: 'Read status',
						value: filters.is_read || '',
						onChange: (v) => setFilter('is_read', v),
						options: [
							{ value: '', label: 'All' },
							{ value: 'false', label: 'Unread only' },
							{ value: 'true', label: 'Read only' }
						]
					},
					{
						key: 'level',
						label: 'Level',
						value: filters.level || '',
						onChange: (v) => setFilter('level', v),
						options: [
							{ value: '', label: 'All levels' },
							{ value: 'info', label: 'Info' },
							{ value: 'success', label: 'Success' },
							{ value: 'warning', label: 'Warning' },
							{ value: 'insight', label: 'Insight' }
						]
					}
				]}
			/>
			{isLoading ? (
				<LoadingScreen />
			) : items.length === 0 ? (
				<EmptyState icon={Bell} title="You're all caught up" />
			) : (
				<div className="space-y-2">
					{items.map((n) => {
						const meta = LEVEL_META[n.level] || LEVEL_META.info;
						const Icon = meta.icon;
						return (
							<motion.button
								key={n.id}
								layout
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								onClick={() => onClick(n)}
								className={cn(
									'flex w-full cursor-pointer items-start gap-3 rounded-md border p-4 text-left',
									n.is_read ? 'border-line bg-surface' : 'border-primary/30 bg-primary/5'
								)}
							>
								<span
									className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm"
									style={{
										background: `color-mix(in srgb, ${meta.tone} 18%, transparent)`,
										color: meta.tone
									}}
								>
									<Icon size={17} />
								</span>
								<div className="min-w-0 flex-1">
									<p className="text-fg font-medium">{n.title}</p>
									{n.body && <p className="text-muted text-sm">{n.body}</p>}
									<p className="text-muted mt-1 text-xs">{fromNow(n.created_at)}</p>
								</div>
								{!n.is_read && <span className="bg-primary mt-2 h-2 w-2 shrink-0 rounded-full" />}
							</motion.button>
						);
					})}
				</div>
			)}
			<Pagination
				page={data?.page ?? 1}
				totalPages={data?.total_pages ?? 1}
				count={data?.count ?? 0}
				pageSize={queryParams.page_size}
				onPageChange={setPage}
			/>
		</>
	);
}

export function WorkspacePage() {
	const kind = KINDS[useLocation().pathname] || 'notes';
	if (kind === 'habits') return <HabitsView />;
	if (kind === 'notifications') return <NotificationsView />;
	return <NotesView />;
}

export default WorkspacePage;
