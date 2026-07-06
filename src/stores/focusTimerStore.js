import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_FOCUS_ALARM_SOUND, stopFocusAlarm } from '../lib/focusAlarm';
import { hmsFromSeconds, secondsFromHms } from '../lib/focusTimerFormat';
import {
	FOCUS_TECHNIQUE_FREE,
	getBreakPhase,
	getBreakSeconds,
	getTechnique,
	isStructuredTechnique
} from '../lib/focusTechniques';

const DEFAULT_SECONDS = 25 * 60;

function applyDuration(set, total) {
	const hms = hmsFromSeconds(total);
	set({
		totalSeconds: total,
		remainingSeconds: total,
		inputHours: hms.hours,
		inputMinutes: hms.minutes,
		inputSeconds: hms.seconds
	});
}

export const useFocusTimerStore = create(
	persist(
		(set, get) => ({
			totalSeconds: DEFAULT_SECONDS,
			remainingSeconds: DEFAULT_SECONDS,
			running: false,
			endAt: null,
			startedAt: null,
			interruptions: 0,
			inputHours: 0,
			inputMinutes: 25,
			inputSeconds: 0,
			alarmActive: false,
			alarmStartedAt: null,
			alarmSound: DEFAULT_FOCUS_ALARM_SOUND,
			techniqueId: FOCUS_TECHNIQUE_FREE,
			phase: 'focus',
			pomodoroCount: 0,
			attachmentType: 'none',
			attachedHabitId: null,
			attachedHabitName: '',
			attachedTaskId: null,
			attachedTaskTitle: '',
			sessionLabel: '',
			pendingTaskStart: false,

			setAlarmSound: (alarmSound) => set({ alarmSound }),

			setAttachmentType: (attachmentType) => {
				const s = get();
				if (s.running || selectIntervalActive(s)) return;
				if (attachmentType === 'none') {
					set({
						attachmentType: 'none',
						attachedHabitId: null,
						attachedHabitName: '',
						attachedTaskId: null,
						attachedTaskTitle: ''
					});
					return;
				}
				set({
					attachmentType,
					sessionLabel: '',
					...(attachmentType === 'habit'
						? { attachedTaskId: null, attachedTaskTitle: '' }
						: { attachedHabitId: null, attachedHabitName: '' })
				});
			},

			setAttachedHabit: (habit) => {
				const s = get();
				if (s.running || selectIntervalActive(s)) return;
				if (!habit) {
					set({
						attachmentType: 'none',
						attachedHabitId: null,
						attachedHabitName: ''
					});
					return;
				}
				set({
					attachmentType: 'habit',
					attachedHabitId: habit.id,
					attachedHabitName: habit.name,
					attachedTaskId: null,
					attachedTaskTitle: '',
					sessionLabel: ''
				});
			},

			setAttachedTask: (task) => {
				const s = get();
				if (s.running || selectIntervalActive(s)) return;
				if (!task) {
					set({
						attachmentType: 'none',
						attachedTaskId: null,
						attachedTaskTitle: ''
					});
					return;
				}
				set({
					attachmentType: 'task',
					attachedTaskId: task.id,
					attachedTaskTitle: task.title,
					attachedHabitId: null,
					attachedHabitName: '',
					sessionLabel: ''
				});
			},

			setSessionLabel: (sessionLabel) => {
				const s = get();
				if (s.running || selectIntervalActive(s) || s.attachmentType !== 'none') return;
				set({ sessionLabel });
			},

			clearPendingTaskStart: () => set({ pendingTaskStart: false }),

			setTechnique: (techniqueId) => {
				const s = get();
				if (s.running || selectIntervalActive(s)) return;
				const tech = getTechnique(techniqueId);
				if (!isStructuredTechnique(techniqueId)) {
					set({ techniqueId: FOCUS_TECHNIQUE_FREE, phase: 'focus', pomodoroCount: 0 });
					return;
				}
				set({
					techniqueId,
					phase: 'focus',
					pomodoroCount: 0,
					running: false,
					endAt: null,
					startedAt: null,
					interruptions: 0
				});
				applyDuration(set, tech.focusSeconds);
			},

			startAlarm: () => set({ alarmActive: true, alarmStartedAt: Date.now() }),

			dismissAlarm: () => {
				stopFocusAlarm();
				set({ alarmActive: false, alarmStartedAt: null });
			},

			setDurationSeconds: (total) => {
				const s = get();
				if (s.running || selectIntervalActive(s) || isStructuredTechnique(s.techniqueId)) return;
				const capped = Math.min(99 * 3600 + 59 * 60 + 59, Math.max(0, Math.floor(total)));
				applyDuration(set, capped);
			},

			addDuration: (delta) => {
				const s = get();
				if (s.running || selectIntervalActive(s) || isStructuredTechnique(s.techniqueId)) return;
				get().setDurationSeconds(s.remainingSeconds + delta);
			},

			setInput: (field, raw) => {
				const s = get();
				if (s.running || selectIntervalActive(s) || isStructuredTechnique(s.techniqueId)) return;
				const max = field === 'inputHours' ? 99 : 59;
				const value = Math.max(0, Math.min(max, Number(raw) || 0));
				const next = { ...s, [field]: value };
				const total = secondsFromHms(next.inputHours, next.inputMinutes, next.inputSeconds);
				set({ [field]: value, totalSeconds: total, remainingSeconds: total });
			},

			applyPreset: (minutes) => {
				const s = get();
				if (s.running || isStructuredTechnique(s.techniqueId)) return;
				applyDuration(set, minutes * 60);
				set({
					running: false,
					endAt: null,
					startedAt: null,
					interruptions: 0,
					phase: 'focus',
					pomodoroCount: 0
				});
			},

			start: () => {
				const s = get();
				if (s.running) return;
				let remaining = s.remainingSeconds;
				if (remaining <= 0) {
					if (isStructuredTechnique(s.techniqueId) && s.phase === 'focus') {
						remaining = getTechnique(s.techniqueId).focusSeconds;
					} else {
						const total = secondsFromHms(s.inputHours, s.inputMinutes, s.inputSeconds);
						if (total <= 0) return;
						remaining = total;
					}
					applyDuration(set, remaining);
				}
				const now = Date.now();
				const isFocusPhase = s.phase === 'focus';
				const isFreshFocusStart = isFocusPhase && !s.startedAt;
				set({
					running: true,
					remainingSeconds: remaining,
					endAt: now + remaining * 1000,
					startedAt: isFocusPhase ? s.startedAt || new Date(now).toISOString() : null,
					pendingTaskStart:
						isFreshFocusStart && s.attachmentType === 'task' && Boolean(s.attachedTaskId)
				});
			},

			pause: () => {
				const s = get();
				if (!s.running) return;
				const remaining = s.endAt
					? Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000))
					: s.remainingSeconds;
				set({
					running: false,
					endAt: null,
					remainingSeconds: remaining,
					interruptions: isFocusPhase(s) ? s.interruptions + 1 : s.interruptions
				});
			},

			reset: () => {
				const s = get();
				const tech = getTechnique(s.techniqueId);
				const total = isStructuredTechnique(s.techniqueId)
					? tech.focusSeconds
					: s.totalSeconds ||
						secondsFromHms(s.inputHours, s.inputMinutes, s.inputSeconds) ||
						DEFAULT_SECONDS;
				applyDuration(set, total);
				set({
					running: false,
					endAt: null,
					startedAt: null,
					interruptions: 0,
					phase: 'focus',
					pomodoroCount: 0
				});
			},

			skipBreak: () => {
				const s = get();
				if (!isStructuredTechnique(s.techniqueId) || s.phase === 'focus') return;
				stopFocusAlarm();
				get().advanceToFocus();
			},

			advanceToBreak: () => {
				const s = get();
				const tech = getTechnique(s.techniqueId);
				if (!isStructuredTechnique(s.techniqueId)) return;

				const nextCount = s.pomodoroCount + 1;
				const breakSeconds = getBreakSeconds(tech, nextCount);
				const phase = getBreakPhase(tech, nextCount);
				const now = Date.now();

				applyDuration(set, breakSeconds);
				set({
					pomodoroCount: nextCount,
					phase,
					running: true,
					endAt: now + breakSeconds * 1000,
					startedAt: null,
					interruptions: 0
				});
			},

			advanceToFocus: () => {
				const s = get();
				const tech = getTechnique(s.techniqueId);
				if (!isStructuredTechnique(s.techniqueId)) return;

				applyDuration(set, tech.focusSeconds);
				set({
					phase: 'focus',
					running: false,
					endAt: null,
					startedAt: null,
					interruptions: 0,
					alarmActive: false,
					alarmStartedAt: null
				});
			},

			syncTick: () => {
				const s = get();
				if (!s.running || s.endAt == null) return false;
				const remaining = Math.max(0, Math.ceil((s.endAt - Date.now()) / 1000));
				if (remaining <= 0) {
					set({ running: false, endAt: null, remainingSeconds: 0 });
					return true;
				}
				if (remaining !== s.remainingSeconds) set({ remainingSeconds: remaining });
				return false;
			},

			getSessionPayload: () => {
				const s = get();
				const elapsed = Math.max(0, s.totalSeconds - s.remainingSeconds);
				const actualSeconds = elapsed || s.totalSeconds;
				return {
					startedAt: s.startedAt || new Date().toISOString(),
					plannedSeconds: s.totalSeconds,
					actualSeconds,
					plannedMinutes: Math.floor(s.totalSeconds / 60),
					actualMinutes: Math.floor(actualSeconds / 60),
					interruptions: s.interruptions,
					techniqueId: s.techniqueId,
					phase: s.phase,
					attachmentType: s.attachmentType,
					attachedHabitId: s.attachedHabitId,
					attachedHabitName: s.attachedHabitName,
					attachedTaskId: s.attachedTaskId,
					attachedTaskTitle: s.attachedTaskTitle,
					sessionLabel: s.sessionLabel
				};
			},

			clearAfterFinish: () => {
				const { inputHours, inputMinutes, inputSeconds } = get();
				const total = secondsFromHms(inputHours, inputMinutes, inputSeconds) || DEFAULT_SECONDS;
				applyDuration(set, total);
				set({
					running: false,
					endAt: null,
					startedAt: null,
					interruptions: 0,
					phase: 'focus',
					pomodoroCount: 0
				});
			},

			isBreakPhase: () => {
				const s = get();
				return isStructuredTechnique(s.techniqueId) && s.phase !== 'focus';
			}
		}),
		{
			name: 'mov-focus-timer',
			partialize: (s) => ({
				totalSeconds: s.totalSeconds,
				remainingSeconds: s.remainingSeconds,
				running: s.running,
				endAt: s.endAt,
				startedAt: s.startedAt,
				interruptions: s.interruptions,
				inputHours: s.inputHours,
				inputMinutes: s.inputMinutes,
				inputSeconds: s.inputSeconds,
				alarmSound: s.alarmSound,
				techniqueId: s.techniqueId,
				phase: s.phase,
				pomodoroCount: s.pomodoroCount,
				attachmentType: s.attachmentType,
				attachedHabitId: s.attachedHabitId,
				attachedHabitName: s.attachedHabitName,
				attachedTaskId: s.attachedTaskId,
				attachedTaskTitle: s.attachedTaskTitle,
				sessionLabel: s.sessionLabel
			})
		}
	)
);

function isFocusPhase(s) {
	return s.phase === 'focus';
}

export function selectFocusTimerActive(s) {
	return Boolean(s.startedAt) && s.remainingSeconds > 0;
}

export function selectIntervalActive(s) {
	if (s.remainingSeconds <= 0) return false;
	if (isStructuredTechnique(s.techniqueId) && s.phase !== 'focus') {
		return s.running || s.remainingSeconds < s.totalSeconds;
	}
	return Boolean(s.startedAt);
}

export function selectOnBreak(s) {
	return isStructuredTechnique(s.techniqueId) && s.phase !== 'focus';
}
