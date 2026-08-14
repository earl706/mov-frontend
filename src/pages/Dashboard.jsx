import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis
} from 'recharts';
import {
	Activity,
	AlertTriangle,
	Check,
	Dumbbell,
	Flame,
	LayoutDashboard,
	Lightbulb,
	Play,
	Scale,
	Timer
} from 'lucide-react';

import { CompactActivityTile } from '../components/analytics/ActivityHeatmap';
import { PageHeader } from '../components/layout/PageHeader';
import {
	Badge,
	Button,
	Card,
	CardBody,
	CardHeader,
	LoadingScreen,
	ProgressRing,
	StatCard
} from '../components/ui';
import { formatDate } from '../lib/format';
import { formatWeight } from '../lib/weightFormat';
import {
	useDashboard,
	useStartSession,
	useTrainingHeatmap,
	useTrainingInsights
} from '../lib/resources';
import { useAuthStore } from '../stores/authStore';

const container = { animate: { transition: { staggerChildren: 0.05 } } };
const item = { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } };

const GROUP_LABELS = {
	push: 'Push',
	pull: 'Pull',
	legs: 'Legs',
	core: 'Core',
	full_body: 'Full body'
};

function greeting() {
	const hour = new Date().getHours();
	if (hour < 12) return 'Good morning';
	if (hour < 18) return 'Good afternoon';
	return 'Good evening';
}

/** The one thing the dashboard is really for: did you train today, and what's next. */
function TodayCard({ training, activeSession, suggested }) {
	const navigate = useNavigate();
	const start = useStartSession();
	const goalPct = training.weekly_goal
		? Math.min(100, Math.round((training.sessions_this_week / training.weekly_goal) * 100))
		: 0;

	return (
		<Card className={training.trained_today ? 'border-success/40' : 'border-primary/40'}>
			<CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
				<ProgressRing value={goalPct} size={84} />
				<div className="min-w-0 flex-1">
					{training.trained_today ? (
						<Badge tone="success">
							<Check size={12} />
							Worked out today
						</Badge>
					) : (
						<Badge tone="primary">Not trained yet today</Badge>
					)}
					<p className="text-fg mt-1.5 text-base font-semibold">
						{training.sessions_this_week} of {training.weekly_goal} sessions this week
					</p>
					<p className="text-muted text-xs">
						{training.sets_this_week} sets · {Math.round(training.volume_this_week_kg)} kg ·{' '}
						{Math.round(training.calories_this_week)} kcal
					</p>
				</div>
				<div className="flex shrink-0 flex-col items-stretch gap-2">
					{activeSession ? (
						<Button onClick={() => navigate('/train')}>
							<Timer size={16} />
							Resume workout
						</Button>
					) : suggested ? (
						<Button
							onClick={() =>
								start.mutate({ template: suggested.id }, { onSuccess: () => navigate('/train') })
							}
							loading={start.isPending}
						>
							<Play size={16} />
							Start {suggested.name}
						</Button>
					) : (
						<Button onClick={() => navigate('/routines')}>Build a routine</Button>
					)}
					<Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
						View history
					</Button>
				</div>
			</CardBody>
		</Card>
	);
}

function ReadinessCard({ adherence, consistency, risk }) {
	const rows = [
		{ label: 'Adherence', value: adherence, hint: 'Sessions vs weekly goal' },
		{ label: 'Consistency', value: consistency, hint: 'Evenly spread training' },
		{ label: 'Overreaching risk', value: risk, hint: 'Volume and effort vs rest', invert: true }
	];
	return (
		<Card>
			<CardHeader title="Training signals" subtitle="Last 4 weeks" />
			<CardBody className="space-y-3">
				{rows.map((row) => {
					const pct = Math.round((row.value ?? 0) * 100);
					const good = row.invert ? pct < 60 : pct >= 60;
					return (
						<div key={row.label}>
							<div className="mb-1 flex items-center justify-between text-xs">
								<span className="text-fg font-medium">{row.label}</span>
								<span className={good ? 'text-success' : 'text-warning'}>{pct}%</span>
							</div>
							<div className="bg-surface-2 h-1.5 w-full overflow-hidden rounded-full">
								<div
									className={good ? 'bg-success h-full' : 'bg-warning h-full'}
									style={{ width: `${pct}%` }}
								/>
							</div>
							<p className="text-muted mt-0.5 text-xs">{row.hint}</p>
						</div>
					);
				})}
			</CardBody>
		</Card>
	);
}

