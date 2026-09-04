import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, Coffee, Dumbbell, Flame, Scale, Timer } from 'lucide-react';

import { SetWorkRestBarChart } from '../analytics/SetWorkRestBarChart';
import { PageHeader } from '../layout/PageHeader';
import { Badge, Button, Card, CardBody, CardHeader, StatCard } from '../ui';
import { MildBadge } from './MildBadge';
import { formatDate, formatDurationSeconds } from '../../lib/format';
import { sessionSummaryStats } from '../../lib/workoutSession';

const container = { animate: { transition: { staggerChildren: 0.04 } } };
const item = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 } };

const compactHeader = 'p-2.5 pb-0.5';
const compactBody = 'p-2.5 pt-0';

/** Single-viewport summary after finishing a workout (max 750px). */
export function WorkoutSummary({ session, onDone }) {
	const stats = useMemo(() => sessionSummaryStats(session), [session]);
	const title = session.template_name || 'Workout';

	return (
		<div className="flex max-h-[750px] min-h-0 flex-col overflow-hidden">
			<PageHeader
				title={
					<span className="inline-flex items-center gap-2">
						<Check size={20} className="text-success" />
						Workout complete
						{session.is_mild && <MildBadge />}
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
					className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-8"
				>
					<StatCard dense icon={Dumbbell} label="Sets" value={stats.setCount} />
					<StatCard
						dense
						icon={Timer}
						label="Duration"
						value={formatDurationSeconds(stats.durationSeconds)}
					/>
					<StatCard
						dense
						icon={Timer}
						label="Avg work"
						value={formatDurationSeconds(stats.avgWorkSeconds)}
						sublabel={`Σ ${formatDurationSeconds(stats.totalWorkSeconds)}`}
					/>
					<StatCard
						dense
						icon={Coffee}
						label="Avg rest"
						value={formatDurationSeconds(stats.avgRestSeconds)}
						sublabel={`Σ ${formatDurationSeconds(stats.totalRestSeconds)}`}
					/>
					<StatCard dense icon={Scale} label="Volume" value={`${Math.round(stats.volumeKg)} kg`} />
					<StatCard dense icon={Flame} label="Calories" value={Math.round(stats.calories)} />
					<StatCard
						dense
						icon={Flame}
						label="Session RPE"
						value={stats.sessionRpe != null ? stats.sessionRpe : '—'}
					/>
					<StatCard
						dense
						icon={Dumbbell}
						label="Avg set RPE"
						value={stats.avgSetRpe != null ? stats.avgSetRpe : '—'}
					/>
				</motion.div>

				<motion.div variants={item} className="flex min-h-0 shrink-0 flex-col">
					<Card className="flex min-h-0 flex-col">
						<CardHeader
							className={compactHeader}
							title="Work & rest by set"
							subtitle="Logged sets · rest 0 when none"
						/>
						<CardBody className={compactBody}>
							{stats.chartSets.length ? (
								<SetWorkRestBarChart sets={stats.chartSets} className="h-36 w-full" />
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
