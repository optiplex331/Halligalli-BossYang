import { useCallback, useEffect, useRef } from "react";

export function useAudioEngine(soundEnabled) {
  const contextRef = useRef(null);
  const enabledRef = useRef(soundEnabled);

  useEffect(() => {
    enabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const ensureUnlocked = useCallback(() => {
    if (typeof window === "undefined" || !enabledRef.current) {
      return null;
    }

    if (!contextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return null;
      }
      contextRef.current = new AudioContextClass();
    }

    if (contextRef.current.state === "suspended") {
      contextRef.current.resume().catch(() => {});
    }

    return contextRef.current;
  }, []);

  const playTone = useCallback(
    ({ frequency, duration = 0.12, type = "sine", gain = 0.04, delay = 0 }) => {
      const context = ensureUnlocked();
      if (!context) {
        return;
      }

      const schedule = () => {
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        const startAt = context.currentTime + delay;
        const endAt = startAt + duration;

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, startAt);
        gainNode.gain.setValueAtTime(0.0001, startAt);
        gainNode.gain.exponentialRampToValueAtTime(gain, startAt + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.start(startAt);
        oscillator.stop(endAt);
      };

      if (context.state === "running") {
        schedule();
      } else {
        context.resume().then(schedule).catch(() => {});
      }
    },
    [ensureUnlocked],
  );

  const playFeedback = useCallback(
    (kind) => {
      if (!enabledRef.current) {
        return;
      }

      if (kind === "success") {
        playTone({ frequency: 740, duration: 0.08, type: "triangle", gain: 0.035 });
        playTone({ frequency: 988, duration: 0.12, type: "triangle", gain: 0.04, delay: 0.08 });
        return;
      }

      if (kind === "warn") {
        playTone({ frequency: 360, duration: 0.12, type: "sine", gain: 0.03 });
        playTone({ frequency: 300, duration: 0.14, type: "sine", gain: 0.028, delay: 0.12 });
        return;
      }

      if (kind === "penalty") {
        playTone({ frequency: 220, duration: 0.12, type: "sawtooth", gain: 0.035 });
        playTone({ frequency: 180, duration: 0.14, type: "sawtooth", gain: 0.035, delay: 0.1 });
        playTone({ frequency: 140, duration: 0.18, type: "sawtooth", gain: 0.04, delay: 0.22 });
      }
    },
    [playTone],
  );

  return { playFeedback, ensureUnlocked };
}
