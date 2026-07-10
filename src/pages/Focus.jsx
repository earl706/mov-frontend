import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
	BellOff,
	Coffee,
	Pause,
	Play,
	RotateCcw,
	SkipForward,
	Timer,
	Volume2,
	VolumeX,
	Zap
} from 'lucide-react';

import { FOCUS_ALARM_MAX_MS, FOCUS_ALARM_SOUNDS, previewFocusAlarmSound } from '../lib/focusAlarm';
import { cn } from '../lib/format';
import { FOCUS_TECHNIQUES, getPhaseLabel, isStructuredTechnique } from '../lib/focusTechniques';
import {
	clampTimerDigits,
	digitsToSeconds,
	formatTimerHms,
	secondsToDigits
} from '../lib/focusTimerFormat';
import { formatDurationSeconds, minutesToHours } from '../lib/format';
import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardBody, CardHeader, Input, ProgressRing, Select, Button } from '../components/ui';
import { focusApi, habitsApi, tasksApi, useFocusToday } from '../lib/resources';
import { selectIntervalActive, selectOnBreak, useFocusTimerStore } from '../stores/focusTimerStore';
import { toast } from '../stores/toastStore';

const QUICK_ADD = [
	{ label: '+0:30', seconds: 30 },
	{ label: '+1:00', seconds: 60 },
	{ label: '+5:00', seconds: 300 }
];

const RING_SIZE = 280;

function TimerDigits({ digits, editable, focused, cursor, onSelectDigit }) {
	return (
		<div className="text-fg/75 flex items-center justify-center font-mono text-3xl font-light tracking-tight tabular-nums sm:text-4xl">
			{[0, 1, 2, 3, 4, 5].map((i) => (
				<span key={i} className="inline-flex items-center">
					{(i === 2 || i === 4) && (
						<span className="text-muted/50 mx-1 px-0.5 select-none" aria-hidden="true">
							:
						</span>
					)}
					<span
						role={editable ? 'button' : undefined}
						tabIndex={editable ? -1 : undefined}
						onClick={editable ? () => onSelectDigit(i) : undefined}
						className={`inline-block min-w-[0.62em] text-center ${editable ? 'cursor-pointer' : ''} ${
							editable && focused && cursor === i ? 'bg-primary/15 rounded-md' : ''
						}`}
					>
						{digits[i]}
					</span>
				</span>
			))}
		</div>
	);
}

function TimerDisplayInput({ seconds, editable, onCommit }) {
	const wrapRef = useRef(null);
	const [focused, setFocused] = useState(false);
	const [digits, setDigits] = useState(() => secondsToDigits(seconds));
	const [cursor, setCursor] = useState(0);

	useEffect(() => {
		if (!focused) setDigits(secondsToDigits(seconds));
	}, [seconds, focused]);

	const commit = () => {
		setFocused(false);
		onCommit(digitsToSeconds(digits));
	};

	const setDigitAt = (index, value) => {
		const next = [...digits];
		next[index] = value;
		setDigits(clampTimerDigits(next));
	};

	const handleKeyDown = (e) => {
		if (!editable) return;
		if (e.key >= '0' && e.key <= '9') {
			e.preventDefault();
			setDigitAt(cursor, Number(e.key));
			setCursor((c) => Math.min(5, c + 1));
			return;
		}
		if (e.key === 'Backspace') {
			e.preventDefault();
			if (cursor > 0) {
				setDigitAt(cursor - 1, 0);
				setCursor((c) => c - 1);
			} else {
				setDigitAt(0, 0);
			}
			return;
		}
		if (e.key === 'Delete') {
			e.preventDefault();
			setDigitAt(cursor, 0);
			return;
		}
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			setCursor((c) => Math.max(0, c - 1));
			return;
		}
		if (e.key === 'ArrowRight') {
			e.preventDefault();
			setCursor((c) => Math.min(5, c + 1));
			return;
		}
		if (e.key === 'Enter') {
			e.preventDefault();
			wrapRef.current?.blur();
		}
	};

	const displayDigits = editable ? digits : secondsToDigits(seconds);

	const digitProps = {
		digits: displayDigits,
		editable,
		focused,
		cursor,
		onSelectDigit: (i) => {
			setCursor(i);
			wrapRef.current?.focus();
		}
	};

	if (!editable) {
		return (
			<div className="w-full text-center">
				<TimerDigits {...digitProps} />
			</div>
		);
	}

	return (
		<div
			ref={wrapRef}
			tabIndex={0}
			role="textbox"
			aria-label="Timer duration"
			aria-valuetext={formatTimerHms(digitsToSeconds(digits))}
			onFocus={() => {
				setFocused(true);
				setDigits(secondsToDigits(seconds));
			}}
			onBlur={commit}
			onKeyDown={handleKeyDown}
			className="w-full outline-none"
		>
			<TimerDigits {...digitProps} />
		</div>
	);
}

