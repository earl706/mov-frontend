import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { BellOff } from 'lucide-react';
import { startFocusAlarm } from '../../lib/focusAlarm';
import { getTechnique, isStructuredTechnique } from '../../lib/focusTechniques';
import { formatDurationSeconds } from '../../lib/format';
import { focusApi, useSetTaskStatus } from '../../lib/resources';
import { useFocusTimerStore } from '../../stores/focusTimerStore';
import { toast } from '../../stores/toastStore';
import { Button } from '../ui';

function buildSessionBody(payload) {
	const body = {
		started_at: payload.startedAt,
		ended_at: new Date().toISOString(),
		planned_minutes: payload.plannedMinutes,
		actual_minutes: payload.actualMinutes,
		planned_seconds: payload.plannedSeconds,
		actual_seconds: payload.actualSeconds,
		interruptions: payload.interruptions,
		quality: payload.interruptions > 3 ? 2 : payload.interruptions > 1 ? 3 : 5
	};

	if (payload.attachmentType === 'habit' && payload.attachedHabitId) {
		body.habit = payload.attachedHabitId;
		body.label = payload.attachedHabitName;
	} else if (payload.attachmentType === 'task' && payload.attachedTaskId) {
		body.task = payload.attachedTaskId;
		body.label = payload.attachedTaskTitle;
	} else if (payload.sessionLabel?.trim()) {
		body.label = payload.sessionLabel.trim();
	}

	const tech = getTechnique(payload.techniqueId);
	if (!body.label) {
		body.label = isStructuredTechnique(payload.techniqueId)
			? `${tech.label} · focus`
			: 'Focus session';
	}

	return body;
}

export function FocusTimerEngine() {
	const syncTick = useFocusTimerStore((s) => s.syncTick);
	const clearAfterFinish = useFocusTimerStore((s) => s.clearAfterFinish);
	const advanceToBreak = useFocusTimerStore((s) => s.advanceToBreak);
	const advanceToFocus = useFocusTimerStore((s) => s.advanceToFocus);
	const startAlarm = useFocusTimerStore((s) => s.startAlarm);
	const dismissAlarm = useFocusTimerStore((s) => s.dismissAlarm);
	const alarmActive = useFocusTimerStore((s) => s.alarmActive);
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

	const finishFocusPhase = async () => {
		if (finishingRef.current) return;
		finishingRef.current = true;
		try {
			const state = useFocusTimerStore.getState();
			startAlarm();
			startFocusAlarm(state.alarmSound, () => dismissAlarm());

			const payload = state.getSessionPayload();
			const body = buildSessionBody(payload);
			await create.mutateAsync(body);

			const linkLabel =
				payload.attachmentType === 'habit'
					? payload.attachedHabitName
					: payload.attachmentType === 'task'
						? payload.attachedTaskTitle
						: null;
			const suffix = linkLabel ? ` on ${linkLabel}` : '';
			toast.success(`Logged ${formatDurationSeconds(payload.actualSeconds)} of focus${suffix}.`);

			if (isStructuredTechnique(state.techniqueId)) {
				advanceToBreak();
				const next = useFocusTimerStore.getState();
				const breakLabel = next.phase === 'long_break' ? 'Long break' : 'Short break';
				toast.success(`${breakLabel} started — rest up.`);
			} else {
				clearAfterFinish();
			}

			qc.invalidateQueries({ queryKey: ['focus'] });
			qc.invalidateQueries({ queryKey: ['dashboard'] });
			qc.invalidateQueries({ queryKey: ['habits'] });
			qc.invalidateQueries({ queryKey: ['tasks'] });
		} catch {
			toast.error('Could not log focus session.');
		} finally {
			finishingRef.current = false;
		}
	};

	const finishBreakPhase = () => {
		if (finishingRef.current) return;
		finishingRef.current = true;
		try {
			startAlarm();
			startFocusAlarm('soft', () => dismissAlarm());
			advanceToFocus();
			const tech = getTechnique(useFocusTimerStore.getState().techniqueId);
			toast.success(`${tech.label} — ready for your next focus round.`);
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

	const phase = useFocusTimerStore((s) => s.phase);
	const alarmTitle =
		phase === 'long_break' || phase === 'short_break' ? 'Break finished' : 'Focus timer finished';

	return alarmActive && !onFocusPage ? (
		<div className="fixed bottom-6 left-1/2 z-50 w-[min(100%,24rem)] -translate-x-1/2 px-4 sm:px-0">
			<div className="border-line bg-surface flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl">
				<p className="text-fg min-w-0 flex-1 text-sm font-medium">{alarmTitle}</p>
				<Button size="sm" onClick={dismissAlarm}>
					<BellOff size={15} />
					Dismiss
				</Button>
			</div>
		</div>
	) : null;
}
