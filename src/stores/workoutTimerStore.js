import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_WORKOUT_ALARM_SOUND, stopWorkoutAlarm } from '../lib/workoutAlarm';

/**
 * Timer state for one in-progress workout.
 *
 * The server owns the session and its set logs; this store only tracks where
 * the user is inside it (which exercise, which set, working or resting) and how
 * long the current set has taken. Everything time-related is stored as an
 * absolute epoch timestamp so a reload, a route change, or a backgrounded tab
 * resumes at the right second instead of the second it was suspended.
 *
 * Phases:
 *   idle          — an exercise is loaded, waiting for Start
 *   work          — set in progress (stopwatch for reps, countdown for timed holds)
 *   rest_rep      — short rest between reps inside the current set
 *   rest_set      — prescribed rest after a completed set of the same exercise
 *   rest_exercise — prescribed rest after the last set, before the next exercise
 *
 * After the first Start set, Stop set logs and begins rest. When rest ends the
 * alarm plays until the user taps Start set (or Skip rest during the countdown).
 */

const REST_PHASES = new Set(['rest_rep', 'rest_set', 'rest_exercise']);

const EMPTY_PRESCRIPTION = {
	sessionExerciseId: null,
	exerciseName: '',
	trackMode: 'reps',
	perSide: false,
	setIndex: 1,
	totalSets: 0,
	plannedReps: 0,
	plannedHoldSeconds: 0,
	restSetSeconds: 90,
	restRepSeconds: 0,
	restExerciseSeconds: 120,
	targetLoad: ''
};

const INITIAL = {
	sessionId: null,
	routineName: '',
	...EMPTY_PRESCRIPTION,

	phase: 'idle',
	running: false,
	workStartedAt: null,
	workAccumulated: 0,
	restEndAt: null,
	restStartedAt: null,
	restAccumulated: 0,
	// Rest already taken before the current set began. Rest between sets ends
	// before the next set is logged, so it rides along on that set's payload.
	carriedRestSeconds: 0,
	repsDone: 0,
	loadInput: '',
	rpeInput: '',

	pendingNextExercise: null,
	pendingNextSetIndex: 1,
	autoLogPending: false,
	logInFlight: false,

	alarmActive: false,
	alarmKind: null,
	alarmSound: DEFAULT_WORKOUT_ALARM_SOUND
};

function nowMs() {
	return Date.now();
}

function elapsedSince(startedAt) {
	if (startedAt == null) return 0;
	return Math.max(0, Math.floor((nowMs() - startedAt) / 1000));
}

function prescriptionFrom(sessionExercise, setIndex) {
	return {
		sessionExerciseId: sessionExercise.id,
		exerciseName: sessionExercise.exercise_name,
		trackMode: sessionExercise.track_mode,
		perSide: Boolean(sessionExercise.per_side),
		setIndex,
		totalSets: sessionExercise.planned_sets,
		plannedReps: sessionExercise.planned_reps,
		plannedHoldSeconds: sessionExercise.planned_hold_seconds,
		restSetSeconds: sessionExercise.rest_set_seconds,
		restRepSeconds: sessionExercise.rest_rep_seconds,
		restExerciseSeconds: sessionExercise.rest_exercise_seconds ?? 0,
		targetLoad:
			sessionExercise.target_load_kg != null ? String(sessionExercise.target_load_kg) : '',
		loadInput: sessionExercise.target_load_kg != null ? String(sessionExercise.target_load_kg) : ''
	};
}

function snapshotPending(sessionExercise) {
	if (!sessionExercise) return null;
	return {
		id: sessionExercise.id,
		exercise_name: sessionExercise.exercise_name,
		track_mode: sessionExercise.track_mode,
		per_side: sessionExercise.per_side,
		planned_sets: sessionExercise.planned_sets,
		planned_reps: sessionExercise.planned_reps,
		planned_hold_seconds: sessionExercise.planned_hold_seconds,
		rest_set_seconds: sessionExercise.rest_set_seconds,
		rest_rep_seconds: sessionExercise.rest_rep_seconds,
		rest_exercise_seconds: sessionExercise.rest_exercise_seconds,
		target_load_kg: sessionExercise.target_load_kg
	};
}

