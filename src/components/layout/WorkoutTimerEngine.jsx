import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Play, VolumeX } from 'lucide-react';

import { useWorkoutAutoAdvance } from '../../hooks/useWorkoutAutoAdvance';
import { formatTimerDisplay } from '../../lib/timerFormat';
import { playRepCue, startWorkoutAlarm } from '../../lib/workoutAlarm';
import {
	selectAlarmActive,
	selectDisplaySeconds,
	selectResting,
	selectSessionActive,
	useWorkoutTimerStore
} from '../../stores/workoutTimerStore';
import { Button } from '../ui';

/**
 * Keeps the workout timer ticking regardless of the visible route, auto-logs
 * completed holds, raises rest alarms until Start set, and surfaces a floating
 * control when the user has navigated away from the Workout page.
 */
export function WorkoutTimerEngine() {
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const onTrainPage = pathname === '/train';
	const { finishSet } = useWorkoutAutoAdvance();

	const syncTick = useWorkoutTimerStore((s) => s.syncTick);
	const alarmActive = useWorkoutTimerStore(selectAlarmActive);
	const autoLogPending = useWorkoutTimerStore((s) => s.autoLogPending);
	const stopAlarmSound = useWorkoutTimerStore((s) => s.stopAlarmSound);
	const startSet = useWorkoutTimerStore((s) => s.startSet);
	const sessionActive = useWorkoutTimerStore(selectSessionActive);
	const resting = useWorkoutTimerStore(selectResting);
	const displaySeconds = useWorkoutTimerStore(selectDisplaySeconds);
	const exerciseName = useWorkoutTimerStore((s) => s.exerciseName);
	const pendingNext = useWorkoutTimerStore((s) => s.pendingNextExercise);
	const phase = useWorkoutTimerStore((s) => s.phase);

	const handledRef = useRef(false);
	const loggingRef = useRef(false);

	useEffect(() => {
		const id = window.setInterval(() => {
			const boundary = syncTick();
			if (!boundary) {
				handledRef.current = false;
				return;
			}
			if (handledRef.current) return;
			handledRef.current = true;

			const state = useWorkoutTimerStore.getState();
			if (boundary === 'rest_rep' || boundary === 'rest_set' || boundary === 'rest_exercise') {
				state.onRestElapsed(boundary);
				startWorkoutAlarm(state.alarmSound);
				return;
			}
			if (boundary === 'hold') {
				state.freezeHold();
				playRepCue();
				state.requestAutoLog();
			}
		}, 250);
		return () => window.clearInterval(id);
	}, [syncTick]);

	useEffect(() => {
		if (!autoLogPending || loggingRef.current) return undefined;
		loggingRef.current = true;
		finishSet()
			.catch(() => {})
			.finally(() => {
				useWorkoutTimerStore.getState().clearAutoLog();
				loggingRef.current = false;
			});
		return undefined;
	}, [autoLogPending, finishSet]);

	useEffect(() => {
		if (!sessionActive || onTrainPage) return undefined;
		const id = window.setInterval(() => useWorkoutTimerStore.setState({}), 1000);
		return () => window.clearInterval(id);
	}, [sessionActive, onTrainPage]);

	if (onTrainPage || !sessionActive) return null;

	const restLabel = alarmActive
		? 'Rest over'
		: phase === 'rest_exercise'
			? `Rest before ${pendingNext?.exercise_name || 'next exercise'}`
			: resting
				? 'Resting'
				: 'Workout in progress';

	return (
		<div className="fixed bottom-6 left-1/2 z-50 w-[min(100%,26rem)] -translate-x-1/2 px-4 sm:px-0">
			<div
				className={
					alarmActive
						? 'border-danger/60 bg-danger/10 flex flex-col gap-3 rounded-lg border px-4 py-3 shadow-xl sm:flex-row sm:items-center'
						: 'border-line bg-surface flex flex-col gap-3 rounded-lg border px-4 py-3 shadow-xl sm:flex-row sm:items-center'
				}
			>
				<div className="min-w-0 flex-1">
					<p className="text-fg text-sm font-medium">{restLabel}</p>
					<p className="text-muted mt-0.5 truncate text-xs">
						{alarmActive
							? `Tap Start set to continue · ${exerciseName || 'Workout'}`
							: `${exerciseName || 'Workout'} · ${formatTimerDisplay(displaySeconds)}`}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{alarmActive ? (
						<>
							<Button size="sm" variant="ghost" onClick={stopAlarmSound}>
								<VolumeX size={15} />
								Stop sound
							</Button>
							<Button size="sm" onClick={startSet}>
								<Play size={15} />
								Start set
							</Button>
						</>
					) : (
						<Button size="sm" onClick={() => navigate('/train')}>
							Back to workout
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
