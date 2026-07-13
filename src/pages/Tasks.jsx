import { useMemo, useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
	Check,
	CheckSquare,
	GitBranch,
	ListFilter,
	Plus,
	Sparkles,
	Trash2,
	Pencil
} from 'lucide-react';
import { cn, formatDue, formatDurationSeconds } from '../lib/format';
import { PageHeader } from '../components/layout/PageHeader';
import {
	Badge,
	Button,
	EmptyState,
	Input,
	ListToolbar,
	LoadingScreen,
	Modal,
	Pagination,
	ProgressBar,
	Select,
	Textarea
} from '../components/ui';
import {
	projectsApi,
	subtasksApi,
	tasksApi,
	useDecomposeTask,
	usePrioritizedTasks,
	useSetTaskStatus
} from '../lib/resources';
import { paginateClient, useListControls } from '../hooks/useListControls';

const FILTERS = [
	{ key: 'all', label: 'All' },
	{ key: 'todo', label: 'To do' },
	{ key: 'in_progress', label: 'In progress' },
	{ key: 'blocked', label: 'Blocked' },
	{ key: 'done', label: 'Done' }
];
const FACTOR_LABELS = {
	importance: 'Importance',
	urgency: 'Urgency',
	deadline: 'Deadline',
	effort: 'Effort',
	completion_history: 'History'
};

function priorityTone(score = 0) {
	if (score > 70) return { color: 'var(--danger)', label: 'High' };
	if (score > 45) return { color: 'var(--warning)', label: 'Medium' };
	return { color: 'var(--success)', label: 'Low' };
}

export function TaskRow({ task, onToggle, onOpen }) {
	const done = task.status === 'done';
	const score = task.priority?.score ?? 0;
	const tone = priorityTone(score);
	const due = formatDue(task.due_date);
	const overdue = task.due_date && !done && new Date(task.due_date) < new Date();
	return (
		<motion.div
			layout
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="border-line bg-surface hover:border-primary/40 flex items-center gap-3 rounded-sm border p-3"
		>
			<button
				onClick={() => onToggle(task)}
				className={cn(
					'flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border',
					done ? 'border-success bg-success text-white' : 'border-line hover:border-primary'
				)}
			>
				{done && <Check size={14} />}
			</button>
			<button onClick={() => onOpen(task)} className="min-w-0 flex-1 cursor-pointer text-left">
				<p
					className={cn('text-fg truncate text-sm font-medium', done && 'text-muted line-through')}
				>
					{task.title}
				</p>
				<div className="text-muted mt-0.5 flex items-center gap-2 text-xs">
					{task.project_name && <span className="truncate">{task.project_name}</span>}
					{due && <span className={cn(overdue && 'text-danger font-medium')}>· {due}</span>}
					{task.subtask_progress != null && (
						<span className="inline-flex items-center gap-1">
							<GitBranch size={11} /> {Math.round(task.subtask_progress)}%
						</span>
					)}
					{(task.focus_seconds ?? 0) > 0 && (
						<span>· {formatDurationSeconds(task.focus_seconds)} focused</span>
					)}
				</div>
				{task.subtask_progress != null && (
					<ProgressBar value={task.subtask_progress} className="mt-1.5" />
				)}
			</button>
			<div className="flex shrink-0 items-center gap-2">
				<span className="h-2 w-2 rounded-full" style={{ background: tone.color }} />
				<Badge tone="neutral">{Math.round(score)}</Badge>
			</div>
		</motion.div>
	);
}

