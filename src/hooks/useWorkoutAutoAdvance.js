import { useCallback } from 'react';

import { loggedSets, nextUnfinishedExercise } from '../lib/workoutSession';
import { useActiveSession, useLogSet, useUnlogSet } from '../lib/resources';
import { selectCanUndoLastSet, useWorkoutTimerStore } from '../stores/workoutTimerStore';

/**
 * Logs the current set and advances the continuous timer (rest → next set,
 * or rest-between-exercises → next exercise, or idle when the plan is done).
 * Also supports one-step undo of the last Stop set while resting.
 */
export function useWorkoutAutoAdvance() {
	const logSet = useLogSet();
	const unlogSet = useUnlogSet();
	const { data, refetch } = useActiveSession();
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

	const undoLastSet = useCallback(async () => {
		const timer = useWorkoutTimerStore.getState();
		const snap = timer.undoSnapshot;
		if (!snap || !session || !timer.beginUndo()) return false;

		try {
			await unlogSet.mutateAsync({
				sessionId: session.id,
				session_exercise: snap.sessionExerciseId,
				index: snap.setIndex
			});
			const ok = useWorkoutTimerStore.getState().undoLastSet(snap);
			await refetch();
			return ok;
		} catch (err) {
			useWorkoutTimerStore.getState().endUndo();
			throw err;
		}
	}, [session, unlogSet, refetch]);

	return {
		finishSet,
		undoLastSet,
		logging: logSet.isPending,
		undoing: unlogSet.isPending,
		canUndo,
		session
	};
}
