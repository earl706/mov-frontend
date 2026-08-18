import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	selectDisplaySeconds,
	selectRestRemaining,
	selectResting,
	selectTimerRunning,
	useWorkoutTimerStore
} from './workoutTimerStore';

const BARBELL_ROW = {
	id: 10,
	exercise_name: 'Barbell Row',
	track_mode: 'reps',
	per_side: false,
	planned_sets: 3,
	planned_reps: 8,
	planned_hold_seconds: 0,
	rest_set_seconds: 90,
	rest_rep_seconds: 0,
	target_load_kg: '60.00'
};

const PLANK = {
	id: 12,
	exercise_name: 'Plank',
	track_mode: 'hold',
	per_side: false,
	planned_sets: 3,
	planned_reps: 0,
	planned_hold_seconds: 45,
	rest_set_seconds: 60,
	rest_rep_seconds: 0,
	target_load_kg: null
};

const store = () => useWorkoutTimerStore.getState();

/** Advance the fake clock by whole seconds. */
const tick = (seconds) => vi.advanceTimersByTime(seconds * 1000);

/** Do `count` reps back to back, resting in between when prescribed. */
const doReps = (count, repRestSeconds = 0) => {
	for (let i = 0; i < count; i += 1) {
		store().countRep();
		if (repRestSeconds) {
			tick(repRestSeconds);
			store().startSet();
		}
	}
};

