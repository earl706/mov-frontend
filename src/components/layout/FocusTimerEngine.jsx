import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BellOff, VolumeX } from 'lucide-react';
import { startFocusAlarm } from '../../lib/focusAlarm';
import { getTechnique, isStructuredTechnique } from '../../lib/focusTechniques';
import { formatDurationSeconds } from '../../lib/format';
import { focusApi, useSetTaskStatus } from '../../lib/resources';
import { useFocusTimerStore } from '../../stores/focusTimerStore';
import { toast } from '../../stores/toastStore';
import { Button } from '../ui';

function buildSessionBody(payload) {
	const plannedSeconds = Math.max(0, Math.floor(Number(payload.plannedSeconds) || 0));
	const actualSeconds = Math.max(0, Math.floor(Number(payload.actualSeconds) || 0));
	const plannedMinutes = Math.floor(plannedSeconds / 60);
	const actualMinutes = Math.floor(actualSeconds / 60);
	const endedAt = new Date();
	const startedAt =
		payload.startedAt ||
		new Date(
			endedAt.getTime() - Math.max(1, actualSeconds || plannedSeconds || 1) * 1000
		).toISOString();
	const body = {
		started_at: startedAt,
		ended_at: endedAt.toISOString(),
		planned_minutes: plannedMinutes,
		actual_minutes: actualMinutes,
		planned_seconds: plannedSeconds,
		actual_seconds: actualSeconds,
		interruptions: payload.interruptions,
		quality: payload.interruptions > 3 ? 2 : payload.interruptions > 1 ? 3 : 5
	};

	if (payload.attachmentType === 'habit' && payload.attachedHabitId) {
		body.habit = payload.attachedHabitId;
		body.task = null;
		body.label = payload.attachedHabitName;
	} else if (payload.attachmentType === 'task' && payload.attachedTaskId) {
		body.habit = null;
		body.task = payload.attachedTaskId;
		body.label = payload.attachedTaskTitle;
	} else if (payload.sessionLabel?.trim()) {
		body.habit = null;
		body.task = null;
		body.label = payload.sessionLabel.trim();
	} else {
		body.habit = null;
		body.task = null;
	}

	const tech = getTechnique(payload.techniqueId);
	if (!body.label) {
		body.label = isStructuredTechnique(payload.techniqueId)
			? `${tech.label} · focus`
			: 'Focus session';
	}

	return body;
}

function withoutLink(body) {
	return {
		...body,
		task: null,
		habit: null
	};
}

function getApiErrorDetail(error) {
	return (
		error?.response?.data?.detail ||
		error?.response?.data?.non_field_errors?.[0] ||
		error?.response?.data?.started_at?.[0] ||
		error?.response?.data?.task?.[0] ||
		error?.response?.data?.habit?.[0] ||
		error?.response?.data?.label?.[0]
	);
}

function shouldRetryWithoutLink(error) {
	if (error?.response?.status !== 400) return false;
	const detail = getApiErrorDetail(error);
	if (!detail) return true;
	return /task|habit|link|pk|exist|not found/i.test(String(detail));
}

function toastAfterAlarm(action) {
	if (action === 'start_break') {
		const { phase } = useFocusTimerStore.getState();
		const breakLabel = phase === 'long_break' ? 'Long break' : 'Short break';
		toast.success(`${breakLabel} started — rest up.`);
		return;
	}
	if (action === 'start_focus') {
		const tech = getTechnique(useFocusTimerStore.getState().techniqueId);
		toast.success(`${tech.label} — focus round started.`);
	}
}

