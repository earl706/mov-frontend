/** Sets already recorded for an exercise, ignoring ones marked skipped. */
export function loggedSets(sessionExercise) {
	return (sessionExercise?.sets || []).filter((set) => !set.skipped).length;
}

/** Planned slots that already have a log row, including skipped sets. */
export function filledSets(sessionExercise) {
	return (sessionExercise?.sets || []).length;
}

const TIMER_HOLDING_PHASES = new Set(['work', 'rest_rep', 'rest_set', 'rest_exercise']);

const SET_STATUS_LABEL = {
	completed: 'completed',
	current: 'current',
	upcoming: 'upcoming',
	skipped: 'skipped'
};

/**
 * Planned set slots across a session, in exercise order, for progress markers.
 * `currentExerciseId` + `currentSetIndex` mark the active cursor (timer set).
 */
export function sessionSetMarkers(
	exercises,
	{ currentExerciseId = null, currentSetIndex = null } = {}
) {
	const markers = [];
	let globalIndex = 0;

	for (const exercise of exercises || []) {
		const planned = Math.max(0, exercise.planned_sets || 0);
		if (!planned) continue;

		const byIndex = new Map((exercise.sets || []).map((set) => [set.index, set]));

		for (let setIndex = 1; setIndex <= planned; setIndex += 1) {
			globalIndex += 1;
			const log = byIndex.get(setIndex);
			let status = 'upcoming';

			if (exercise.skipped) {
				status = 'skipped';
			} else if (log?.skipped) {
				status = 'skipped';
			} else if (log) {
				status = 'completed';
			} else if (
				currentExerciseId != null &&
				exercise.id === currentExerciseId &&
				setIndex === currentSetIndex
			) {
				status = 'current';
			}

			markers.push({
				key: `${exercise.id}-${setIndex}`,
				exerciseId: exercise.id,
				exerciseName: exercise.exercise_name,
				setIndex,
				globalIndex,
				status,
				label: SET_STATUS_LABEL[status],
				groupStart: setIndex === 1
			});
		}
	}

	return markers;
}

/** Sum of work/rest already written to SetLog rows (includes skipped sets). */
export function sessionLoggedTiming(sessionOrExercises) {
	const exercises = Array.isArray(sessionOrExercises)
		? sessionOrExercises
		: sessionOrExercises?.exercises || [];
	let workSeconds = 0;
	let restSeconds = 0;
	for (const exercise of exercises) {
		for (const set of exercise.sets || []) {
			workSeconds += set.work_seconds || 0;
			restSeconds += set.rest_seconds || 0;
		}
	}
	return { workSeconds, restSeconds };
}

export function isExerciseFinished(sessionExercise) {
	if (!sessionExercise) return true;
	if (sessionExercise.skipped) return true;
	return filledSets(sessionExercise) >= sessionExercise.planned_sets;
}

/**
 * Exercise the Train timer should show. Prefers the timer cursor so undo/rewind
 * can reopen a just-logged set, but yields null once the plan is done and the
 * timer is idle so Finish workout can appear.
 */
export function selectActiveSessionExercise(
	exercises,
	{ sessionExerciseId = null, phase = 'idle', workoutComplete = false } = {}
) {
	if (workoutComplete) return null;
	const list = exercises || [];
	const fromTimer = list.find((entry) => entry.id === sessionExerciseId);
	const holding = TIMER_HOLDING_PHASES.has(phase);
	if (fromTimer && !fromTimer.skipped && (holding || !isExerciseFinished(fromTimer))) {
		return fromTimer;
	}
	return list.find((entry) => !isExerciseFinished(entry)) || null;
}

export function nextUnfinishedExercise(exercises, afterId) {
	const list = exercises || [];
	const index = list.findIndex((entry) => entry.id === afterId);
	return list.slice(index + 1).find((entry) => !isExerciseFinished(entry)) || null;
}

/** Non-skipped sets in session order for work/rest charts (rest missing → 0). */
export function sessionSetChartData(session) {
	const rows = [];
	for (const exercise of session?.exercises || []) {
		for (const set of exercise.sets || []) {
			if (set.skipped) continue;
			const work = set.work_seconds || 0;
			const rest = set.rest_seconds || 0;
			rows.push({
				key: `${exercise.id}-${set.index}`,
				tick: String(rows.length + 1),
				name: exercise.exercise_name,
				exercise_name: exercise.exercise_name,
				set_index: set.index,
				work_seconds: work,
				rest_seconds: rest,
				work,
				rest,
				rpe: set.rpe ?? null
			});
		}
	}
	return rows;
}

/** Aggregates for the post-workout summary (logged sets only). */
export function sessionSummaryStats(session) {
	const sets = sessionSetChartData(session);
	const workSeconds = sets.map((s) => s.work_seconds);
	const restSeconds = sets.map((s) => s.rest_seconds);
	const rpes = sets.map((s) => s.rpe).filter((v) => v != null && v !== '');

	const sum = (arr) => arr.reduce((a, b) => a + b, 0);
	const mean = (arr) => (arr.length ? sum(arr) / arr.length : 0);

	const totalWork = session?.total_work_seconds ?? sum(workSeconds);
	const totalRest = session?.total_rest_seconds ?? sum(restSeconds);
	const duration = session?.duration_seconds ?? totalWork + totalRest;

	const byExercise = (session?.exercises || [])
		.map((exercise) => {
			const logged = (exercise.sets || []).filter((s) => !s.skipped);
			if (!logged.length && !exercise.skipped) return null;
			const work = sum(logged.map((s) => s.work_seconds || 0));
			const rest = sum(logged.map((s) => s.rest_seconds || 0));
			const setRpes = logged.map((s) => s.rpe).filter((v) => v != null && v !== '');
			return {
				id: exercise.id,
				name: exercise.exercise_name,
				skipped: Boolean(exercise.skipped),
				setCount: logged.length,
				workSeconds: work,
				restSeconds: rest,
				avgRpe: setRpes.length ? Math.round(mean(setRpes) * 10) / 10 : null,
				sets: logged
			};
		})
		.filter(Boolean);

	return {
		setCount: sets.length || session?.total_sets || 0,
		totalWorkSeconds: totalWork,
		totalRestSeconds: totalRest,
		durationSeconds: duration,
		avgWorkSeconds: Math.round(mean(workSeconds)),
		avgRestSeconds: Math.round(mean(restSeconds)),
		avgSetRpe: rpes.length ? Math.round(mean(rpes) * 10) / 10 : null,
		sessionRpe: session?.perceived_effort ?? null,
		volumeKg: Number(session?.total_volume_kg ?? 0),
		calories: Number(session?.calories_burned ?? 0),
		totalReps: session?.total_reps ?? 0,
		byExercise,
		chartSets: sets
	};
}
