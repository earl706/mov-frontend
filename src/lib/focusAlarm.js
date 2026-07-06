let audioCtx = null;
let alarmInterval = null;
let alarmTimeout = null;

export const FOCUS_ALARM_MAX_MS = 30000;
export const DEFAULT_FOCUS_ALARM_SOUND = 'chime';

export const FOCUS_ALARM_SOUNDS = [
	{ id: 'chime', label: 'Chime', description: 'Classic four-note chime' },
	{ id: 'bell', label: 'Bell', description: 'Warm bell tones' },
	{ id: 'digital', label: 'Digital', description: 'Sharp electronic beeps' },
	{ id: 'soft', label: 'Soft', description: 'Gentle rising notes' },
	{ id: 'urgent', label: 'Urgent', description: 'Fast repeating alert' }
];

const ALARM_REPEAT_MS = {
	chime: 2200,
	bell: 2400,
	digital: 1800,
	soft: 2800,
	urgent: 1600
};

function getAudioContext() {
	if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	return audioCtx;
}

function tone(ctx, when, freq, { duration = 0.35, type = 'sine', volume = 1.0 } = {}) {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = type;
	osc.frequency.value = freq;
	gain.gain.setValueAtTime(0.0001, when);
	gain.gain.exponentialRampToValueAtTime(volume, when + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
	osc.connect(gain);
	gain.connect(ctx.destination);
	osc.start(when);
	osc.stop(when + duration);
}

const ALARM_PATTERNS = {
	chime: (ctx, t) => {
		[880, 880, 1100, 880].forEach((freq, i) => tone(ctx, t + i * 0.45, freq));
	},
	bell: (ctx, t) => {
		[523, 659, 784].forEach((freq, i) =>
			tone(ctx, t + i * 0.55, freq, { type: 'triangle', duration: 0.6, volume: 0.24 })
		);
	},
	digital: (ctx, t) => {
		[1200, 1200, 1200].forEach((freq, i) =>
			tone(ctx, t + i * 0.2, freq, { type: 'square', duration: 0.12, volume: 0.14 })
		);
	},
	soft: (ctx, t) => {
		[440, 554, 659, 880].forEach((freq, i) =>
			tone(ctx, t + i * 0.5, freq, { duration: 0.5, volume: 0.2 })
		);
	},
	urgent: (ctx, t) => {
		[1400, 1000, 1400, 1000].forEach((freq, i) =>
			tone(ctx, t + i * 0.15, freq, { duration: 0.12, volume: 0.22 })
		);
	}
};

function resolveSoundId(soundId) {
	return ALARM_PATTERNS[soundId] ? soundId : DEFAULT_FOCUS_ALARM_SOUND;
}

export function playFocusAlarmSound(soundId = DEFAULT_FOCUS_ALARM_SOUND) {
	try {
		const ctx = getAudioContext();
		if (ctx.state === 'suspended') ctx.resume();
		const play = ALARM_PATTERNS[resolveSoundId(soundId)];
		play(ctx, ctx.currentTime);
	} catch {
		/* audio blocked or unavailable */
	}
}

export function previewFocusAlarmSound(soundId) {
	playFocusAlarmSound(soundId);
}

export function playFocusAlarm(soundId) {
	playFocusAlarmSound(soundId);
}

export function startFocusAlarm(soundId = DEFAULT_FOCUS_ALARM_SOUND, onEnd) {
	stopFocusAlarm();
	const id = resolveSoundId(soundId);
	const repeatMs = ALARM_REPEAT_MS[id] ?? ALARM_REPEAT_MS.chime;

	playFocusAlarmSound(id);
	alarmInterval = window.setInterval(() => playFocusAlarmSound(id), repeatMs);
	alarmTimeout = window.setTimeout(() => {
		stopFocusAlarm();
		onEnd?.();
	}, FOCUS_ALARM_MAX_MS);
}

export function stopFocusAlarm() {
	if (alarmInterval != null) window.clearInterval(alarmInterval);
	if (alarmTimeout != null) window.clearTimeout(alarmTimeout);
	alarmInterval = null;
	alarmTimeout = null;
}
