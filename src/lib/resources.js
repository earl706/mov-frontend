import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, patch, post, put } from './api';
import { createResourceHooks } from '../hooks/useResource';
import { useLocalCalendarDate } from '../hooks/useLocalCalendarDate';
import { toast } from '../stores/toastStore';

export const exercisesApi = createResourceHooks('exercises', '/exercises/');
export const routinesApi = createResourceHooks('routines', '/routines/');
export const sessionsApi = createResourceHooks('workout-sessions', '/workout-sessions/');
export const notificationsApi = createResourceHooks('notifications', '/notifications/');
export const weightEntriesApi = createResourceHooks('weight-entries', '/weight-entries/');
export const measurementsApi = createResourceHooks('body-measurements', '/body-measurements/');
export const progressPhotosApi = createResourceHooks('progress-photos', '/progress-photos/');

/** Every mutation that changes training data touches these caches. */
const WORKOUT_KEYS = ['workout-sessions', 'routines', 'dashboard', 'training'];

function invalidateWorkouts(qc) {
	WORKOUT_KEYS.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
}

// -----------------------------------------------------------------------------
// Workout sessions
// -----------------------------------------------------------------------------

export function useActiveSession() {
	return useQuery({
		queryKey: ['workout-sessions', 'active'],
		queryFn: () => get('/workout-sessions/active/')
	});
}

export function useTrainingStats(days = 30) {
	return useQuery({
		queryKey: ['training', 'stats', days],
		queryFn: () => get('/workout-sessions/stats/', { params: { days } })
	});
}

export function useTrainingSeries(days = 30) {
	return useQuery({
		queryKey: ['training', 'series', days],
		queryFn: () => get('/workout-sessions/series/', { params: { days } })
	});
}

export function useTrainingHeatmap(days = 84) {
	return useQuery({
		queryKey: ['training', 'heatmap', days],
		queryFn: () => get('/workout-sessions/heatmap/', { params: { days } })
	});
}

export function useRecentSets(limit = 30) {
	return useQuery({
		queryKey: ['training', 'recent-sets', limit],
		queryFn: () => get('/workout-sessions/recent-sets/', { params: { limit } })
	});
}

export function useSuggestedRoutine() {
	const localDate = useLocalCalendarDate();
	return useQuery({
		queryKey: ['routines', 'suggested', localDate],
		queryFn: () => get('/routines/suggested/')
	});
}

export function useWeeklySchedule() {
	const localDate = useLocalCalendarDate();
	return useQuery({
		queryKey: ['routines', 'schedule', localDate],
		queryFn: () => get('/routines/schedule/')
	});
}

export function useUpdateWeeklySchedule() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body) => put('/routines/schedule/', body),
		onSuccess: () => {
			invalidateWorkouts(qc);
			qc.invalidateQueries({ queryKey: ['profile'] });
			toast.success('Weekly split saved.');
		},
		onError: () => toast.error('Could not save the weekly split.')
	});
}

export function useExerciseHistory(id) {
	return useQuery({
		queryKey: ['exercises', 'history', id],
		queryFn: () => get(`/exercises/${id}/history/`),
		enabled: id != null
	});
}

export function useStartSession() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body) => post('/workout-sessions/start/', body),
		onSuccess: () => invalidateWorkouts(qc),
		onError: (err) => {
			const data = err?.response?.data;
			const msg = data?.template?.[0] || data?.detail || 'Could not start the workout.';
			toast.error(typeof msg === 'string' ? msg : 'Could not start the workout.');
		}
	});
}

export function useLogSet() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ sessionId, ...body }) => post(`/workout-sessions/${sessionId}/log-set/`, body),
		onSuccess: () => invalidateWorkouts(qc),
		onError: () => toast.error('Could not save that set.')
	});
}

export function useAdjustSessionExercise() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ sessionId, exerciseId, ...body }) =>
			patch(`/workout-sessions/${sessionId}/exercises/${exerciseId}/`, body),
		onSuccess: () => invalidateWorkouts(qc),
		onError: () => toast.error('Could not adjust this exercise.')
	});
}

export function useCompleteSession() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ sessionId, ...body }) => post(`/workout-sessions/${sessionId}/complete/`, body),
		onSuccess: () => invalidateWorkouts(qc),
		onError: () => toast.error('Could not finish the workout.')
	});
}

