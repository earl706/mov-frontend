import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
	AlertTriangle,
	CalendarClock,
	CheckCircle2,
	CheckSquare,
	Flame,
	ListTodo,
	Repeat,
	RotateCcw,
	X
} from 'lucide-react';

import { CompactActivityTile } from '../components/analytics/ActivityHeatmap';
import { formatDate, formatDurationSeconds, minutesToHours } from '../lib/format';
import { useAuthStore } from '../stores/authStore';
import { PageHeader } from '../components/layout/PageHeader';
import {
	Badge,
	Card,
	CardBody,
	CardHeader,
	LoadingScreen,
	ProgressRing,
	StatCard
} from '../components/ui';
import {
	useDashboard,
	useFocusToday,
	usePatterns,
	usePrioritizedTasks,
	useSessionRecovery,
	useTimeline
} from '../lib/resources';

const container = {
	animate: { transition: { staggerChildren: 0.05 } }
};
const item = {
	initial: { opacity: 0, y: 10 },
	animate: { opacity: 1, y: 0 }
};

function SessionRecovery({ recovery }) {
	const [dismissed, setDismissed] = useState(false);
	const items = recovery?.items || [];
	if (dismissed || items.length === 0) return null;
	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0, height: 0 }}
				animate={{ opacity: 1, height: 'auto' }}
				exit={{ opacity: 0, height: 0 }}
				className="mb-4 overflow-hidden"
			>
				<div className="border-primary/30 bg-primary/8 flex flex-wrap items-center gap-3 rounded-2xl border p-4">
					<div className="text-primary flex items-center gap-2">
						<RotateCcw size={18} />
						<span className="text-sm font-semibold">Pick up where you left off</span>
					</div>
					<div className="flex flex-1 flex-wrap gap-2">
						{items.slice(0, 5).map((it) => (
							<span
								key={`${it.type}-${it.id}`}
								className="border-line bg-surface text-fg inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs"
							>
								<CheckSquare size={13} className="text-muted" />
								<span className="max-w-40 truncate">{it.title}</span>
							</span>
						))}
					</div>
					<button
						onClick={() => setDismissed(true)}
						className="text-muted hover:text-fg cursor-pointer rounded-lg p-1"
					>
						<X size={16} />
					</button>
				</div>
			</motion.div>
		</AnimatePresence>
	);
}

