let audioCtx = null;
let alarmInterval = null;
let alarmTimeout = null;
/** Master fader for every oscillator. Stop disconnects it so in-flight notes die now. */
let outputGain = null;

/** An unattended alarm stops itself so a phone left on the bench goes quiet. */
export const WORKOUT_ALARM_MAX_MS = 60000;
export const DEFAULT_WORKOUT_ALARM_SOUND = 'bell';

export const WORKOUT_ALARM_SOUNDS = [
	{ id: 'chime', label: 'Chime', description: 'Bright two-tone alert (Google-style)' },
	{ id: 'bell', label: 'Bell', description: 'Warm bell tones' },
	{ id: 'digital', label: 'Digital', description: 'Sharp electronic beeps' },
	{ id: 'soft', label: 'Soft', description: 'Gentle rising notes' },
	{ id: 'urgent', label: 'Urgent', description: 'Fast repeating alert' }
];

const ALARM_REPEAT_MS = {
	chime: 1500,
	bell: 1800,
	digital: 1200,
	soft: 2000,
	urgent: 1100
};

function getAudioContext() {
	if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	return audioCtx;
}

function playOsc(ctx, when, freq, { duration, type, volume }) {
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = type;
	osc.frequency.value = freq;
	gain.gain.setValueAtTime(0.0001, when);
	gain.gain.exponentialRampToValueAtTime(volume, when + 0.02);
	gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
	osc.connect(gain);
	gain.connect(getOutput(ctx));
	osc.start(when);
	osc.stop(when + duration);
}

function getOutput(ctx) {
	if (!outputGain) {
		outputGain = ctx.createGain();
		outputGain.gain.value = 1;
		outputGain.connect(ctx.destination);
	}
	return outputGain;
}

/** Mute and drop the current graph so leftover notes cannot keep ringing. */
function cutAlarmAudio() {
	if (!outputGain) return;
	try {
		if (audioCtx) {
			const t = audioCtx.currentTime;
			outputGain.gain.cancelScheduledValues(t);
			outputGain.gain.setValueAtTime(0, t);
		}
		outputGain.disconnect();
	} catch {
		/* already disconnected */
	}
	outputGain = null;
}

function tone(ctx, when, freq, { duration = 0.5, type = 'sine', volume = 0.85 } = {}) {
	playOsc(ctx, when, freq, { duration, type, volume });
	// A quieter square at the same pitch adds punch without clipping a single oscillator.
	playOsc(ctx, when, freq, {
		duration: duration * 0.7,
		type: 'square',
		volume: Math.min(0.35, volume * 0.4)
	});
}

const ALARM_PATTERNS = {
	chime: (ctx, t) => {
		// Google-style two-burst ascending alert: E6–G#6 pairs with a bright metallic timbre
		const pairs = [
			[1319, 1568],
			[1319, 1568]
		];
		pairs.forEach(([lo, hi], burst) => {
			const offset = burst * 0.5;
			tone(ctx, t + offset, lo, { duration: 0.12, type: 'sine', volume: 0.9 });
			tone(ctx, t + offset + 0.15, hi, { duration: 0.12, type: 'sine', volume: 0.9 });
			// Metallic overtone layer
			playOsc(ctx, t + offset, lo * 2, { duration: 0.08, type: 'triangle', volume: 0.2 });
			playOsc(ctx, t + offset + 0.15, hi * 2, { duration: 0.08, type: 'triangle', volume: 0.2 });
		});
	},
	bell: (ctx, t) => {
		[523, 659, 784].forEach((freq, i) =>
			tone(ctx, t + i * 0.45, freq, { type: 'triangle', duration: 0.75, volume: 1.0 })
		);
	},
	digital: (ctx, t) => {
		[1200, 1200, 1400, 1200].forEach((freq, i) =>
			tone(ctx, t + i * 0.16, freq, { type: 'square', duration: 0.18, volume: 0.7 })
		);
	},
	soft: (ctx, t) => {
		[440, 554, 659, 880].forEach((freq, i) =>
			tone(ctx, t + i * 0.42, freq, { duration: 0.6, volume: 0.7 })
		);
	},
	urgent: (ctx, t) => {
		[1400, 1000, 1400, 1000, 1400, 1000].forEach((freq, i) =>
			tone(ctx, t + i * 0.12, freq, { duration: 0.14, volume: 0.85 })
		);
	}
};

function resolveSoundId(soundId) {
	return ALARM_PATTERNS[soundId] ? soundId : DEFAULT_WORKOUT_ALARM_SOUND;
}

export function playWorkoutAlarmSound(soundId = DEFAULT_WORKOUT_ALARM_SOUND) {
	try {
		const ctx = getAudioContext();
		if (ctx.state === 'suspended') ctx.resume();
		ALARM_PATTERNS[resolveSoundId(soundId)](ctx, ctx.currentTime);
	} catch {
		/* audio blocked or unavailable */
	}
}

export function previewWorkoutAlarmSound(soundId) {
	playWorkoutAlarmSound(soundId);
}

/**
 * Single blip used for hold completion. Set / exercise / rep rests use the
 * full repeating alarm instead.
 */
export function playRepCue() {
	try {
		const ctx = getAudioContext();
		if (ctx.state === 'suspended') ctx.resume();
		tone(ctx, ctx.currentTime, 1000, { duration: 0.18, type: 'square', volume: 0.45 });
	} catch {
		/* audio blocked or unavailable */
	}
}

export function startWorkoutAlarm(soundId = DEFAULT_WORKOUT_ALARM_SOUND) {
	stopWorkoutAlarm();
	const id = resolveSoundId(soundId);
	const repeatMs = ALARM_REPEAT_MS[id] ?? ALARM_REPEAT_MS.chime;

	playWorkoutAlarmSound(id);
	alarmInterval = window.setInterval(() => playWorkoutAlarmSound(id), repeatMs);
	alarmTimeout = window.setTimeout(stopWorkoutAlarm, WORKOUT_ALARM_MAX_MS);
}

export function stopWorkoutAlarm() {
	if (alarmInterval != null) window.clearInterval(alarmInterval);
	if (alarmTimeout != null) window.clearTimeout(alarmTimeout);
	alarmInterval = null;
	alarmTimeout = null;
	cutAlarmAudio();
}