/** Seconds of work banked so far on the current set, running or paused. */
export function selectWorkSeconds(s) {
	return s.workAccumulated + (s.running && s.phase === 'work' ? elapsedSince(s.workStartedAt) : 0);
}

/** Seconds left on whichever rest countdown is active, else 0. */
export function selectRestRemaining(s) {
	if (s.restEndAt == null) return 0;
	return Math.max(0, Math.ceil((s.restEndAt - nowMs()) / 1000));
}

/** Big number shown on the timer face. */
export function selectDisplaySeconds(s) {
	if (REST_PHASES.has(s.phase)) return selectRestRemaining(s);
	if (s.trackMode === 'hold') {
		return Math.max(0, s.plannedHoldSeconds - selectWorkSeconds(s));
	}
	return selectWorkSeconds(s);
}

export function selectSessionActive(s) {
	return s.sessionId != null;
}

/** True while the clock is genuinely moving, for topbar/nav affordances. */
export function selectTimerRunning(s) {
	if (REST_PHASES.has(s.phase)) return s.restEndAt != null;
	return s.running && s.phase === 'work';
}

export function selectResting(s) {
	return REST_PHASES.has(s.phase);
}

export function selectAlarmActive(s) {
	return Boolean(s.alarmActive);
}

export const useWorkoutTimerStore = create(
	persist(
		(set, get) => ({
			...INITIAL,

			setAlarmSound: (alarmSound) => set({ alarmSound }),

			/** Attach the store to a server session without touching the cursor. */
			attachSession: ({ id, name }) => {
				if (get().sessionId === id) return;
				stopWorkoutAlarm();
				set({ ...INITIAL, alarmSound: get().alarmSound, sessionId: id, routineName: name || '' });
			},

			/** Point the timer at an exercise/set and reset the per-set counters. */
			loadSet: (sessionExercise, setIndex, options = {}) => {
				stopWorkoutAlarm();
				set({
					...prescriptionFrom(sessionExercise, setIndex),
					phase: 'idle',
					running: false,
					workStartedAt: null,
					workAccumulated: 0,
					restEndAt: null,
					restStartedAt: null,
					restAccumulated: 0,
					carriedRestSeconds: options.carriedRestSeconds ?? 0,
					repsDone: 0,
					rpeInput: '',
					pendingNextExercise: null,
					pendingNextSetIndex: 1,
					autoLogPending: false,
					alarmActive: Boolean(options.alarmKind),
					alarmKind: options.alarmKind ?? null
				});
			},

			setLoadInput: (loadInput) => set({ loadInput }),
			setRpeInput: (rpeInput) => set({ rpeInput }),

			startSet: () => {
				const s = get();
				if (s.phase === 'work' && s.running) return;
				if (s.phase === 'rest_exercise') {
					get().completeRestAndStart();
					return;
				}
				stopWorkoutAlarm();
				// Starting early cuts a rest short; the part already served counts.
				const carried =
					s.phase === 'rest_set'
						? s.carriedRestSeconds + elapsedSince(s.restStartedAt)
						: s.carriedRestSeconds;
				const rested =
					s.phase === 'rest_rep'
						? s.restAccumulated + elapsedSince(s.restStartedAt)
						: s.restAccumulated;
				set({
					phase: 'work',
					running: true,
					workStartedAt: nowMs(),
					restEndAt: null,
					restStartedAt: null,
					restAccumulated: rested,
					carriedRestSeconds: carried,
					pendingNextExercise: null,
					alarmActive: false,
					alarmKind: null
				});
			},

			pauseSet: () => {
				const s = get();
				if (s.phase !== 'work' || !s.running) return;
				set({
					running: false,
					workAccumulated: s.workAccumulated + elapsedSince(s.workStartedAt),
					workStartedAt: null
				});
			},

			/**
			 * Bank a rep. With a rep rest configured the work clock pauses for the
			 * countdown so `work_seconds` stays a measure of time under tension.
			 */
			countRep: () => {
				const s = get();
				if (s.phase !== 'work') return;
				const reps = s.repsDone + 1;
				if (s.restRepSeconds > 0) {
					set({
						repsDone: reps,
						phase: 'rest_rep',
						running: false,
						workAccumulated: s.workAccumulated + (s.running ? elapsedSince(s.workStartedAt) : 0),
						workStartedAt: null,
						restStartedAt: nowMs(),
						restEndAt: nowMs() + s.restRepSeconds * 1000
					});
					return;
				}
				set({ repsDone: reps });
			},

			removeRep: () => {
				const s = get();
				if (s.repsDone <= 0) return;
				set({ repsDone: s.repsDone - 1 });
			},

			/** Leave a rest early and continue the loop (resume work or start the next set). */
			skipRest: () => {
				const s = get();
				if (!REST_PHASES.has(s.phase)) return null;
				if (s.phase === 'rest_rep') {
					stopWorkoutAlarm();
					const rested = elapsedSince(s.restStartedAt);
					set({
						phase: 'work',
						running: true,
						workStartedAt: nowMs(),
						restEndAt: null,
						restStartedAt: null,
						restAccumulated: s.restAccumulated + rested,
						alarmActive: false,
						alarmKind: null
					});
					return 'work';
				}
				return get().completeRestAndStart();
			},

			addRestSeconds: (delta) => {
				const s = get();
				if (s.restEndAt == null) return;
				set({ restEndAt: Math.max(nowMs(), s.restEndAt + delta * 1000) });
			},

			/**
			 * Freeze the set and hand back the payload the API expects. The caller
			 * logs it, then calls `advanceAfterLog`.
			 */
			buildSetPayload: ({ skipped = false } = {}) => {
				const s = get();
				const workSeconds =
					s.workAccumulated + (s.running && s.phase === 'work' ? elapsedSince(s.workStartedAt) : 0);
				const restSeconds =
					s.carriedRestSeconds +
					s.restAccumulated +
					(REST_PHASES.has(s.phase) ? elapsedSince(s.restStartedAt) : 0);
				const isHold = s.trackMode === 'hold';
				const load = Number(s.loadInput);
				const rpe = Number(s.rpeInput);
				return {
					session_exercise: s.sessionExerciseId,
					index: s.setIndex,
					reps: isHold ? 0 : s.repsDone || s.plannedReps,
					hold_seconds: isHold ? Math.min(workSeconds, 3600) : 0,
					load_kg: s.loadInput !== '' && Number.isFinite(load) ? load.toFixed(2) : null,
					work_seconds: workSeconds,
					rest_seconds: restSeconds,
					rpe: s.rpeInput !== '' && rpe >= 1 && rpe <= 10 ? rpe : null,
					skipped
				};
			},

			/** Start the prescribed rest between sets of the same exercise. */
			beginSetRest: () => {
				const s = get();
				stopWorkoutAlarm();
				if (!s.restSetSeconds) {
					set({
						phase: 'idle',
						running: false,
						workStartedAt: null,
						workAccumulated: 0,
						restEndAt: null,
						restStartedAt: null,
						restAccumulated: 0,
						repsDone: 0,
						alarmActive: false,
						alarmKind: null
					});
					return false;
				}
				set({
					phase: 'rest_set',
					running: false,
					workStartedAt: null,
					workAccumulated: 0,
					restAccumulated: 0,
					repsDone: 0,
					restStartedAt: nowMs(),
					restEndAt: nowMs() + s.restSetSeconds * 1000,
					alarmActive: false,
					alarmKind: null
				});
				return true;
			},

			/** Rest after the last set of this exercise, then load `nextExercise`. */
			beginExerciseRest: (nextExercise, nextSetIndex = 1) => {
				const s = get();
				stopWorkoutAlarm();
				if (!s.restExerciseSeconds) {
					get().loadSet(nextExercise, nextSetIndex);
					return false;
				}
				set({
					phase: 'rest_exercise',
					running: false,
					workStartedAt: null,
					workAccumulated: 0,
					restAccumulated: 0,
					repsDone: 0,
					restStartedAt: nowMs(),
					restEndAt: nowMs() + s.restExerciseSeconds * 1000,
					pendingNextExercise: snapshotPending(nextExercise),
					pendingNextSetIndex: nextSetIndex,
					alarmActive: false,
					alarmKind: null
				});
				return true;
			},

			/**
			 * Advance the cursor to the next set of the same exercise. Called right
			 * after the previous set was logged, so its rest counters are spent.
			 */
			advanceSet: () => {
				const s = get();
				set({
					setIndex: s.setIndex + 1,
					phase: 'idle',
					running: false,
					workStartedAt: null,
					workAccumulated: 0,
					restEndAt: null,
					restStartedAt: null,
					restAccumulated: 0,
					carriedRestSeconds: 0,
					repsDone: 0
				});
			},

			finishLastSet: () => {
				stopWorkoutAlarm();
				set({
					phase: 'idle',
					running: false,
					workStartedAt: null,
					workAccumulated: 0,
					restEndAt: null,
					restStartedAt: null,
					restAccumulated: 0,
					carriedRestSeconds: 0,
					repsDone: 0,
					pendingNextExercise: null,
					autoLogPending: false,
					alarmActive: false,
					alarmKind: null
				});
			},

			/**
			 * After a set is logged: rest between remaining sets, rest before the
			 * next exercise, or idle when the session plan is done.
			 */
			advanceAfterLog: ({ nextExercise = null, nextSetIndex = 1 } = {}) => {
				const s = get();
				if (s.setIndex < s.totalSets) {
					get().advanceSet();
					if (!get().beginSetRest()) return 'idle';
					return 'rest_set';
				}
				if (nextExercise) {
					if (!get().beginExerciseRest(nextExercise, nextSetIndex)) return 'idle';
					return 'rest_exercise';
				}
				get().finishLastSet();
				return 'done';
			},

			/**
			 * Rest timed out: book the rest that was served and wait for Start set.
			 * Skip rest still calls completeRestAndStart to begin work immediately.
			 */
			onRestElapsed: (kind) => {
				const s = get();
				if (kind === 'rest_rep') {
					set({
						restAccumulated: s.restAccumulated + elapsedSince(s.restStartedAt),
						restEndAt: null,
						restStartedAt: null,
						alarmActive: true,
						alarmKind: kind
					});
					return;
				}
				if (kind === 'rest_set') {
					set({
						phase: 'idle',
						carriedRestSeconds: s.carriedRestSeconds + elapsedSince(s.restStartedAt),
						restEndAt: null,
						restStartedAt: null,
						alarmActive: true,
						alarmKind: kind
					});
					return;
				}
				if (kind === 'rest_exercise') {
					const carried = s.carriedRestSeconds + elapsedSince(s.restStartedAt);
					const next = s.pendingNextExercise;
					const nextIndex = s.pendingNextSetIndex || 1;
					if (!next) {
						get().finishLastSet();
						return;
					}
					get().loadSet(next, nextIndex, {
						carriedRestSeconds: carried,
						alarmKind: kind
					});
				}
			},

			/**
			 * Skip rest (or Start set during rest_exercise): begin the next working set.
			 */
			completeRestAndStart: () => {
				const s = get();
				stopWorkoutAlarm();
				if (s.phase === 'rest_rep') {
					set({
						phase: 'work',
						running: true,
						workStartedAt: nowMs(),
						restAccumulated: s.restAccumulated + elapsedSince(s.restStartedAt),
						restEndAt: null,
						restStartedAt: null,
						alarmActive: false,
						alarmKind: null
					});
					return 'work';
				}
				if (s.phase === 'rest_set') {
					get().startSet();
					return 'work';
				}
				if (s.phase === 'rest_exercise') {
					const carried = s.carriedRestSeconds + elapsedSince(s.restStartedAt);
					const next = s.pendingNextExercise;
					const nextIndex = s.pendingNextSetIndex || 1;
					if (!next) {
						get().finishLastSet();
						return 'done';
					}
					get().loadSet(next, nextIndex, { carriedRestSeconds: carried });
					get().startSet();
					return 'work';
				}
				return null;
			},

			requestAutoLog: () => set({ autoLogPending: true }),
			clearAutoLog: () => set({ autoLogPending: false }),
			beginLog: () => {
				if (get().logInFlight) return false;
				set({ logInFlight: true });
				return true;
			},
			endLog: () => set({ logInFlight: false }),

			raiseAlarm: (kind) => set({ alarmActive: true, alarmKind: kind }),

			stopAlarmSound: () => stopWorkoutAlarm(),

			dismissAlarm: () => {
				stopWorkoutAlarm();
				set({ alarmActive: false, alarmKind: null });
			},

			/**
			 * Called on an interval. Returns the boundary that was just crossed
			 * ('rest_rep' | 'rest_set' | 'rest_exercise' | 'hold') so the engine
			 * can sound the alarm and wait for Start set.
			 */
			syncTick: () => {
				const s = get();
				if (s.alarmActive || s.autoLogPending) return null;
				if (REST_PHASES.has(s.phase)) {
					if (s.restEndAt != null && s.restEndAt <= nowMs()) return s.phase;
					return null;
				}
				if (
					s.phase === 'work' &&
					s.running &&
					s.trackMode === 'hold' &&
					s.plannedHoldSeconds > 0 &&
					selectWorkSeconds(s) >= s.plannedHoldSeconds
				) {
					return 'hold';
				}
				return null;
			},

			/** Pause a timed hold at exactly its target so logs stay honest. */
			freezeHold: () => {
				const s = get();
				if (s.phase !== 'work') return;
				set({
					running: false,
					workStartedAt: null,
					workAccumulated: s.plannedHoldSeconds || selectWorkSeconds(s)
				});
			},

			clearSession: () => {
				stopWorkoutAlarm();
				set({ ...INITIAL, alarmSound: get().alarmSound });
			}
		}),
		{
			name: 'mov-workout-timer',
			partialize: (s) => ({
				sessionId: s.sessionId,
				routineName: s.routineName,
				sessionExerciseId: s.sessionExerciseId,
				exerciseName: s.exerciseName,
				trackMode: s.trackMode,
				perSide: s.perSide,
				setIndex: s.setIndex,
				totalSets: s.totalSets,
				plannedReps: s.plannedReps,
				plannedHoldSeconds: s.plannedHoldSeconds,
				restSetSeconds: s.restSetSeconds,
				restRepSeconds: s.restRepSeconds,
				restExerciseSeconds: s.restExerciseSeconds,
				targetLoad: s.targetLoad,
				phase: s.phase,
				running: s.running,
				workStartedAt: s.workStartedAt,
				workAccumulated: s.workAccumulated,
				restEndAt: s.restEndAt,
				restStartedAt: s.restStartedAt,
				restAccumulated: s.restAccumulated,
				carriedRestSeconds: s.carriedRestSeconds,
				repsDone: s.repsDone,
				loadInput: s.loadInput,
				rpeInput: s.rpeInput,
				pendingNextExercise: s.pendingNextExercise,
				pendingNextSetIndex: s.pendingNextSetIndex,
				alarmSound: s.alarmSound
			})
		}
	)
);