export default function DashboardPage() {
	const user = useAuthStore((s) => s.user);
	const { data: dash, isLoading } = useDashboard();
	const { data: focusToday } = useFocusToday();
	const { data: prioritized } = usePrioritizedTasks();
	const { data: patterns } = usePatterns();
	const { data: recovery } = useSessionRecovery();
	const { data: timelineData } = useTimeline(49);

	if (isLoading || !dash) return <LoadingScreen />;

	const c = dash.counts;
	const greeting = getGreeting();
	const topTasks = (prioritized || []).slice(0, 5);

	return (
		<div>
			<PageHeader
				title={`${greeting}, ${user?.full_name?.split(' ')[0] || 'there'}`}
				description={formatDate(new Date(), 'EEEE, MMMM d')}
			/>

			<SessionRecovery recovery={recovery} />

			<motion.div
				variants={container}
				initial="initial"
				animate="animate"
				className="grid h-full max-h-28 grid-cols-2 gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
			>
				<motion.div variants={item} className="h-full min-w-0">
					<StatCard icon={ListTodo} label="Open tasks" value={c.open_tasks} />
				</motion.div>
				<motion.div variants={item} className="h-full min-w-0">
					<StatCard
						icon={CalendarClock}
						label="Due today"
						value={c.due_today}
						trend={c.overdue ? 'down' : 'flat'}
					/>
				</motion.div>
				<motion.div variants={item} className="h-full min-w-0">
					<StatCard icon={CheckCircle2} label="Done this week" value={c.completed_this_week} />
				</motion.div>
				<motion.div variants={item} className="h-full min-w-0">
					<StatCard icon={Repeat} label="Active habits" value={c.habits} />
				</motion.div>
				<motion.div
					variants={item}
					className="col-span-2 flex h-full justify-center lg:col-span-1 lg:justify-start"
				>
					<Card className="flex h-full w-fit items-center justify-center p-1">
						<CompactActivityTile timeline={timelineData?.timeline || []} />
					</Card>
				</motion.div>
			</motion.div>

			<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<CardHeader
						title="Focus this week"
						subtitle={`${formatDurationSeconds(focusToday?.seconds ?? (focusToday?.minutes ?? 0) * 60)} today · goal ${minutesToHours(focusToday?.goal_minutes ?? 120)}`}
					/>
					<CardBody>
						<div className="h-44">
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart data={dash.focus_by_day}>
									<defs>
										<linearGradient id="focusFill" x1="0" y1="0" x2="0" y2="1">
											<stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
											<stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
										</linearGradient>
									</defs>
									<XAxis
										dataKey="date"
										tickFormatter={(d) => formatDate(d, 'EEE')}
										tick={{ fill: 'var(--muted)', fontSize: 12 }}
										axisLine={false}
										tickLine={false}
									/>
									<Tooltip content={<FocusTooltip />} />
									<Area
										type="monotone"
										dataKey="minutes"
										stroke="var(--primary)"
										strokeWidth={2}
										fill="url(#focusFill)"
									/>
								</AreaChart>
							</ResponsiveContainer>
						</div>
					</CardBody>
				</Card>

				<Card>
					<CardHeader title="Your momentum" subtitle="Rewards steady output" />
					<CardBody className="flex flex-col items-center gap-4">
						<ProgressRing value={dash.momentum} size={120} stroke={10} tone="primary" />
						<div className="grid w-full grid-cols-2 gap-2 text-center">
							<div className="bg-surface-2 rounded-xl p-3">
								<p className="text-fg text-lg font-semibold">{dash.consistency}</p>
								<p className="text-muted text-xs">Consistency</p>
							</div>
							<div className="bg-surface-2 rounded-xl p-3">
								<p className="text-fg text-lg font-semibold">
									{Math.round(dash.burnout_risk * 100)}%
								</p>
								<p className="text-muted text-xs">Burnout risk</p>
							</div>
						</div>
					</CardBody>
				</Card>
			</div>

			<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
				{/* Prioritized work */}
				<Card className="lg:col-span-2">
					<CardHeader
						title="What to work on next"
						subtitle="Ranked by your personalized priority"
						action={
							<Link to="/tasks" className="text-primary text-sm font-medium hover:underline">
								All tasks
							</Link>
						}
					/>
					<CardBody className="space-y-2">
						{topTasks.length === 0 && (
							<p className="text-muted text-sm">No open tasks. Enjoy the calm.</p>
						)}
						{topTasks.map((task) => (
							<Link
								key={task.id}
								to="/tasks"
								className="border-line hover:border-primary/40 flex items-center gap-3 rounded-xl border p-3 transition-colors"
							>
								<PriorityDot score={task.priority?.score} />
								<div className="min-w-0 flex-1">
									<p className="text-fg truncate text-sm font-medium">{task.title}</p>
									<p className="text-muted text-xs">{task.project_name || 'No project'}</p>
								</div>
								<Badge tone="primary">{Math.round(task.priority?.score ?? 0)}</Badge>
							</Link>
						))}
					</CardBody>
				</Card>

				{/* AI patterns */}
				<Card>
					<CardHeader title="Patterns" subtitle="Discovered in your activity" />
					<CardBody className="space-y-2">
						{(patterns?.patterns || []).slice(0, 4).map((p, i) => (
							<div key={i} className="bg-surface-2 flex gap-2 rounded-xl p-3">
								<Flame size={16} className="text-primary mt-0.5 shrink-0" />
								<p className="text-fg text-sm">{p.message}</p>
							</div>
						))}
						{!patterns?.patterns?.length && (
							<p className="text-muted text-sm">Keep working — patterns appear as data grows.</p>
						)}
						{c.overdue > 0 && (
							<div className="bg-danger/10 flex gap-2 rounded-xl p-3">
								<AlertTriangle size={16} className="text-danger mt-0.5 shrink-0" />
								<p className="text-danger text-sm">
									{c.overdue} task{c.overdue > 1 ? 's are' : ' is'} overdue.
								</p>
							</div>
						)}
					</CardBody>
				</Card>
			</div>
		</div>
	);
}

function getGreeting() {
	const h = new Date().getHours();
	if (h < 12) return 'Good morning';
	if (h < 18) return 'Good afternoon';
	return 'Good evening';
}

function PriorityDot({ score = 0 }) {
	const tone = score > 70 ? 'var(--danger)' : score > 45 ? 'var(--warning)' : 'var(--success)';
	return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tone }} />;
}

function FocusTooltip({ active, payload, label }) {
	if (!active || !payload?.length) return null;
	const seconds = payload[0].payload?.seconds ?? Math.round((payload[0].value || 0) * 60);
	return (
		<div className="border-line bg-surface rounded-lg border px-3 py-2 text-xs shadow-lg">
			<p className="text-fg font-medium">{formatDate(label, 'EEE, MMM d')}</p>
			<p className="text-muted">{formatDurationSeconds(seconds)} focused</p>
		</div>
	);
}
