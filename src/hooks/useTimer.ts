import { useEffect, useCallback, useRef } from 'react';
import { useSessionStore } from '@/store/sessionStore';

interface UseTimerOptions {
  onComplete?: () => void;
  autoStart?: boolean;
}

export function useTimer(duration: number, options: UseTimerOptions = {}) {
  const { onComplete, autoStart = false } = options;
  const intervalRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);

  const {
    timerSeconds,
    timerActive,
    setTimer,
    decrementTimer,
    setTimerActive,
  } = useSessionStore();

  // Keep onComplete ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Initialize timer
  useEffect(() => {
    if (duration > 0) {
      setTimer(duration);
      if (autoStart) {
        setTimerActive(true);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [duration, autoStart, setTimer, setTimerActive]);

  // Timer tick effect
  useEffect(() => {
    if (timerActive && timerSeconds > 0) {
      intervalRef.current = window.setInterval(() => {
        decrementTimer();
      }, 1000);
    } else if (timerSeconds === 0 && timerActive) {
      setTimerActive(false);
      onCompleteRef.current?.();
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timerActive, timerSeconds, decrementTimer, setTimerActive]);

  const start = useCallback(() => {
    setTimerActive(true);
  }, [setTimerActive]);

  const pause = useCallback(() => {
    setTimerActive(false);
  }, [setTimerActive]);

  const reset = useCallback(() => {
    setTimerActive(false);
    setTimer(duration);
  }, [duration, setTimer, setTimerActive]);

  const restart = useCallback(() => {
    setTimer(duration);
    setTimerActive(true);
  }, [duration, setTimer, setTimerActive]);

  return {
    seconds: timerSeconds,
    isActive: timerActive,
    isComplete: timerSeconds === 0 && !timerActive,
    start,
    pause,
    reset,
    restart,
  };
}
