import { useEffect, useState } from 'react';

function getTimeLeft(targetDate) {
  const targetTime = new Date(targetDate).getTime();
  const distance = Math.max(targetTime - Date.now(), 0);

  return {
    days: Math.floor(distance / (1000 * 60 * 60 * 24)),
    hours: Math.floor((distance / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((distance / (1000 * 60)) % 60),
    seconds: Math.floor((distance / 1000) % 60),
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
