import { useCallback, useEffect, useRef, useState } from "react";

const BELL_PRESS_MS = 250;

/** Short pressed-state pulse for the table bell button. */
export function useBellPress(): [pressed: boolean, press: () => void] {
  const [pressed, setPressed] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const press = useCallback(() => {
    setPressed(true);
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      timeoutRef.current = null;
      setPressed(false);
    }, BELL_PRESS_MS);
  }, []);

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
  }, []);

  return [pressed, press];
}
