import { useCallback } from 'react';

import { loggedSets, nextUnfinishedExercise } from '../lib/workoutSession';
import { useActiveSession, useLogSet } from '../lib/resources';
import { selectCanUndoLastSet, useWorkoutTimerStore } from '../stores/workoutTimerStore';

/**
 * Logs the current set and advances the continuous timer (rest → next set,
 * or rest-between-exercises → next exercise, or idle when the plan is done).
 * Undo last set/rest is timer-local (stacks); Stop overwrites the same SetLog.
 */
export function useWorkoutAutoAdvance() {
	const logSet = useLogSet();
	const { data } = useActiveSession();
	const session = data?.session || null;
	const canUndo = useWorkoutTimerStore(selectCanUndoLastSet);

	const finishSet = useCallback(
		async ({ skipped = false } = {}) => {
			const timer = useWorkoutTimerStore.getState();
			if (
				timer.phase === 'rest_set' ||
				timer.phase === 'rest_exercise' ||
				timer.phase === 'rest_rep'
			) {
				return null;
			}
			if (!timer.beginLog()) return null;
			timer.captureUndoSnapshot();
			const payload = timer.buildSetPayload({ skipped });
			if (!payload.session_exercise || !session) {
				timer.clearUndoSnapshot();
				timer.endLog();
				return null;
			}

			try {
				await logSet.mutateAsync({ sessionId: session.id, ...payload });
				const exercises = session.exercises || [];
				const next = nextUnfinishedExercise(exercises, payload.session_exercise);
				return useWorkoutTimerStore.getState().advanceAfterLog({
					nextExercise: next,
					nextSetIndex: next ? loggedSets(next) + 1 : 1
				});
			} catch (err) {
				useWorkoutTimerStore.getState().clearUndoSnapshot();
				throw err;
			} finally {
				useWorkoutTimerStore.getState().endLog();
			}
		},
		[logSet, session]
	);

	const undoLastSet = useCallback(() => {
		return useWorkoutTimerStore.getState().undoLastSet();
	}, []);

	return {
		finishSet,
		undoLastSet,
		logging: logSet.isPending,
		undoing: false,
		canUndo,
		session
	};
}
