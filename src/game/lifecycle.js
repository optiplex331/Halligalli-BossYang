export function clearGameLoopHandles(handles) {
  const {
    revealIntervalRef,
    countdownIntervalRef,
    feedbackTimeoutRef,
    penaltyTimeoutRef,
    bossTauntTimeoutRef,
    startupTimeoutRef,
  } = handles;

  window.clearInterval(revealIntervalRef.current);
  window.clearInterval(countdownIntervalRef.current);
  window.clearTimeout(feedbackTimeoutRef.current);
  window.clearTimeout(penaltyTimeoutRef.current);
  window.clearTimeout(bossTauntTimeoutRef.current);
  window.clearTimeout(startupTimeoutRef.current);
}
