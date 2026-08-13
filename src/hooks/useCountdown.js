import { useEffect, useState } from 'react';

function splitDistance(distance) {
  return {
    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
    hours: Math.floor((distance / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((distance / (1000 * 60)) % 60),
    seconds: Math.floor((distance / 1000) % 60),
  };
}

function getTimeLeft(targetDate) {
  const target = new Date(targetDate);
  const weddingDayStart = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  ).getTime();
  const dayAfterWeddingStart = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate() + 1,
  ).getTime();
  const now = Date.now();

  if (now < weddingDayStart) {
    return {
      ...splitDistance(weddingDayStart - now),
      isAfterWeddingDay: false,
      isWeddingDay: false,
      phase: 'before',
    };
  }

  if (now < dayAfterWeddingStart) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isAfterWeddingDay: false,
      isWeddingDay: true,
      phase: 'weddingDay',
    };
  }

  return {
    ...splitDistance(now - dayAfterWeddingStart),
    isAfterWeddingDay: true,
    isWeddingDay: false,
    phase: 'after',
  };
}

export function useCountdown(targetDate) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(targetDate));

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [targetDate]);

  return timeLeft;
}