export function useAbandonSession() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (sessionId) => post(`/workout-sessions/${sessionId}/abandon/`),
		onSuccess: () => invalidateWorkouts(qc),
		onError: () => toast.error('Could not discard the workout.')
	});
}

// -----------------------------------------------------------------------------
// Body: weight, composition, measurements
// -----------------------------------------------------------------------------

export function useWeightProfile() {
	return useQuery({
		queryKey: ['weight-profile'],
		queryFn: () => get('/weight-profile/')
	});
}

export function useUpdateWeightProfile() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body) => patch('/weight-profile/', body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['weight-profile'] });
			qc.invalidateQueries({ queryKey: ['weight-entries'] });
			qc.invalidateQueries({ queryKey: ['body-composition'] });
			qc.invalidateQueries({ queryKey: ['dashboard'] });
			toast.success('Body preferences saved.');
		},
		onError: () => toast.error('Could not save body preferences.')
	});
}

export function useWeightStats(params = {}) {
	return useQuery({
		queryKey: ['weight-entries', 'stats', params],
		queryFn: () => get('/weight-entries/stats/', { params })
	});
}

export function useWeightSeries(params = {}) {
	return useQuery({
		queryKey: ['weight-entries', 'series', params],
		queryFn: () => get('/weight-entries/series/', { params })
	});
}

export function useWeightHeatmap(days = 84) {
	return useQuery({
		queryKey: ['weight-entries', 'heatmap', days],
		queryFn: () => get('/weight-entries/heatmap/', { params: { days } })
	});
}

export function useBodyComposition() {
	return useQuery({
		queryKey: ['body-composition'],
		queryFn: () => get('/body-composition/')
	});
}

export function useCalorieSummary(days = 14) {
	return useQuery({
		queryKey: ['body-composition', 'calories', days],
		queryFn: () => get('/calorie-summary/', { params: { days } })
	});
}

/**
 * Measurements feed the Navy body-fat estimate, so any write has to drop the
 * derived composition cache alongside the measurement list.
 */
export function useMeasurementMutations() {
	const qc = useQueryClient();
	const invalidate = () => {
		qc.invalidateQueries({ queryKey: ['body-measurements'] });
		qc.invalidateQueries({ queryKey: ['body-composition'] });
	};
	return {
		create: measurementsApi.useCreate({ onSuccess: invalidate }),
		remove: measurementsApi.useRemove({ onSuccess: invalidate })
	};
}

export function useLogWeight() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body) => post('/weight-entries/', body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['weight-entries'] });
			qc.invalidateQueries({ queryKey: ['weight-profile'] });
			qc.invalidateQueries({ queryKey: ['body-composition'] });
			qc.invalidateQueries({ queryKey: ['dashboard'] });
			toast.success('Weight logged.');
		},
		onError: (err) => {
			const data = err?.response?.data;
			const msg =
				data?.date?.[0] || data?.weight_input?.[0] || data?.detail || 'Could not log weight.';
			toast.error(typeof msg === 'string' ? msg : 'Could not log weight.');
		}
	});
}

// -----------------------------------------------------------------------------
// Fitness profile
// -----------------------------------------------------------------------------

export function useFitnessProfile() {
	return useQuery({ queryKey: ['profile'], queryFn: () => get('/auth/profile/') });
}

export function useUpdateFitnessProfile() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (body) => patch('/auth/profile/', body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['profile'] });
			qc.invalidateQueries({ queryKey: ['body-composition'] });
			qc.invalidateQueries({ queryKey: ['dashboard'] });
			toast.success('Training profile saved.');
		},
		onError: () => toast.error('Could not save training profile.')
	});
}

// -----------------------------------------------------------------------------
// Dashboard & notifications
// -----------------------------------------------------------------------------

export function useDashboard() {
	const localDate = useLocalCalendarDate();
	return useQuery({ queryKey: ['dashboard', localDate], queryFn: () => get('/dashboard/') });
}

export function useTrainingInsights() {
	return useQuery({
		queryKey: ['training', 'insights'],
		queryFn: () => get('/intelligence/insights/')
	});
}

export function useTimeline(days = 180) {
	return useQuery({
		queryKey: ['training', 'timeline', days],
		queryFn: () => get('/intelligence/timeline/', { params: { days } })
	});
}

export function useMarkAllRead() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: () => post('/notifications/mark-all-read/'),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] })
	});
}

export function useMarkRead() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id) => post(`/notifications/${id}/read/`),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] })
	});
}