export function TaskFormModal({ open, onClose, task }) {
	const [form, setForm] = useState(() => ({
		title: task?.title || '',
		description: task?.description || '',
		project: task?.project || '',
		importance: task?.importance ?? 3,
		urgency: task?.urgency ?? 3,
		estimated_minutes: task?.estimated_minutes ?? 30,
		due_date: task?.due_date ? task.due_date.slice(0, 16) : ''
	}));
	const { data: projectData } = projectsApi.useList({ page_size: 100 });
	const create = tasksApi.useCreate();
	const update = tasksApi.useUpdate();
	const isEdit = Boolean(task);
	const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
	const submit = async (e) => {
		e.preventDefault();
		const payload = {
			...form,
			project: form.project || null,
			due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
			importance: Number(form.importance),
			urgency: Number(form.urgency),
			estimated_minutes: Number(form.estimated_minutes)
		};
		if (isEdit) await update.mutateAsync({ id: task.id, ...payload });
		else await create.mutateAsync(payload);
		onClose();
	};
	const projects = projectData?.results || [];
	return (
		<Modal
			open={open}
			onClose={onClose}
			title={isEdit ? 'Edit task' : 'New task'}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button form="task-form" type="submit" loading={create.isPending || update.isPending}>
						{isEdit ? 'Save' : 'Create task'}
					</Button>
				</>
			}
		>
			<form id="task-form" onSubmit={submit} className="space-y-4">
				<Input label="Title" value={form.title} onChange={set('title')} required autoFocus />
				<Textarea
					label="Description"
					rows={3}
					value={form.description}
					onChange={set('description')}
				/>
				<div className="grid grid-cols-2 gap-3">
					<Select label="Project" value={form.project} onChange={set('project')}>
						<option value="">No project</option>
						{projects.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</Select>
					<Input
						label="Due"
						type="datetime-local"
						value={form.due_date}
						onChange={set('due_date')}
					/>
				</div>
				<div className="grid grid-cols-3 gap-3">
					<Select label="Importance" value={form.importance} onChange={set('importance')}>
						{[1, 2, 3, 4, 5].map((n) => (
							<option key={n} value={n}>
								{n}
							</option>
						))}
					</Select>
					<Select label="Urgency" value={form.urgency} onChange={set('urgency')}>
						{[1, 2, 3, 4, 5].map((n) => (
							<option key={n} value={n}>
								{n}
							</option>
						))}
					</Select>
					<Input
						label="Est. min"
						type="number"
						min={5}
						step={5}
						value={form.estimated_minutes}
						onChange={set('estimated_minutes')}
					/>
				</div>
			</form>
		</Modal>
	);
}

export function TaskDetailModal({ open, onClose, task, onEdit }) {
	const decompose = useDecomposeTask();
	const update = tasksApi.useUpdate();
	const remove = tasksApi.useRemove();
	const createSub = subtasksApi.useCreate();
	const updateSub = subtasksApi.useUpdate();
	const removeSub = subtasksApi.useRemove();
	const [newSub, setNewSub] = useState('');
	if (!task) return null;
	const factors = task.priority?.factors || {};
	return (
		<Modal
			open={open}
			onClose={onClose}
			title={task.title}
			size="lg"
			footer={
				<>
					<Button
						variant="danger"
						size="sm"
						onClick={async () => {
							await remove.mutateAsync(task.id);
							onClose();
						}}
						loading={remove.isPending}
					>
						<Trash2 size={15} /> Delete
					</Button>
					<Button variant="secondary" size="sm" onClick={() => onEdit(task)}>
						<Pencil size={15} /> Edit
					</Button>
				</>
			}
		>
			<div className="space-y-5">
				{task.description && <p className="text-muted text-sm">{task.description}</p>}
				<div className="flex flex-wrap items-center gap-3">
					<Select
						value={task.status}
						onChange={async (e) => update.mutateAsync({ id: task.id, status: e.target.value })}
						className="w-40"
					>
						<option value="todo">To do</option>
						<option value="in_progress">In progress</option>
						<option value="blocked">Blocked</option>
						<option value="done">Done</option>
					</Select>
					{task.project_name && <Badge tone="primary">{task.project_name}</Badge>}
					<Badge tone="neutral">{task.estimated_minutes}m est.</Badge>
					{(task.focus_seconds ?? 0) > 0 && (
						<Badge tone="success">{formatDurationSeconds(task.focus_seconds)} focused</Badge>
					)}
				</div>
				<div className="border-line rounded-md border p-4">
					<div className="mb-3 flex items-center justify-between">
						<span className="text-sm font-semibold">Priority score</span>
						<Badge tone="primary">{Math.round(task.priority?.score ?? 0)}/100</Badge>
					</div>
					<div className="space-y-2">
						{Object.entries(FACTOR_LABELS).map(([key, label]) => (
							<div key={key} className="flex items-center gap-3">
								<span className="text-muted w-24 text-xs">{label}</span>
								<ProgressBar value={(factors[key] || 0) * 100} className="flex-1" />
							</div>
						))}
					</div>
				</div>
				<div>
					<div className="mb-2 flex items-center justify-between">
						<span className="text-sm font-semibold">
							Subtasks {task.subtasks?.length ? `(${task.subtasks.length})` : ''}
						</span>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => decompose.mutate(task.id)}
							loading={decompose.isPending}
						>
							<Sparkles size={15} /> AI decompose
						</Button>
					</div>
					{task.subtask_progress != null && (
						<ProgressBar value={task.subtask_progress} tone="success" className="mb-3" showLabel />
					)}
					<div className="space-y-1.5">
						{(task.subtasks || []).map((sub) => (
							<div
								key={sub.id}
								className="bg-surface-2 flex items-center gap-2 rounded-md px-3 py-2"
							>
								<input
									type="checkbox"
									checked={sub.is_done}
									onChange={() => updateSub.mutate({ id: sub.id, is_done: !sub.is_done })}
									className="h-4 w-4 cursor-pointer accent-[var(--primary)]"
								/>
								<span
									className={`flex-1 text-sm ${sub.is_done ? 'text-muted line-through' : 'text-fg'}`}
								>
									{sub.title}
								</span>
								{sub.ai_generated && <Sparkles size={13} className="text-accent" />}
								<button
									onClick={() => removeSub.mutate(sub.id)}
									className="text-muted hover:text-danger cursor-pointer"
								>
									<Trash2 size={14} />
								</button>
							</div>
						))}
					</div>
					<form
						onSubmit={(e) => {
							e.preventDefault();
							if (!newSub.trim()) return;
							createSub.mutate({ task: task.id, title: newSub.trim() });
							setNewSub('');
						}}
						className="mt-2 flex gap-2"
					>
						<input
							value={newSub}
							onChange={(e) => setNewSub(e.target.value)}
							placeholder="Add a subtask…"
							className="border-line bg-surface focus:border-primary flex-1 rounded-md border px-3 py-2 text-sm outline-none"
						/>
						<Button size="sm" type="submit" variant="secondary">
							Add
						</Button>
					</form>
				</div>
			</div>
		</Modal>
	);
}