function FocusTimerStage({
	seconds,
	editable,
	progress,
	running,
	sessionActive,
	interruptions,
	phaseLabel,
	isBreak,
	onCommit
}) {
	const ringTone = isBreak
		? running
			? 'success'
			: 'warning'
		: sessionActive
			? running
				? 'primary'
				: 'warning'
			: 'primary';

	return (
		<motion.div
			animate={running ? { scale: [1, 1.012, 1] } : { scale: 1 }}
			transition={{ repeat: running ? Infinity : 0, duration: 2 }}
			className="relative flex shrink-0 items-center justify-center"
			style={{ width: RING_SIZE, height: RING_SIZE }}
		>
			<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
				<ProgressRing value={progress} size={RING_SIZE} stroke={7} label="" tone={ringTone} />
			</div>
			<div className="relative z-10 flex w-full flex-col items-center gap-2 px-8 text-center">
				<TimerDisplayInput seconds={seconds} editable={editable} onCommit={onCommit} />
				{sessionActive ? (
					<p className="text-muted text-sm">
						{isBreak
							? `${running ? 'Resting' : 'Break paused'}${phaseLabel ? ` · ${phaseLabel}` : ''}`
							: `${running ? 'Focusing' : 'Paused'} · ${interruptions} interruption${interruptions === 1 ? '' : 's'}`}
					</p>
				) : phaseLabel ? (
					<p className="text-muted text-sm">{phaseLabel}</p>
				) : (
					<p className="text-muted/60 text-sm">Set focus duration</p>
				)}
			</div>
		</motion.div>
	);
}

function FocusAlarmOverlay({ onDismiss, onStopSound, startedAt, breakAlarm, startsBreak }) {
	const [secondsLeft, setSecondsLeft] = useState(Math.ceil(FOCUS_ALARM_MAX_MS / 1000));

	useEffect(() => {
		if (!startedAt) return;
		const tick = () => {
			setSecondsLeft(Math.max(0, Math.ceil((startedAt + FOCUS_ALARM_MAX_MS - Date.now()) / 1000)));
		};
		tick();
		const id = window.setInterval(tick, 250);
		return () => window.clearInterval(id);
	}, [startedAt]);

	const nextStep = breakAlarm
		? 'start your next focus round'
		: startsBreak
			? 'start your break'
			: 'finish';
	const soundHint = secondsLeft > 0 ? `Sound stops in ${secondsLeft}s. ` : 'Sound stopped. ';
	const hint = `${soundHint}Stop the alarm to ${nextStep}.`;

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			className="bg-surface/95 absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl px-6 text-center backdrop-blur-sm"
		>
			<p className="text-fg text-lg font-semibold">{breakAlarm ? 'Break over!' : "Time's up!"}</p>
			<p className="text-muted mt-1 text-sm">{hint}</p>
			<div className="mt-5 flex flex-wrap items-center justify-center gap-2">
				<Button variant="ghost" onClick={onStopSound}>
					<VolumeX size={16} />
					Stop sound
				</Button>
				<Button onClick={onDismiss}>
					<BellOff size={16} />
					Stop alarm
				</Button>
			</div>
		</motion.div>
	);
}

