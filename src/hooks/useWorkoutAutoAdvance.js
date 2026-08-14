import { useCallback } from 'react';

import { loggedSets, nextUnfinishedExercise } from '../lib/workoutSession';
import { useActiveSession, useLogSet } from '../lib/resources';
import { useWorkoutTimerStore } from '../stores/workoutTimerStore';

/**
 * Logs the current set and advances the continuous timer (rest → next set,
 * or rest-between-exercises → next exercise, or idle when the plan is done).
 */
export function useWorkoutAutoAdvance() {
	const logSet = useLogSet();
	const { data } = useActiveSession();
	const session = data?.session || null;

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
			const payload = timer.buildSetPayload({ skipped });
			if (!payload.session_exercise || !session) {
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
			} finally {
				useWorkoutTimerStore.getState().endLog();
			}
		},
		[logSet, session]
	);

	return { finishSet, logging: logSet.isPending, session };
}
