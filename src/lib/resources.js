import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from './api';
import { createResourceHooks } from '../hooks/useResource';
import { useLocalCalendarDate } from '../hooks/useLocalCalendarDate';
import { toast } from '../stores/toastStore';

export const projectsApi = createResourceHooks('projects', '/projects/');
export const tasksApi = createResourceHooks('tasks', '/tasks/');
export const subtasksApi = createResourceHooks('subtasks', '/subtasks/');
export const habitsApi = createResourceHooks('habits', '/habits/');
export const eventsApi = createResourceHooks('events', '/events/');
export const focusApi = createResourceHooks('focus-sessions', '/focus-sessions/');
export const notificationsApi = createResourceHooks('notifications', '/notifications/');

export function useProjectHealth(id) {
	return useQuery({
		queryKey: ['projects', 'health', id],
		queryFn: () => get(`/projects/${id}/health/`),
		enabled: id != null
	});
}
export function usePrioritizedTasks() {
	return useQuery({
		queryKey: ['tasks', 'prioritized'],
		queryFn: () => get('/tasks/prioritized/')
	});
}
export function useSetTaskStatus() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, status }) => post(`/tasks/${id}/set-status/`, { status }),
		onMutate: async ({ id, status }) => {
			await qc.cancelQueries({ queryKey: ['tasks'] });
			const snapshots = qc.getQueriesData({ queryKey: ['tasks'] });
			snapshots.forEach(([key, data]) => {
				if (!data?.results) return;
				qc.setQueryData(key, {
					...data,
					results: data.results.map((t) => (t.id === id ? { ...t, status } : t))
				});
			});
			return { snapshots };
		},
		onError: (_e, _v, ctx) => {
			ctx?.snapshots?.forEach(([k, d]) => qc.setQueryData(k, d));
			toast.error('Could not update task.');
		},
		onSettled: () => qc.invalidateQueries({ queryKey: ['tasks'] })
	});
}
export function useDecomposeTask() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: (id) => post(`/tasks/${id}/decompose/`),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['tasks'] });
			toast.success('Task broken into subtasks.');
		},
		onError: () => toast.error('Could not decompose task.')
	});
}
export function useHabitCheckIn() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({ id, undo }) => post(`/habits/${id}/${undo ? 'undo' : 'check-in'}/`),
		onSuccess: () => qc.invalidateQueries({ queryKey: ['habits'] }),
		onError: () => toast.error('Could not update habit.')
	});
}
export function useDashboard() {
	return useQuery({ queryKey: ['dashboard'], queryFn: () => get('/dashboard/') });
}
export function usePatterns() {
	return useQuery({
		queryKey: ['intelligence', 'patterns'],
		queryFn: () => get('/intelligence/patterns/')
	});
}
export function useTimeline(days = 180) {
	return useQuery({
		queryKey: ['intelligence', 'timeline', days],
		queryFn: () => get('/intelligence/timeline/', { params: { days } })
	});
}
export function useFocusToday() {
	const localDate = useLocalCalendarDate();
	return useQuery({
		queryKey: ['focus', 'today', localDate],
		queryFn: () => get('/focus-sessions/today/')
	});
}
export function useSessionRecovery() {
	return useQuery({ queryKey: ['focus', 'recover'], queryFn: () => get('/work-context/recover/') });
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
