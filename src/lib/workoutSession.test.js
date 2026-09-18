import { describe, expect, it } from 'vitest';

import {
	isExerciseFinished,
	selectActiveSessionExercise,
	sessionSetMarkers
} from './workoutSession';

describe('sessionSetMarkers', () => {
	const exercises = [
		{
			id: 1,
			exercise_name: 'Squat',
			planned_sets: 2,
			skipped: false,
			sets: [{ index: 1, skipped: false }]
		},
		{
			id: 2,
			exercise_name: 'Wrist curl',
			planned_sets: 3,
			skipped: false,
			sets: [{ index: 1, skipped: true }]
		},
		{
			id: 3,
			exercise_name: 'Plank',
			planned_sets: 2,
			skipped: true,
			sets: []
		}
	];

	it('marks completed, skipped, current, and upcoming across the session', () => {
		const markers = sessionSetMarkers(exercises, {
			currentExerciseId: 2,
			currentSetIndex: 2
		});

		expect(markers.map((m) => [m.globalIndex, m.status])).toEqual([
			[1, 'completed'],
			[2, 'upcoming'],
			[3, 'skipped'],
			[4, 'current'],
			[5, 'upcoming'],
			[6, 'skipped'],
			[7, 'skipped']
		]);
		expect(markers[3].label).toBe('current');
		expect(markers[0].groupStart).toBe(true);
		expect(markers[2].groupStart).toBe(true);
		expect(markers[3].groupStart).toBe(false);
	});
});

describe('selectActiveSessionExercise', () => {
	const last = {
		id: 9,
		exercise_name: 'Curl',
		planned_sets: 2,
		skipped: false,
		sets: [
			{ index: 1, skipped: false },
			{ index: 2, skipped: false }
		]
	};

	it('counts skipped logs as filling planned slots', () => {
		expect(
			isExerciseFinished({
				id: 1,
				planned_sets: 2,
				skipped: false,
				sets: [
					{ index: 1, skipped: false },
					{ index: 2, skipped: true }
				]
			})
		).toBe(true);
	});

	it('keeps a finished exercise while the timer is still holding it', () => {
		expect(
			selectActiveSessionExercise([last], {
				sessionExerciseId: last.id,
				phase: 'rest_exercise'
			})
		).toBe(last);
	});

	it('returns null after the last set when the timer is idle', () => {
		expect(
			selectActiveSessionExercise([last], {
				sessionExerciseId: last.id,
				phase: 'idle'
			})
		).toBeNull();
	});

	it('returns null when the workout is marked complete', () => {
		expect(
			selectActiveSessionExercise([last], {
				sessionExerciseId: last.id,
				phase: 'work',
				workoutComplete: true
			})
		).toBeNull();
	});
});
