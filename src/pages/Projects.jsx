import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, FolderKanban, Pencil, Plus, Star } from 'lucide-react';
import {
	Badge,
	Button,
	Card,
	CardBody,
	CardHeader,
	EmptyState,
	Input,
	ListToolbar,
	LoadingScreen,
	Modal,
	Pagination,
	ProgressRing,
	Select,
	Skeleton,
	STATUS_TONE,
	Textarea
} from '../components/ui';
import { PageHeader } from '../components/layout/PageHeader';
import { projectsApi, tasksApi, useSetTaskStatus } from '../lib/resources';
import { useListControls } from '../hooks/useListControls';
import { TaskDetailModal, TaskRow } from './Tasks';

const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

function ProjectFormModal({ open, onClose, project }) {
	const [form, setForm] = useState(() => ({
		name: project?.name || '',
		description: project?.description || '',
		color: project?.color || COLORS[0],
		status: project?.status || 'active',
		due_date: project?.due_date || ''
	}));
	const create = projectsApi.useCreate();
	const update = projectsApi.useUpdate();
	const isEdit = Boolean(project);
	const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
	const submit = async (e) => {
		e.preventDefault();
		const payload = { ...form, due_date: form.due_date || null };
		if (isEdit) await update.mutateAsync({ id: project.id, ...payload });
		else await create.mutateAsync(payload);
		onClose();
	};
	return (
		<Modal
			open={open}
			onClose={onClose}
			title={isEdit ? 'Edit project' : 'New project'}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button form="project-form" type="submit" loading={create.isPending || update.isPending}>
						{isEdit ? 'Save' : 'Create'}
					</Button>
				</>
			}
		>
			<form id="project-form" onSubmit={submit} className="space-y-4">
				<Input label="Name" value={form.name} onChange={set('name')} required autoFocus />
				<Textarea
					label="Description"
					rows={3}
					value={form.description}
					onChange={set('description')}
				/>
				<div className="grid grid-cols-2 gap-3">
					<Select label="Status" value={form.status} onChange={set('status')}>
						<option value="active">Active</option>
						<option value="on_hold">On hold</option>
						<option value="completed">Completed</option>
						<option value="archived">Archived</option>
					</Select>
					<Input label="Due date" type="date" value={form.due_date} onChange={set('due_date')} />
				</div>
				<div className="flex gap-2">
					{COLORS.map((c) => (
						<button
							key={c}
							type="button"
							onClick={() => setForm((f) => ({ ...f, color: c }))}
							className="h-8 w-8 cursor-pointer rounded-full"
							style={{
								background: c,
								outline: form.color === c ? `2px solid ${c}` : 'none',
								outlineOffset: 2
							}}
						/>
					))}
				</div>
			</form>
		</Modal>
	);
}

function ProjectCard({ project }) {
	const h = project.health || {};
	const confTone =
		(h.confidence ?? 0) >= 66 ? 'success' : (h.confidence ?? 0) >= 40 ? 'warning' : 'danger';
	return (
		<Card as={motion.div} whileHover={{ y: -3 }} className="overflow-hidden">
			<div className="h-1.5" style={{ background: project.color }} />
			<Link to={`/projects/${project.id}`} className="block p-5">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<h3 className="text-fg truncate font-semibold">{project.name}</h3>
						<p className="text-muted mt-0.5 line-clamp-2 text-sm">
							{project.description || 'No description'}
						</p>
					</div>
					{project.is_favorite && <Star size={16} className="fill-warning text-warning shrink-0" />}
				</div>
				<div className="mt-4 flex items-center gap-4">
					<ProgressRing value={h.progress ?? 0} size={64} tone="primary" />
					<div className="flex-1 space-y-1.5 text-sm">
						<div className="flex justify-between">
							<span className="text-muted">Momentum</span>
							<span className="font-medium">{Math.round(h.momentum ?? 0)}</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted">Confidence</span>
							<span className="font-medium" style={{ color: `var(--${confTone})` }}>
								{Math.round(h.confidence ?? 0)}%
							</span>
						</div>
						<div className="flex justify-between">
							<span className="text-muted">ETA</span>
							<span className="font-medium">{h.eta_days != null ? `${h.eta_days}d` : '—'}</span>
						</div>
					</div>
				</div>
				<div className="mt-4 flex items-center justify-between">
					<Badge tone={STATUS_TONE[project.status]}>{project.status.replace('_', ' ')}</Badge>
					<span className="text-muted text-xs">
						{h.open_tasks ?? 0}/{h.total_tasks ?? 0} open
					</span>
				</div>
			</Link>
		</Card>
	);
}

const PROJECT_SORT = [
	{ value: '-created_at', label: 'Newest first' },
	{ value: 'name', label: 'Name (A–Z)' },
	{ value: '-name', label: 'Name (Z–A)' },
	{ value: 'due_date', label: 'Due date (soonest)' },
	{ value: '-due_date', label: 'Due date (latest)' }
];