const TASK_SORT = [
	{ value: '-created_at', label: 'Newest first' },
	{ value: 'created_at', label: 'Oldest first' },
	{ value: 'due_date', label: 'Due date (soonest)' },
	{ value: '-due_date', label: 'Due date (latest)' },
	{ value: '-importance', label: 'Importance' },
	{ value: '-urgency', label: 'Urgency' }
];

function sortTasks(items, ordering) {
	if (!ordering) return items;
	const desc = ordering.startsWith('-');
	const field = desc ? ordering.slice(1) : ordering;
	return [...items].sort((a, b) => {
		const av = a[field] ?? '';
		const bv = b[field] ?? '';
		if (av < bv) return desc ? 1 : -1;
		if (av > bv) return desc ? -1 : 1;
		return 0;
	});
}

function filterPrioritizedTasks(items, { search, filters }) {
	let next = items;
	if (filters.project) {
		next = next.filter((t) => String(t.project) === String(filters.project));
	}
	if (filters.importance) {
		next = next.filter((t) => String(t.importance) === String(filters.importance));
	}
	if (search) {
		const q = search.toLowerCase();
		next = next.filter(
			(t) => t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
		);
	}
	return next;
}

export default function TasksPage() {
	const [filter, setFilter] = useState('all');
	const [byPriority, setByPriority] = useState(true);
	const [formOpen, setFormOpen] = useState(false);
	const [editing, setEditing] = useState(null);
	const [detail, setDetail] = useState(null);
	const {
		setPage,
		search,
		setSearch,
		ordering,
		setOrdering,
		filters,
		setFilter: setDomainFilter,
		queryParams
	} = useListControls({ defaultOrdering: '-created_at' });
	const usePrioritized = byPriority && filter !== 'done';
	const listQuery = tasksApi.useList(
		{
			...queryParams,
			...(filter !== 'all' && !usePrioritized ? { status: filter } : {}),
			...(filters.project ? { project: filters.project } : {}),
			...(filters.importance ? { importance: filters.importance } : {})
		},
		{ enabled: !usePrioritized }
	);
	const prioritizedQuery = usePrioritizedTasks();
	const { data: projectData } = projectsApi.useList({ page_size: 100 });
	const projects = projectData?.results || [];
	const setStatus = useSetTaskStatus();

	useEffect(() => {
		setPage(1);
	}, [filter, byPriority, setPage]);

	const pageData = useMemo(() => {
		if (!usePrioritized) return listQuery.data;
		let raw = prioritizedQuery.data || [];
		if (filter !== 'all') raw = raw.filter((t) => t.status === filter);
		raw = filterPrioritizedTasks(raw, {
			search: queryParams.search,
			filters
		});
		raw = sortTasks(raw, queryParams.ordering);
		return paginateClient(raw, queryParams.page, queryParams.page_size);
	}, [usePrioritized, listQuery.data, prioritizedQuery.data, filter, queryParams, filters]);

	const tasks = pageData?.results || [];
	const sourceLoading = usePrioritized ? prioritizedQuery.isLoading : listQuery.isLoading;
	const liveDetail = detail && tasks.find((t) => t.id === detail.id);
	return (
		<div>
			<PageHeader
				title="Tasks"
				icon={CheckSquare}
				description="Prioritized for you."
				actions={
					<Button
						onClick={() => {
							setEditing(null);
							setFormOpen(true);
						}}
					>
						<Plus size={16} /> New task
					</Button>
				}
			/>
			<div className="mb-4 flex flex-wrap items-center gap-2">
				<div className="flex flex-wrap gap-1.5">
					{FILTERS.map((f) => (
						<button
							key={f.key}
							onClick={() => setFilter(f.key)}
							className={cn(
								'cursor-pointer rounded-sm px-3 py-1.5 text-sm font-medium',
								filter === f.key
									? 'bg-primary text-primary-fg'
									: 'bg-surface-2 text-muted hover:text-fg'
							)}
						>
							{f.label}
						</button>
					))}
				</div>
				<button
					onClick={() => setByPriority((v) => !v)}
					className={cn(
						'ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium',
						byPriority ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-muted hover:text-fg'
					)}
				>
					{byPriority ? <Sparkles size={15} /> : <ListFilter size={15} />}
					{byPriority ? 'Smart order' : 'Default order'}
				</button>
			</div>
			<ListToolbar
				search={search}
				onSearchChange={setSearch}
				searchPlaceholder="Search tasks…"
				ordering={ordering}
				onOrderingChange={setOrdering}
				sortOptions={TASK_SORT}
				filters={[
					{
						key: 'project',
						label: 'Project',
						value: filters.project || '',
						onChange: (v) => setDomainFilter('project', v),
						options: [
							{ value: '', label: 'All projects' },
							...projects.map((p) => ({ value: String(p.id), label: p.name }))
						]
					},
					{
						key: 'importance',
						label: 'Importance',
						value: filters.importance || '',
						onChange: (v) => setDomainFilter('importance', v),
						options: [
							{ value: '', label: 'Any importance' },
							...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))
						]
					}
				]}
			/>
			{sourceLoading ? (
				<LoadingScreen />
			) : tasks.length === 0 ? (
				<EmptyState
					icon={CheckSquare}
					title="No tasks here"
					action={
						<Button onClick={() => setFormOpen(true)}>
							<Plus size={16} /> New task
						</Button>
					}
				/>
			) : (
				<div className="space-y-2">
					<AnimatePresence initial={false}>
						{tasks.map((task) => (
							<TaskRow
								key={task.id}
								task={task}
								onToggle={(t) =>
									setStatus.mutate({ id: t.id, status: t.status === 'done' ? 'todo' : 'done' })
								}
								onOpen={setDetail}
							/>
						))}
					</AnimatePresence>
				</div>
			)}
			<Pagination
				page={pageData?.page ?? 1}
				totalPages={pageData?.total_pages ?? 1}
				count={pageData?.count ?? 0}
				pageSize={queryParams.page_size}
				onPageChange={setPage}
			/>
			<TaskFormModal
				key={`${editing?.id ?? 'new'}-${formOpen}`}
				open={formOpen}
				onClose={() => setFormOpen(false)}
				task={editing}
			/>
			<TaskDetailModal
				open={Boolean(liveDetail)}
				task={liveDetail}
				onClose={() => setDetail(null)}
				onEdit={(t) => {
					setDetail(null);
					setEditing(t);
					setFormOpen(true);
				}}
			/>
		</div>
	);
}