export function FocusTimerEngine() {
	const syncTick = useFocusTimerStore((s) => s.syncTick);
	const startAlarm = useFocusTimerStore((s) => s.startAlarm);
	const resolveAfterAlarm = useFocusTimerStore((s) => s.resolveAfterAlarm);
	const stopAlarmSound = useFocusTimerStore((s) => s.stopAlarmSound);
	const alarmActive = useFocusTimerStore((s) => s.alarmActive);
	const alarmCompletedPhase = useFocusTimerStore((s) => s.alarmCompletedPhase);
	const pendingAfterAlarm = useFocusTimerStore((s) => s.pendingAfterAlarm);
	const pendingTaskStart = useFocusTimerStore((s) => s.pendingTaskStart);
	const attachedTaskId = useFocusTimerStore((s) => s.attachedTaskId);
	const clearPendingTaskStart = useFocusTimerStore((s) => s.clearPendingTaskStart);
	const { pathname } = useLocation();
	const onFocusPage = pathname === '/focus';
	const create = focusApi.useCreate();
	const setTaskStatus = useSetTaskStatus();
	const qc = useQueryClient();
	const finishingRef = useRef(false);

	useEffect(() => {
		if (!pendingTaskStart || !attachedTaskId) return;
		clearPendingTaskStart();
		setTaskStatus.mutate({ id: attachedTaskId, status: 'in_progress' });
	}, [pendingTaskStart, attachedTaskId, clearPendingTaskStart, setTaskStatus]);

	const handleAlarmDismiss = () => {
		const action = resolveAfterAlarm();
		toastAfterAlarm(action);
	};

	const finishFocusPhase = async () => {
		if (finishingRef.current) return;
		finishingRef.current = true;
		try {
			const state = useFocusTimerStore.getState();
			const structured = isStructuredTechnique(state.techniqueId);
			const payload = state.getSessionPayload();
			const body = buildSessionBody(payload);
			try {
				await create.mutateAsync(body);
			} catch (error) {
				if (!shouldRetryWithoutLink(error)) throw error;
				await create.mutateAsync(withoutLink(body));
				toast.success('Session logged without linked item (invalid task/habit reference).');
			}

			useFocusTimerStore.setState({
				pendingAfterAlarm: structured ? 'start_break' : 'finish_free'
			});
			startAlarm('focus');
			startFocusAlarm(state.alarmSound);

			const linkLabel =
				payload.attachmentType === 'habit'
					? payload.attachedHabitName
					: payload.attachmentType === 'task'
						? payload.attachedTaskTitle
						: null;
			const suffix = linkLabel ? ` on ${linkLabel}` : '';
			toast.success(`Logged ${formatDurationSeconds(payload.actualSeconds)} of focus${suffix}.`);

			qc.invalidateQueries({ queryKey: ['focus'] });
			qc.invalidateQueries({ queryKey: ['dashboard'] });
			qc.invalidateQueries({ queryKey: ['habits'] });
			qc.invalidateQueries({ queryKey: ['tasks'] });
		} catch (error) {
			toast.error(getApiErrorDetail(error) || 'Could not log focus session.');
		} finally {
			finishingRef.current = false;
		}
	};

	const finishBreakPhase = () => {
		if (finishingRef.current) return;
		finishingRef.current = true;
		try {
			useFocusTimerStore.setState({ pendingAfterAlarm: 'start_focus' });
			startAlarm('break');
			startFocusAlarm('soft');
		} finally {
			finishingRef.current = false;
		}
	};

	const onIntervalEnd = () => {
		const { techniqueId, phase } = useFocusTimerStore.getState();
		if (isStructuredTechnique(techniqueId) && phase !== 'focus') {
			finishBreakPhase();
		} else {
			finishFocusPhase();
		}
	};

	const onIntervalEndRef = useRef(onIntervalEnd);
	onIntervalEndRef.current = onIntervalEnd;

	useEffect(() => {
		const state = useFocusTimerStore.getState();
		if (state.running && state.endAt != null && state.endAt <= Date.now()) {
			onIntervalEndRef.current();
		} else if (state.running) {
			syncTick();
		}
	}, [syncTick]);

	useEffect(() => {
		const id = window.setInterval(() => {
			if (syncTick()) onIntervalEndRef.current();
		}, 250);
		return () => window.clearInterval(id);
	}, [syncTick]);

	const breakAlarm = alarmCompletedPhase === 'break';
	const alarmTitle = breakAlarm ? 'Break finished' : 'Focus timer finished';
	const alarmHint = breakAlarm
		? 'Stop the alarm to start your next focus round.'
		: pendingAfterAlarm === 'start_break'
			? 'Stop the alarm to start your break.'
			: 'Stop the alarm to continue.';

	return alarmActive && !onFocusPage ? (
		<div className="fixed bottom-6 left-1/2 z-50 w-[min(100%,24rem)] -translate-x-1/2 px-4 sm:px-0">
			<div className="border-line bg-surface flex flex-col gap-3 rounded-2xl border px-4 py-3 shadow-xl sm:flex-row sm:items-center">
				<div className="min-w-0 flex-1">
					<p className="text-fg text-sm font-medium">{alarmTitle}</p>
					<p className="text-muted mt-0.5 text-xs">{alarmHint}</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					<Button size="sm" variant="ghost" onClick={stopAlarmSound}>
						<VolumeX size={15} />
						Stop sound
					</Button>
					<Button size="sm" onClick={handleAlarmDismiss}>
						<BellOff size={15} />
						Stop alarm
					</Button>
				</div>
			</div>
		</div>
	) : null;
}