describe('workoutTimerStore', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-14T09:00:00Z'));
		store().clearSession();
		store().attachSession({ id: 1, name: 'Pull A' });
	});

	afterEach(() => {
		store().clearSession();
		vi.useRealTimers();
	});

	it('attaches a session without starting a clock', () => {
		expect(store().sessionId).toBe(1);
		expect(store().routineName).toBe('Pull A');
		expect(store().phase).toBe('idle');
		expect(selectTimerRunning(store())).toBe(false);
	});

	it('prefills the target load and clears it for bodyweight work', () => {
		store().loadSet(BARBELL_ROW, 1);
		expect(store().loadInput).toBe('60.00');
		store().loadSet(PLANK, 1);
		expect(store().loadInput).toBe('');
	});

	it('accumulates work time across pauses', () => {
		store().loadSet(BARBELL_ROW, 1);
		store().startSet();
		tick(12);
		expect(selectDisplaySeconds(store())).toBe(12);

		store().pauseSet();
		tick(5);
		expect(selectDisplaySeconds(store())).toBe(12);
		expect(selectTimerRunning(store())).toBe(false);

		store().startSet();
		tick(3);
		expect(selectDisplaySeconds(store())).toBe(15);
		expect(store().buildSetPayload().work_seconds).toBe(15);
	});

	it('builds a set payload the API accepts', () => {
		store().loadSet(BARBELL_ROW, 2);
		store().startSet();
		tick(15);
		doReps(8);
		store().setRpeInput('9');

		expect(store().buildSetPayload()).toEqual({
			session_exercise: 10,
			index: 2,
			reps: 8,
			hold_seconds: 0,
			load_kg: '60.00',
			work_seconds: 15,
			rest_seconds: 0,
			rpe: 9,
			skipped: false
		});
	});

	it('falls back to planned reps and drops an out-of-range RPE', () => {
		store().loadSet(BARBELL_ROW, 1);
		store().startSet();
		tick(10);
		store().setRpeInput('12');
		store().setLoadInput('');

		const payload = store().buildSetPayload();
		expect(payload.reps).toBe(BARBELL_ROW.planned_reps);
		expect(payload.rpe).toBeNull();
		expect(payload.load_kg).toBeNull();
	});

	it('counts reps up and down but only while working', () => {
		store().loadSet(BARBELL_ROW, 1);
		store().countRep();
		expect(store().repsDone).toBe(0);

		store().startSet();
		doReps(3);
		store().removeRep();
		expect(store().repsDone).toBe(2);
	});

	it('runs the prescribed rest between sets and books it on the next set', () => {
		store().loadSet(BARBELL_ROW, 1);
		store().startSet();
		tick(15);
		doReps(8);

		store().advanceSet();
		expect(store().beginSetRest()).toBe(true);
		expect(store().phase).toBe('rest_set');
		expect(selectResting(store())).toBe(true);
		expect(selectRestRemaining(store())).toBe(90);

		tick(40);
		expect(selectRestRemaining(store())).toBe(50);
		store().addRestSeconds(15);
		expect(selectRestRemaining(store())).toBe(65);

		tick(65);
		expect(store().syncTick()).toBe('rest_set');
		store().onRestElapsed('rest_set');
		expect(store().phase).toBe('idle');
		expect(store().alarmActive).toBe(true);
		store().startSet();
		expect(store().phase).toBe('work');

		tick(16);
		doReps(8);
		const payload = store().buildSetPayload();
		expect(payload.index).toBe(2);
		expect(payload.rest_seconds).toBe(105);
		expect(payload.work_seconds).toBe(16);
	});

	it('books only the rest actually served when it is cut short', () => {
		store().loadSet(BARBELL_ROW, 1);
		store().advanceSet();
		store().beginSetRest();
		tick(30);

		expect(store().skipRest()).toBe('work');
		tick(14);
		doReps(7);
		expect(store().buildSetPayload().rest_seconds).toBe(30);
	});

	it('books the rest served when the next set is started early', () => {
		store().loadSet(BARBELL_ROW, 1);
		store().advanceSet();
		store().beginSetRest();
		tick(25);

		store().startSet();
		tick(10);
		expect(store().buildSetPayload().rest_seconds).toBe(25);
	});

	it('skips the rest phase entirely when none is prescribed', () => {
		store().loadSet({ ...BARBELL_ROW, rest_set_seconds: 0 }, 1);
		store().advanceSet();
		expect(store().beginSetRest()).toBe(false);
		expect(store().phase).toBe('idle');
	});

	it('pauses the work clock for rep rests so work stays time under tension', () => {
		store().loadSet({ ...BARBELL_ROW, rest_rep_seconds: 10, planned_reps: 3 }, 1);
		store().startSet();

		tick(4);
		store().countRep();
		expect(store().phase).toBe('rest_rep');
		tick(10);
		expect(store().syncTick()).toBe('rest_rep');
		store().onRestElapsed('rest_rep');
		expect(store().alarmActive).toBe(true);
		store().startSet();
		expect(store().phase).toBe('work');

		tick(4);
		store().countRep();
		tick(10);
		store().skipRest();

		tick(4);
		store().countRep();

		const payload = store().buildSetPayload();
		expect(payload.reps).toBe(3);
		expect(payload.work_seconds).toBe(12);
		expect(payload.rest_seconds).toBe(20);
	});

	it('counts a timed hold down and freezes it at the target', () => {
		store().loadSet(PLANK, 1);
		store().startSet();

		tick(20);
		expect(selectDisplaySeconds(store())).toBe(25);
		expect(store().syncTick()).toBeNull();

		tick(25);
		expect(store().syncTick()).toBe('hold');
		store().freezeHold();

		const payload = store().buildSetPayload();
		expect(payload.hold_seconds).toBe(45);
		expect(payload.reps).toBe(0);
		expect(payload.load_kg).toBeNull();
	});

	it('stays silent once an alarm is already raised', () => {
		store().loadSet(BARBELL_ROW, 1);
		store().advanceSet();
		store().beginSetRest();
		tick(95);

		expect(store().syncTick()).toBe('rest_set');
		store().raiseAlarm('rest_set');
		expect(store().syncTick()).toBeNull();
	});

	it('resumes at the right second after a reload', () => {
		store().loadSet(BARBELL_ROW, 1);
		store().startSet();
		tick(30);

		// Simulate rehydration from localStorage: only persisted fields come back.
		const persisted = JSON.parse(JSON.stringify(store()));
		useWorkoutTimerStore.setState(persisted);
		tick(10);

		expect(selectDisplaySeconds(store())).toBe(40);
	});

	it('marks a skipped set without losing its timings', () => {
		store().loadSet(BARBELL_ROW, 1);
		store().startSet();
		tick(8);

		const payload = store().buildSetPayload({ skipped: true });
		expect(payload.skipped).toBe(true);
		expect(payload.work_seconds).toBe(8);
	});

	it('resets everything when the session ends', () => {
		store().loadSet(BARBELL_ROW, 1);
		store().startSet();
		tick(20);
		store().clearSession();

		expect(store().sessionId).toBeNull();
		expect(store().phase).toBe('idle');
		expect(store().sessionExerciseId).toBeNull();
		expect(selectDisplaySeconds(store())).toBe(0);
	});

	it('ignores re-attaching the same session so a refresh does not reset the set', () => {
		store().loadSet(BARBELL_ROW, 2);
		store().startSet();
		tick(20);

		store().attachSession({ id: 1, name: 'Pull A' });
		expect(store().setIndex).toBe(2);
		expect(selectDisplaySeconds(store())).toBe(20);
	});

	it('advances into between-set rest after a log and waits for Start set', () => {
		store().loadSet(BARBELL_ROW, 1);
		store().startSet();
		tick(10);
		doReps(8);

		expect(store().advanceAfterLog()).toBe('rest_set');
		expect(store().setIndex).toBe(2);
		tick(90);
		expect(store().syncTick()).toBe('rest_set');
		store().onRestElapsed('rest_set');
		expect(store().phase).toBe('idle');
		expect(store().alarmActive).toBe(true);
		store().startSet();
		expect(store().phase).toBe('work');
		expect(store().setIndex).toBe(2);
	});

	it('rests between exercises then waits for Start set', () => {
		const curl = {
			id: 11,
			exercise_name: 'Curl',
			track_mode: 'reps',
			per_side: false,
			planned_sets: 3,
			planned_reps: 10,
			planned_hold_seconds: 0,
			rest_set_seconds: 60,
			rest_rep_seconds: 0,
			rest_exercise_seconds: 90,
			target_load_kg: '12.00'
		};
		store().loadSet({ ...BARBELL_ROW, planned_sets: 1, rest_exercise_seconds: 45 }, 1);
		store().startSet();
		tick(10);
		doReps(8);

		expect(store().advanceAfterLog({ nextExercise: curl, nextSetIndex: 1 })).toBe('rest_exercise');
		expect(store().phase).toBe('rest_exercise');
		expect(selectRestRemaining(store())).toBe(45);

		tick(45);
		expect(store().syncTick()).toBe('rest_exercise');
		store().onRestElapsed('rest_exercise');
		expect(store().sessionExerciseId).toBe(11);
		expect(store().phase).toBe('idle');
		expect(store().alarmActive).toBe(true);
		store().startSet();
		expect(store().phase).toBe('work');
		tick(8);
		const payload = store().buildSetPayload();
		expect(payload.session_exercise).toBe(11);
		expect(payload.rest_seconds).toBe(45);
		expect(payload.work_seconds).toBe(8);
	});

	it('loads the next exercise and waits when between-exercise rest is zero', () => {
		const curl = { ...BARBELL_ROW, id: 11, exercise_name: 'Curl' };
		store().loadSet({ ...BARBELL_ROW, planned_sets: 1, rest_exercise_seconds: 0 }, 1);
		store().startSet();
		tick(5);
		expect(store().advanceAfterLog({ nextExercise: curl, nextSetIndex: 1 })).toBe('idle');
		expect(store().sessionExerciseId).toBe(11);
		expect(store().phase).toBe('idle');
		store().startSet();
		expect(store().phase).toBe('work');
	});

	it('adds the wait after a between-set rest alarm to the next set', () => {
		store().loadSet(BARBELL_ROW, 1);
		store().advanceSet();
		store().beginSetRest();
		tick(90);
		store().onRestElapsed('rest_set');
		tick(12);
		store().startSet();
		tick(5);
		expect(store().buildSetPayload().rest_seconds).toBe(102);
	});

	it('adds the wait after a between-exercise rest alarm to the next set', () => {
		const curl = {
			id: 11,
			exercise_name: 'Curl',
			track_mode: 'reps',
			per_side: false,
			planned_sets: 3,
			planned_reps: 10,
			planned_hold_seconds: 0,
			rest_set_seconds: 60,
			rest_rep_seconds: 0,
			rest_exercise_seconds: 90,
			target_load_kg: '12.00'
		};
		store().loadSet({ ...BARBELL_ROW, planned_sets: 1, rest_exercise_seconds: 45 }, 1);
		store().startSet();
		tick(10);
		doReps(8);

		expect(store().advanceAfterLog({ nextExercise: curl, nextSetIndex: 1 })).toBe('rest_exercise');
		tick(45);
		store().onRestElapsed('rest_exercise');
		tick(10);
		store().startSet();
		tick(8);
		expect(store().buildSetPayload().rest_seconds).toBe(55);
	});

	it('does not add post-alarm wait to rest after a rep rest', () => {
		store().loadSet({ ...BARBELL_ROW, rest_rep_seconds: 10, planned_reps: 2 }, 1);
		store().startSet();
		tick(4);
		store().countRep();
		tick(10);
		store().onRestElapsed('rest_rep');
		tick(7);
		store().startSet();
		tick(4);
		store().countRep();
		expect(store().buildSetPayload().rest_seconds).toBe(10);
	});

	it('goes idle after the last set of the last exercise', () => {
		store().loadSet({ ...BARBELL_ROW, planned_sets: 1 }, 1);
		store().startSet();
		tick(5);
		expect(store().advanceAfterLog({})).toBe('done');
		expect(store().phase).toBe('idle');
		expect(store().running).toBe(false);
	});
});
