import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, Coffee, Dumbbell, Flame, Scale, Timer } from 'lucide-react';

import { SetWorkRestBarChart } from '../analytics/SetWorkRestBarChart';
import { PageHeader } from '../layout/PageHeader';
import { Badge, Button, Card, CardBody, CardHeader, StatCard } from '../ui';
import { SessionIntensityBadge } from './MildBadge';
import { formatDate, formatDurationSeconds } from '../../lib/format';
import { useRoutineSessionAverage } from '../../lib/resources';
import { averageCompareProps, sessionSummaryStats } from '../../lib/workoutSession';

const container = { animate: { transition: { staggerChildren: 0.04 } } };
const item = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };

const compactHeader = 'p-2.5 pb-0.5';
const compactBody = 'p-2.5 pt-0';

/** Single-viewport summary after finishing a workout (max 750px). */
export function WorkoutSummary({ session, onDone }) {
	const stats = useMemo(() => sessionSummaryStats(session), [session]);
	const { data: average } = useRoutineSessionAverage(session.id);
	const avg = average?.stats;
	const sampleCount = average?.sample_count ?? 0;
	const title = session.template_name || 'Workout';

	return (
		<div className="flex max-h-[750px] min-h-0 flex-col overflow-hidden">
			<PageHeader
				title={
					<span className="inline-flex items-center gap-2">
						<Check size={20} className="text-success" />
						Workout complete
						<SessionIntensityBadge intensity={session.intensity} />
					</span>
				}
				icon={Timer}
				description={`${title} · ${formatDate(session.date, 'EEE, MMM d')}${
					session.notes ? ` · “${session.notes}”` : ''
				}`}
				actions={
					<Button onClick={onDone}>
						<Check size={16} />
						Done
					</Button>
				}
				className="mb-2 shrink-0 gap-2"
			/>

			<motion.div
				variants={container}
				initial="initial"
				animate="animate"
				className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden"
			>
				<motion.div
					variants={item}
					className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6"
				>
					<StatCard
						dense
						icon={Dumbbell}
						label="Sets"
						value={stats.setCount}
						{...averageCompareProps(stats.setCount, avg?.set_count)}
					/>
					<StatCard
						dense
						icon={Timer}
						label="Duration"
						value={formatDurationSeconds(stats.durationSeconds)}
						{...averageCompareProps(stats.durationSeconds, avg?.duration_seconds, {
							higherIsBetter: false
						})}
					/>
					<StatCard
						dense
						icon={Timer}
						label="Avg work"
						value={formatDurationSeconds(stats.avgWorkSeconds)}
						{...averageCompareProps(stats.avgWorkSeconds, avg?.avg_work_seconds, {
							extra: `Σ ${formatDurationSeconds(stats.totalWorkSeconds)}`
						})}
					/>
					<StatCard
						dense
						icon={Coffee}
						label="Avg rest"
						value={formatDurationSeconds(stats.avgRestSeconds)}
						{...averageCompareProps(stats.avgRestSeconds, avg?.avg_rest_seconds, {
							higherIsBetter: false,
							extra: `Σ ${formatDurationSeconds(stats.totalRestSeconds)}`
						})}
					/>
					<StatCard
						dense
						icon={Scale}
						label="Volume"
						value={`${Math.round(stats.volumeKg)} kg`}
						{...averageCompareProps(stats.volumeKg, avg?.volume_kg)}
					/>
					<StatCard
						dense
						icon={Flame}
						label="Calories"
						value={Math.round(stats.calories)}
						{...averageCompareProps(stats.calories, avg?.calories)}
					/>
				</motion.div>

				<motion.div variants={item} className="flex min-h-0 shrink-0 flex-col">
					<Card className="flex min-h-0 flex-col">
						<CardHeader
							className={compactHeader}
							title="Work & rest by set"
							subtitle={
								sampleCount
									? `Current vs average of ${sampleCount} prior ${title} session${sampleCount === 1 ? '' : 's'}`
									: 'Logged sets · rest 0 when none'
							}
						/>
						<CardBody className={compactBody}>
							{stats.chartSets.length ? (
								<SetWorkRestBarChart
									sets={stats.chartSets}
									averages={sampleCount ? average?.sets : undefined}
									className="h-36 w-full"
								/>
							) : (
								<p className="text-muted text-sm">No timed sets to chart.</p>
							)}
						</CardBody>
					</Card>
				</motion.div>

				<motion.div variants={item} className="flex min-h-0 flex-1 flex-col overflow-hidden">
					<Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
						<CardHeader
							className={`${compactHeader} shrink-0`}
							title="By exercise"
							subtitle="Logged sets only"
						/>
						<CardBody className={`${compactBody} min-h-0 flex-1 space-y-1.5 overflow-y-auto`}>
							{stats.byExercise.length ? (
								stats.byExercise.map((ex) => (
									<div
										key={ex.id}
										className="border-line flex flex-wrap items-baseline justify-between gap-2 rounded-md border px-2.5 py-1.5"
									>
										<div className="min-w-0 flex-1">
											<p className="text-fg truncate text-sm font-medium">{ex.name}</p>
											<p className="text-muted text-xs">
												{ex.skipped ? (
													'Skipped'
												) : (
													<>
														{ex.setCount} set{ex.setCount === 1 ? '' : 's'} ·{' '}
														{formatDurationSeconds(ex.workSeconds)} work ·{' '}
														{formatDurationSeconds(ex.restSeconds)} rest
														{ex.avgRpe != null ? ` · avg RPE ${ex.avgRpe}` : ''}
													</>
												)}
											</p>
										</div>
										{ex.skipped && <Badge>Skipped</Badge>}
									</div>
								))
							) : (
								<p className="text-muted text-sm">No exercises logged.</p>
							)}
						</CardBody>
					</Card>
				</motion.div>
			</motion.div>
		</div>
	);
}