function FocusSessionSettings({
	techniqueId,
	onTechniqueChange,
	alarmSound,
	onAlarmChange,
	disabled,
	pomodoroCount,
	technique,
	attachmentType,
	onAttachmentTypeChange,
	attachedHabitId,
	onHabitChange,
	attachedTaskId,
	onTaskChange,
	sessionLabel,
	onSessionLabelChange,
	habits,
	tasks
}) {
	return (
		<Card>
			<CardHeader title="Session settings" />
			<CardBody className="space-y-4">
				<div>
					<p className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">Link to</p>
					<div className="mb-2 grid grid-cols-3 gap-1.5">
						{[
							{ id: 'none', label: 'None' },
							{ id: 'habit', label: 'Habit' },
							{ id: 'task', label: 'Task' }
						].map((item) => {
							const selected = attachmentType === item.id;
							return (
								<button
									key={item.id}
									type="button"
									disabled={disabled}
									onClick={() => onAttachmentTypeChange(item.id)}
									className={cn(
										'cursor-pointer rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors disabled:cursor-default',
										selected
											? 'border-primary bg-primary/10 text-primary'
											: 'border-line text-fg hover:bg-surface-2',
										disabled && 'opacity-60'
									)}
								>
									{item.label}
								</button>
							);
						})}
					</div>
					{attachmentType === 'habit' && (
						<Select
							value={attachedHabitId ?? ''}
							onChange={(e) => {
								const id = e.target.value ? Number(e.target.value) : null;
								const habit = habits.find((h) => h.id === id) || null;
								onHabitChange(habit);
							}}
							disabled={disabled}
						>
							<option value="">Choose a habit…</option>
							{habits.map((h) => (
								<option key={h.id} value={h.id}>
									{h.name}
								</option>
							))}
						</Select>
					)}
					{attachmentType === 'task' && (
						<Select
							value={attachedTaskId ?? ''}
							onChange={(e) => {
								const id = e.target.value ? Number(e.target.value) : null;
								const task = tasks.find((t) => t.id === id) || null;
								onTaskChange(task);
							}}
							disabled={disabled}
						>
							<option value="">Choose a task…</option>
							{tasks.map((t) => (
								<option key={t.id} value={t.id}>
									{t.title}
								</option>
							))}
						</Select>
					)}
					{attachmentType === 'none' && (
						<Input
							placeholder="Optional session label"
							value={sessionLabel}
							onChange={(e) => onSessionLabelChange(e.target.value)}
							disabled={disabled}
						/>
					)}
					{attachmentType === 'habit' && attachedHabitId && (
						<p className="text-muted mt-2 text-[11px]">
							Completing a focus round checks in this habit and logs duration for today.
						</p>
					)}
					{attachmentType === 'task' && attachedTaskId && (
						<p className="text-muted mt-2 text-[11px]">
							Starting sets the task to in progress; each focus round adds to its logged time.
						</p>
					)}
				</div>

				<div>
					<p className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">
						Technique
					</p>
					<div className="grid grid-cols-2 gap-1.5">
						{FOCUS_TECHNIQUES.map((item) => {
							const selected = techniqueId === item.id;
							return (
								<button
									key={item.id}
									type="button"
									disabled={disabled}
									title={item.description}
									onClick={() => onTechniqueChange(item.id)}
									className={cn(
										'cursor-pointer rounded-lg border px-2.5 py-2 text-left transition-colors disabled:cursor-default',
										selected
											? 'border-primary bg-primary/10 text-primary'
											: 'border-line text-fg hover:bg-surface-2',
										disabled && 'opacity-60'
									)}
								>
									<span className="block text-xs leading-tight font-medium">{item.label}</span>
								</button>
							);
						})}
					</div>
					{isStructuredTechnique(techniqueId) && technique?.cyclesBeforeLongBreak && (
						<p className="text-muted mt-2 text-center text-[11px]">
							{pomodoroCount}/{technique.cyclesBeforeLongBreak} rounds · long break next
						</p>
					)}
				</div>

				<div>
					<p className="text-muted mb-2 text-[11px] font-medium tracking-wide uppercase">Alarm</p>
					<div className="grid grid-cols-3 gap-1.5">
						{FOCUS_ALARM_SOUNDS.map((sound) => {
							const selected = alarmSound === sound.id;
							return (
								<div
									key={sound.id}
									className={cn(
										'relative rounded-lg border transition-colors',
										selected ? 'border-primary bg-primary/10' : 'border-line',
										disabled ? 'opacity-60' : 'hover:bg-surface-2'
									)}
								>
									<button
										type="button"
										disabled={disabled}
										title={sound.description}
										onClick={() => onAlarmChange(sound.id)}
										className={cn(
											'w-full cursor-pointer px-2 py-2 pr-6 text-left text-xs leading-tight font-medium disabled:cursor-default',
											selected ? 'text-primary' : 'text-fg'
										)}
									>
										{sound.label}
									</button>
									<button
										type="button"
										disabled={disabled}
										onClick={() => previewFocusAlarmSound(sound.id)}
										className="text-muted hover:text-primary absolute top-1/2 right-1 -translate-y-1/2 cursor-pointer rounded p-0.5 transition-colors disabled:cursor-default"
										aria-label={`Preview ${sound.label}`}
									>
										<Volume2 size={12} />
									</button>
								</div>
							);
						})}
					</div>
				</div>
			</CardBody>
		</Card>
	);
}