export function ProjectsPage() {
	const [open, setOpen] = useState(false);
	const { setPage, search, setSearch, ordering, setOrdering, filters, setFilter, queryParams } =
		useListControls({ defaultOrdering: '-created_at' });
	const { data, isLoading } = projectsApi.useList({
		...queryParams,
		...(filters.status ? { status: filters.status } : {}),
		...(filters.is_favorite === 'true'
			? { is_favorite: true }
			: filters.is_favorite === 'false'
				? { is_favorite: false }
				: {})
	});
	const projects = data?.results || [];
	return (
		<div>
			<PageHeader
				title="Projects"
				icon={FolderKanban}
				description="Health metrics update as you work."
				actions={
					<Button onClick={() => setOpen(true)}>
						<Plus size={16} /> New project
					</Button>
				}
			/>
			<ListToolbar
				search={search}
				onSearchChange={setSearch}
				searchPlaceholder="Search projects…"
				ordering={ordering}
				onOrderingChange={setOrdering}
				sortOptions={PROJECT_SORT}
				filters={[
					{
						key: 'status',
						label: 'Status',
						value: filters.status || '',
						onChange: (v) => setFilter('status', v),
						options: [
							{ value: '', label: 'All statuses' },
							{ value: 'active', label: 'Active' },
							{ value: 'on_hold', label: 'On hold' },
							{ value: 'completed', label: 'Completed' },
							{ value: 'archived', label: 'Archived' }
						]
					},
					{
						key: 'is_favorite',
						label: 'Favorite',
						value: filters.is_favorite || '',
						onChange: (v) => setFilter('is_favorite', v),
						options: [
							{ value: '', label: 'All projects' },
							{ value: 'true', label: 'Favorites only' },
							{ value: 'false', label: 'Non-favorites' }
						]
					}
				]}
			/>
			{isLoading ? (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-52" />
					))}
				</div>
			) : projects.length === 0 ? (
				<EmptyState
					icon={FolderKanban}
					title="No projects yet"
					action={
						<Button onClick={() => setOpen(true)}>
							<Plus size={16} /> New project
						</Button>
					}
				/>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{projects.map((p) => (
						<ProjectCard key={p.id} project={p} />
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
			<ProjectFormModal key={open ? 'open' : 'closed'} open={open} onClose={() => setOpen(false)} />
		</div>
	);
}

export function ProjectDetailPage() {
	const { id } = useParams();
	const { data: project, isLoading } = projectsApi.useDetail(id);
	const { data: taskData } = tasksApi.useList({ project: id, page_size: 100 });
	const setStatus = useSetTaskStatus();
	const [editOpen, setEditOpen] = useState(false);
	const [detail, setDetail] = useState(null);
	if (isLoading || !project) return <LoadingScreen />;
	const h = project.health || {};
	const tasks = taskData?.results || [];
	const liveDetail = detail && tasks.find((t) => t.id === detail.id);
	const facets = [
		{ label: 'Progress', value: `${Math.round(h.progress ?? 0)}%` },
		{ label: 'Momentum', value: Math.round(h.momentum ?? 0) },
		{ label: 'Confidence', value: `${Math.round(h.confidence ?? 0)}%` },
		{ label: 'Est. completion', value: h.eta_days != null ? `${h.eta_days} days` : '—' }
	];
	return (
		<div>
			<Link
				to="/projects"
				className="text-muted hover:text-fg mb-4 inline-flex items-center gap-1 text-sm"
			>
				<ArrowLeft size={15} /> Projects
			</Link>
			<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<span className="h-10 w-2 rounded-full" style={{ background: project.color }} />
					<div>
						<h1 className="text-fg text-2xl font-bold">{project.name}</h1>
						<div className="mt-1 flex items-center gap-2">
							<Badge tone={STATUS_TONE[project.status]}>{project.status.replace('_', ' ')}</Badge>
							{project.due_date && (
								<span className="text-muted text-sm">Due {project.due_date}</span>
							)}
						</div>
					</div>
				</div>
				<Button variant="secondary" onClick={() => setEditOpen(true)}>
					<Pencil size={15} /> Edit
				</Button>
			</div>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<Card>
					<CardHeader title="Project health" />
					<CardBody className="flex items-center gap-5">
						<ProgressRing value={h.progress ?? 0} size={96} stroke={9} />
						<div className="flex-1 space-y-2">
							{facets.map((f) => (
								<div key={f.label} className="flex justify-between text-sm">
									<span className="text-muted">{f.label}</span>
									<span className="font-medium">{f.value}</span>
								</div>
							))}
						</div>
					</CardBody>
				</Card>
				<Card className="lg:col-span-2">
					<CardHeader title={`Tasks (${tasks.length})`} subtitle={project.description} />
					<CardBody className="space-y-2">
						{tasks.length === 0 && (
							<p className="text-muted text-sm">No tasks in this project yet.</p>
						)}
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
					</CardBody>
				</Card>
			</div>
			<ProjectFormModal
				key={`${project.id}-${editOpen}`}
				open={editOpen}
				onClose={() => setEditOpen(false)}
				project={project}
			/>
			<TaskDetailModal
				open={Boolean(liveDetail)}
				task={liveDetail}
				onClose={() => setDetail(null)}
				onEdit={() => setDetail(null)}
			/>
		</div>
	);
}
