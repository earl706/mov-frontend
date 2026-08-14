/** Sets already recorded for an exercise, ignoring ones marked skipped. */
export function loggedSets(sessionExercise) {
	return (sessionExercise?.sets || []).filter((set) => !set.skipped).length;
}

export function isExerciseFinished(sessionExercise) {
	if (!sessionExercise) return true;
	return sessionExercise.skipped || loggedSets(sessionExercise) >= sessionExercise.planned_sets;
}

export function nextUnfinishedExercise(exercises, afterId) {
	const list = exercises || [];
	const index = list.findIndex((entry) => entry.id === afterId);
	return list.slice(index + 1).find((entry) => !isExerciseFinished(entry)) || null;
}
