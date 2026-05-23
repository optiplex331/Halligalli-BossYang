interface TimerRef {
  current: number | null;
}

interface GameLoopHandles {
  revealIntervalRef: TimerRef;
  countdownIntervalRef: TimerRef;
  feedbackTimeoutRef: TimerRef;
  penaltyTimeoutRef: TimerRef;
  bossTauntTimeoutRef: TimerRef;
  startupTimeoutRef: TimerRef;
}

function clearIntervalRef(ref: TimerRef) {
  if (ref.current !== null) {
    window.clearInterval(ref.current);
  }
}

function clearTimeoutRef(ref: TimerRef) {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
  }
}

export function clearGameLoopHandles(handles: GameLoopHandles): void {
  const {
    revealIntervalRef,
    countdownIntervalRef,
    feedbackTimeoutRef,
    penaltyTimeoutRef,
    bossTauntTimeoutRef,
    startupTimeoutRef,
  } = handles;

  clearIntervalRef(revealIntervalRef);
  clearIntervalRef(countdownIntervalRef);
  clearTimeoutRef(feedbackTimeoutRef);
  clearTimeoutRef(penaltyTimeoutRef);
  clearTimeoutRef(bossTauntTimeoutRef);
  clearTimeoutRef(startupTimeoutRef);
}
