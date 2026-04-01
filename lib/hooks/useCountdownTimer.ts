"use client";
import { useEffect, useState, useRef } from "react";

export function useCountdownTimer(timerEnd: Date | null): {
  timeLeft: number;
  percentage: number;
  isExpired: boolean;
  isCritical: boolean;
} {
  const [timeLeft, setTimeLeft] = useState(0);
  const [percentage, setPercentage] = useState(100);
  const rafRef = useRef<number>(0);
  const totalRef = useRef<number>(0);

  useEffect(() => {
    if (!timerEnd) {
      setTimeLeft(0);
      setPercentage(0);
      return;
    }

    const endMs = timerEnd.getTime();
    const startMs = Date.now();
    totalRef.current = Math.max(0, endMs - startMs);

    function tick() {
      const remaining = Math.max(0, endMs - Date.now());
      setTimeLeft(remaining);
      const pct = totalRef.current > 0 ? (remaining / totalRef.current) * 100 : 0;
      setPercentage(Math.min(100, pct));
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [timerEnd]);

  const seconds = Math.ceil(timeLeft / 1000);
  return {
    timeLeft: seconds,
    percentage,
    isExpired: timeLeft <= 0,
    isCritical: seconds <= 5 && seconds > 0,
  };
}