export default function FocusPage() {
	const running = useFocusTimerStore((s) => s.running);
	const remainingSeconds = useFocusTimerStore((s) => s.remainingSeconds);
	const totalSeconds = useFocusTimerStore((s) => s.totalSeconds);
	const interruptions = useFocusTimerStore((s) => s.interruptions);
	const sessionActive = useFocusTimerStore(selectIntervalActive);
	const onBreak = useFocusTimerStore(selectOnBreak);
	const techniqueId = useFocusTimerStore((s) => s.techniqueId);
	const phase = useFocusTimerStore((s) => s.phase);
	const pomodoroCount = useFocusTimerStore((s) => s.pomodoroCount);
	const start = useFocusTimerStore((s) => s.start);
	const pause = useFocusTimerStore((s) => s.pause);
	const reset = useFocusTimerStore((s) => s.reset);
	const skipBreak = useFocusTimerStore((s) => s.skipBreak);
	const setDurationSeconds = useFocusTimerStore((s) => s.setDurationSeconds);
	const setTechnique = useFocusTimerStore((s) => s.setTechnique);
	const addDuration = useFocusTimerStore((s) => s.addDuration);
	const alarmActive = useFocusTimerStore((s) => s.alarmActive);
	const alarmStartedAt = useFocusTimerStore((s) => s.alarmStartedAt);
	const alarmCompletedPhase = useFocusTimerStore((s) => s.alarmCompletedPhase);
	const pendingAfterAlarm = useFocusTimerStore((s) => s.pendingAfterAlarm);
	const resolveAfterAlarm = useFocusTimerStore((s) => s.resolveAfterAlarm);
	const stopAlarmSound = useFocusTimerStore((s) => s.stopAlarmSound);
	const alarmSound = useFocusTimerStore((s) => s.alarmSound);
	const setAlarmSound = useFocusTimerStore((s) => s.setAlarmSound);
	const attachmentType = useFocusTimerStore((s) => s.attachmentType);
	const attachedHabitId = useFocusTimerStore((s) => s.attachedHabitId);
	const attachedTaskId = useFocusTimerStore((s) => s.attachedTaskId);
	const sessionLabel = useFocusTimerStore((s) => s.sessionLabel);
	const setAttachmentType = useFocusTimerStore((s) => s.setAttachmentType);
	const setAttachedHabit = useFocusTimerStore((s) => s.setAttachedHabit);
	const setAttachedTask = useFocusTimerStore((s) => s.setAttachedTask);
	const setSessionLabel = useFocusTimerStore((s) => s.setSessionLabel);

	const technique = FOCUS_TECHNIQUES.find((t) => t.id === techniqueId);
	const phaseLabel = getPhaseLabel(phase, techniqueId, pomodoroCount);
	const structured = isStructuredTechnique(techniqueId);

	const { data: today } = useFocusToday();
	const { data: sessionData } = focusApi.useList({ page_size: 5 });
	const { data: habitData } = habitsApi.useList({ is_active: true, page_size: 100 });
	const { data: taskData } = tasksApi.useList({ page_size: 100 });
	const sessions = sessionData?.results || [];
	const habits = (habitData?.results || []).filter((h) => h.is_active !== false);
	const tasks = (taskData?.results || []).filter((t) => t.status !== 'done');

	const pct = totalSeconds > 0 ? 100 - (remainingSeconds / totalSeconds) * 100 : 0;
	const canEditDuration = !running && !sessionActive && !structured;
	const canStart = remainingSeconds > 0;
	const breakAlarm = alarmCompletedPhase === 'break';
	const startsBreak = pendingAfterAlarm === 'start_break';

	const handleAlarmDismiss = () => {
		const action = resolveAfterAlarm();
		if (action === 'start_break') {
			const phaseAfter = useFocusTimerStore.getState().phase;
			const breakLabel = phaseAfter === 'long_break' ? 'Long break' : 'Short break';
			toast.success(`${breakLabel} started — rest up.`);
		} else if (action === 'start_focus') {
			toast.success(`${technique?.label ?? 'Focus'} — focus round started.`);
		}
	};

	return (
		<div>
			<PageHeader
				title="Focus"
				icon={Timer}
				description="Deep work, measured. Timer keeps running as you navigate."
			/>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<Card className="relative py-10 lg:col-span-2">
					{alarmActive && (
						<FocusAlarmOverlay
							onDismiss={handleAlarmDismiss}
							onStopSound={stopAlarmSound}
							startedAt={alarmStartedAt}
							breakAlarm={breakAlarm}
							startsBreak={startsBreak}
						/>
					)}
					<CardBody className="flex flex-col items-center gap-8 py-12">
						<FocusTimerStage
							seconds={remainingSeconds}
							editable={canEditDuration}
							progress={sessionActive ? pct : 0}
							running={running}
							sessionActive={sessionActive}
							interruptions={interruptions}
							phaseLabel={phaseLabel}
							isBreak={onBreak}
							onCommit={setDurationSeconds}
						/>

						{canEditDuration && (
							<div className="flex flex-wrap justify-center gap-3">
								{QUICK_ADD.map(({ label, seconds: delta }) => (
									<button
										key={label}
										type="button"
										onClick={() => addDuration(delta)}
										className="bg-surface-2 text-fg hover:bg-line cursor-pointer rounded-full px-5 py-2 text-sm font-medium transition-colors"
									>
										{label}
									</button>
								))}
							</div>
						)}

						<div className="flex items-center justify-center">
							{sessionActive ? (
								<div className="bg-surface-2 flex items-center gap-1 rounded-full p-1">
									{running ? (
										<button
											type="button"
											onClick={pause}
											className={cn(
												'flex h-12 cursor-pointer items-center gap-2 rounded-full px-5 text-sm font-medium text-white shadow-sm',
												onBreak ? 'bg-success' : 'bg-warning'
											)}
											aria-label={onBreak ? 'Pause break timer' : 'Pause focus timer'}
										>
											<Pause size={18} />
											Pause
										</button>
									) : (
										<button
											type="button"
											onClick={start}
											className={cn(
												'flex h-12 cursor-pointer items-center gap-2 rounded-full px-5 text-sm font-medium shadow-sm',
												onBreak ? 'bg-success text-white' : 'bg-primary text-primary-fg'
											)}
											aria-label={onBreak ? 'Resume break timer' : 'Resume focus timer'}
										>
											<Play size={18} className="ml-0.5" />
											Play
										</button>
									)}
									{onBreak && (
										<button
											type="button"
											onClick={skipBreak}
											className="text-muted hover:text-fg flex h-12 cursor-pointer items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors"
											aria-label="Skip break"
										>
											<SkipForward size={18} />
											Skip
										</button>
									)}
									<button
										type="button"
										onClick={reset}
										className="text-muted hover:text-fg flex h-12 cursor-pointer items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors"
										aria-label="Reset timer"
									>
										<RotateCcw size={18} />
										Reset
									</button>
								</div>
							) : (
								<button
									type="button"
									onClick={start}
									disabled={!canStart}
									className="bg-primary text-primary-fg shadow-primary/30 flex h-14 cursor-pointer items-center gap-2 rounded-full px-8 text-sm font-medium shadow-lg disabled:cursor-default disabled:opacity-40"
									aria-label={onBreak ? 'Start break' : 'Start focus timer'}
								>
									{onBreak ? <Coffee size={20} /> : <Play size={20} className="ml-0.5" />}
									{onBreak ? 'Start break' : 'Play'}
								</button>
							)}
						</div>
					</CardBody>
				</Card>

				<div className="space-y-4">
					<Card>
						<CardHeader title="Today" />
						<CardBody className="flex items-center gap-4">
							<ProgressRing value={today?.progress ?? 0} size={72} tone="success" />
							<div>
								<p className="text-fg text-2xl font-semibold">
									{formatDurationSeconds(today?.seconds ?? (today?.minutes ?? 0) * 60)}
								</p>
								<p className="text-muted text-sm">
									of {minutesToHours(today?.goal_minutes ?? 120)} goal
								</p>
							</div>
						</CardBody>
					</Card>

					<FocusSessionSettings
						techniqueId={techniqueId}
						onTechniqueChange={setTechnique}
						alarmSound={alarmSound}
						onAlarmChange={setAlarmSound}
						disabled={sessionActive || alarmActive}
						pomodoroCount={pomodoroCount}
						technique={technique}
						attachmentType={attachmentType}
						onAttachmentTypeChange={setAttachmentType}
						attachedHabitId={attachedHabitId}
						onHabitChange={setAttachedHabit}
						attachedTaskId={attachedTaskId}
						onTaskChange={setAttachedTask}
						sessionLabel={sessionLabel}
						onSessionLabelChange={setSessionLabel}
						habits={habits}
						tasks={tasks}
					/>

					<Card>
						<CardHeader title="Recent sessions" />
						<CardBody>
							{sessions.length === 0 ? (
								<p className="text-muted text-sm">No sessions yet today.</p>
							) : (
								<div className="grid grid-cols-5 gap-1.5">
									{sessions.map((s) => {
										const title = s.habit_name || s.task_title || s.label || 'Focus';
										return (
											<div
												key={s.id}
												className="bg-surface-2 flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-center"
												title={title}
											>
												<Zap size={14} className="text-primary shrink-0" />
												<span className="text-fg text-xs leading-tight font-semibold tabular-nums">
													{formatDurationSeconds(s.actual_seconds ?? s.actual_minutes * 60)}
												</span>
											</div>
										);
									})}
								</div>
							)}
						</CardBody>
					</Card>
				</div>
			</div>
		</div>
	);
}