export default function Dashboard() {
	const navigate = useNavigate();
	const user = useAuthStore((s) => s.user);
	const { data, isLoading } = useDashboard();
	const { data: insights } = useTrainingInsights();
	const { data: heatmap } = useTrainingHeatmap(84);

	if (isLoading || !data) return <LoadingScreen />;

	const { training, weight, body, muscle_groups: groups } = data;
	const firstName = (user?.full_name || '').split(' ')[0];

	return (
		<div>
			<PageHeader
				title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
				icon={LayoutDashboard}
				description={
					training.last_session
						? `Last workout ${formatDate(training.last_session.date, 'EEE, MMM d')}`
						: 'No workouts logged yet — start with a routine.'
				}
			/>

			<motion.div variants={container} initial="initial" animate="animate" className="space-y-4">
				<motion.div variants={item}>
					<TodayCard
						training={training}
						activeSession={data.active_session}
						suggested={data.suggested_routine}
					/>
				</motion.div>

				<motion.div variants={item} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
					<StatCard
						icon={Flame}
						label="Training streak"
						value={training.streak_days}
						sublabel={`Best ${training.longest_streak_days} days`}
					/>
					<StatCard
						icon={Dumbbell}
						label="Total workouts"
						value={training.total_sessions}
						sublabel={`${training.sets_this_week} sets this week`}
						onClick={() => navigate('/history')}
					/>
					<StatCard
						icon={Activity}
						label="Weekly volume"
						value={`${Math.round(training.volume_this_week_kg)} kg`}
						sublabel={
							training.volume_change_pct != null
								? `${training.volume_change_pct}% vs last week`
								: 'No comparison yet'
						}
						trend={
							training.volume_change_pct > 0
								? 'up'
								: training.volume_change_pct < 0
									? 'down'
									: 'flat'
						}
					/>
					<StatCard
						icon={Scale}
						label="Body weight"
						value={weight.current != null ? formatWeight(weight.current, weight.unit) : '—'}
						sublabel={
							body.body_fat_pct != null
								? `${body.body_fat_pct}% body fat`
								: weight.logged_today
									? 'Logged today'
									: 'Not logged today'
						}
						onClick={() => navigate('/body')}
					/>
				</motion.div>

				<motion.div variants={item} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
					<Card className="lg:col-span-2">
						<CardHeader title="Volume & sets" subtitle="Last 14 days" />
						<CardBody>
							<div className="h-52">
								<ResponsiveContainer width="100%" height="100%">
									<AreaChart data={training.by_day}>
										<defs>
											<linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
												<stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
												<stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
											</linearGradient>
										</defs>
										<XAxis
											dataKey="date"
											tickFormatter={(d) => formatDate(d, 'MMM d')}
											tick={{ fill: 'var(--muted)', fontSize: 11 }}
											axisLine={false}
											tickLine={false}
										/>
										<YAxis
											tick={{ fill: 'var(--muted)', fontSize: 11 }}
											axisLine={false}
											tickLine={false}
										/>
										<Tooltip
											labelFormatter={(d) => formatDate(d, 'EEE, MMM d')}
											contentStyle={{
												background: 'var(--surface)',
												border: '1px solid var(--line)',
												borderRadius: 8,
												fontSize: 12
											}}
										/>
										<Area
											type="monotone"
											dataKey="volume_kg"
											name="Volume (kg)"
											stroke="var(--primary)"
											strokeWidth={2}
											fill="url(#volumeFill)"
										/>
									</AreaChart>
								</ResponsiveContainer>
							</div>
						</CardBody>
					</Card>

					<Card>
						<CardHeader title="Training days" subtitle="Last 12 weeks" />
						<CardBody className="flex justify-center">
							<CompactActivityTile timeline={heatmap?.timeline || []} weeks={12} />
						</CardBody>
					</Card>
				</motion.div>

				<motion.div variants={item} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
					<Card>
						<CardHeader title="Muscle balance" subtitle="Sets by group, last 4 weeks" />
						<CardBody>
							{groups?.length ? (
								<div className="h-44">
									<ResponsiveContainer width="100%" height="100%">
										<BarChart data={groups} layout="vertical">
											<XAxis type="number" hide />
											<YAxis
												type="category"
												dataKey="group"
												width={70}
												tickFormatter={(g) => GROUP_LABELS[g] || g}
												tick={{ fill: 'var(--muted)', fontSize: 11 }}
												axisLine={false}
												tickLine={false}
											/>
											<Tooltip
												contentStyle={{
													background: 'var(--surface)',
													border: '1px solid var(--line)',
													borderRadius: 8,
													fontSize: 12
												}}
											/>
											<Bar dataKey="sets" name="Sets" fill="var(--primary)" radius={4} />
										</BarChart>
									</ResponsiveContainer>
								</div>
							) : (
								<p className="text-muted text-sm">Log a workout to see how your volume splits.</p>
							)}
						</CardBody>
					</Card>

					<ReadinessCard
						adherence={data.adherence}
						consistency={data.consistency}
						risk={data.overreaching_risk}
					/>

					<Card>
						<CardHeader title="Body & energy" subtitle="Derived from your latest inputs" />
						<CardBody className="space-y-2 text-sm">
							{body.bmi != null ? (
								<>
									<p className="text-muted">
										BMI <span className="text-fg font-medium">{body.bmi}</span>
									</p>
									{body.body_fat_pct != null && (
										<p className="text-muted">
											Body fat <span className="text-fg font-medium">{body.body_fat_pct}%</span> (
											{body.body_fat_method})
										</p>
									)}
									{body.lean_mass != null && (
										<p className="text-muted">
											Lean mass{' '}
											<span className="text-fg font-medium">
												{formatWeight(body.lean_mass, weight.unit)}
											</span>
										</p>
									)}
									{body.tdee_kcal != null && (
										<p className="text-muted">
											Maintenance <span className="text-fg font-medium">{body.tdee_kcal} kcal</span>
											{body.calorie_target_kcal != null &&
												body.calorie_target_kcal !== body.tdee_kcal &&
												` · target ${body.calorie_target_kcal} kcal`}
										</p>
									)}
								</>
							) : (
								<p className="text-muted">
									Add your height, sex, and a weigh-in to unlock body fat, BMR, and calorie targets.
								</p>
							)}
							<Button variant="ghost" size="sm" onClick={() => navigate('/body')}>
								Open Body
							</Button>
						</CardBody>
					</Card>
				</motion.div>

				{Boolean(insights?.insights?.length) && (
					<motion.div variants={item}>
						<Card>
							<CardHeader title="Insights" subtitle="Patterns from your training log" />
							<CardBody className="space-y-2">
								{insights.insights.map((insight) => (
									<div
										key={insight.type}
										className="border-line flex items-start gap-2 rounded-md border px-3 py-2"
									>
										{insight.type === 'recovery' ? (
											<AlertTriangle size={15} className="text-warning mt-0.5 shrink-0" />
										) : (
											<Lightbulb size={15} className="text-primary mt-0.5 shrink-0" />
										)}
										<p className="text-fg text-sm">{insight.message}</p>
									</div>
								))}
							</CardBody>
						</Card>
					</motion.div>
				)}
			</motion.div>
		</div>
	);
}
