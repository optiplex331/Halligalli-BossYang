import { useCallback, useEffect, useRef } from "react";

export type FeedbackKind = "flip" | "tick" | "go" | "ring" | "success" | "warn" | "penalty";

interface ToneOptions {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  gain: number;
  delay?: number;
  glideTo?: number;
}

type AudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

type AudioSessionNavigator = Navigator & {
  audioSession?: { type: string };
};

const UNLOCK_EVENTS = ["pointerup", "touchend", "click", "keydown"] as const;

// Phone speakers barely reproduce anything below ~500 Hz, so every cue keeps
// its fundamental in the audible band and relies on the master compressor
// rather than tiny per-tone gains for loudness.
export function useAudioEngine(soundEnabled: boolean) {
  const contextRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const enabledRef = useRef(soundEnabled);
  enabledRef.current = soundEnabled;

  const unlock = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;

    if (!contextRef.current) {
      const AudioContextClass = window.AudioContext || (window as AudioWindow).webkitAudioContext;
      if (!AudioContextClass) return null;

      // iOS routes Web Audio through the "ambient" session by default, which the
      // ring/silent switch mutes. A game cue should behave like media playback.
      const session = (navigator as AudioSessionNavigator).audioSession;
      if (session) {
        try {
          session.type = "playback";
        } catch {
          // Older WebKit exposes the object without a writable type.
        }
      }

      const context = new AudioContextClass({ latencyHint: "interactive" });
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 4;
      const master = context.createGain();
      master.gain.value = 0.9;
      master.connect(compressor);
      compressor.connect(context.destination);
      contextRef.current = context;
      masterRef.current = master;
    }

    const context = contextRef.current;
    if (context.state !== "running") {
      // "suspended" before the first gesture, "interrupted" on iOS after a call
      // or app switch. Both recover only from inside a user gesture.
      context.resume().catch(() => {});
      // Legacy WebKit only unlocks after a buffer starts during the gesture.
      const silent = context.createBufferSource();
      silent.buffer = context.createBuffer(1, 1, 22_050);
      silent.connect(context.destination);
      silent.start(0);
    }

    return context;
  }, []);

  useEffect(() => {
    if (!soundEnabled) return;

    function onGesture(): void {
      const context = unlock();
      if (context?.state === "running") {
        UNLOCK_EVENTS.forEach((name) => window.removeEventListener(name, onGesture, true));
      }
    }

    UNLOCK_EVENTS.forEach((name) => window.addEventListener(name, onGesture, true));
    return () => UNLOCK_EVENTS.forEach((name) => window.removeEventListener(name, onGesture, true));
  }, [soundEnabled, unlock]);

  const playTone = useCallback((context: AudioContext, options: ToneOptions) => {
    const master = masterRef.current;
    if (!master) return;

    const { frequency, duration, type = "sine", gain, delay = 0, glideTo } = options;
    const startAt = context.currentTime + 0.005 + delay;
    const endAt = startAt + duration;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    if (glideTo) oscillator.frequency.exponentialRampToValueAtTime(glideTo, endAt);
    envelope.gain.setValueAtTime(0.0001, startAt);
    envelope.gain.exponentialRampToValueAtTime(gain, startAt + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(startAt);
    oscillator.stop(endAt + 0.02);
  }, []);

  const playNoise = useCallback((context: AudioContext, duration: number, gain: number) => {
    const master = masterRef.current;
    if (!master) return;

    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 3;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 2_400;
    filter.Q.value = 0.8;
    envelope.gain.value = gain;
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(master);
    source.start();
  }, []);

  const play = useCallback(
    (kind: FeedbackKind, force = false) => {
      if (!force && !enabledRef.current) return;
      const context = unlock();
      if (!context) return;

      const schedule = () => {
        switch (kind) {
          case "flip":
            playNoise(context, 0.05, 0.35);
            return;
          case "tick":
            playTone(context, { frequency: 880, duration: 0.09, type: "triangle", gain: 0.28 });
            return;
          case "go":
            playTone(context, { frequency: 1_320, duration: 0.22, type: "triangle", gain: 0.32 });
            playTone(context, { frequency: 1_760, duration: 0.18, type: "sine", gain: 0.12, delay: 0.02 });
            return;
          case "ring":
            // Desk-bell partials: fundamental plus the inharmonic 2.76x overtone.
            playTone(context, { frequency: 1_568, duration: 0.9, type: "sine", gain: 0.34 });
            playTone(context, { frequency: 3_136, duration: 0.45, type: "sine", gain: 0.1 });
            playTone(context, { frequency: 4_328, duration: 0.3, type: "sine", gain: 0.07 });
            return;
          case "success":
            playTone(context, { frequency: 1_047, duration: 0.12, type: "triangle", gain: 0.26, delay: 0.06 });
            playTone(context, { frequency: 1_319, duration: 0.12, type: "triangle", gain: 0.26, delay: 0.14 });
            playTone(context, { frequency: 1_568, duration: 0.26, type: "triangle", gain: 0.3, delay: 0.22 });
            return;
          case "warn":
            playTone(context, { frequency: 740, duration: 0.14, type: "triangle", gain: 0.3 });
            playTone(context, { frequency: 587, duration: 0.2, type: "triangle", gain: 0.3, delay: 0.14 });
            return;
          case "penalty":
            playTone(context, { frequency: 440, glideTo: 220, duration: 0.38, type: "sawtooth", gain: 0.2, delay: 0.04 });
            playTone(context, { frequency: 660, glideTo: 330, duration: 0.3, type: "square", gain: 0.08, delay: 0.04 });
            return;
        }
      };

      if (context.state === "running") {
        schedule();
      } else {
        context.resume().then(schedule).catch(() => {});
      }
    },
    [playNoise, playTone, unlock],
  );

  const playFeedback = useCallback((kind: FeedbackKind) => play(kind), [play]);
  const previewSound = useCallback(() => play("ring", true), [play]);

  useEffect(() => () => {
    contextRef.current?.close().catch(() => {});
    contextRef.current = null;
    masterRef.current = null;
  }, []);

  return { playFeedback, previewSound };
}
