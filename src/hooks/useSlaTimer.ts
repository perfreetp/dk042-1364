import { useState, useEffect } from 'react';
import * as utils from '@/utils';

export type SlaLevel = 'safe' | 'warn' | 'danger';

export interface SlaTimerResult {
  text: string;
  level: SlaLevel;
}

export function useSlaTimer(
  deadline: string,
  warnHours: number,
  dangerHours: number,
  intervalMs: number = 1000,
): SlaTimerResult {
  const [result, setResult] = useState<SlaTimerResult>(() =>
    utils.formatSlaRemaining(deadline, warnHours, dangerHours),
  );

  useEffect(() => {
    setResult(utils.formatSlaRemaining(deadline, warnHours, dangerHours));

    const timer = setInterval(() => {
      setResult(utils.formatSlaRemaining(deadline, warnHours, dangerHours));
    }, intervalMs);

    return () => clearInterval(timer);
  }, [deadline, warnHours, dangerHours, intervalMs]);

  return result;
}

export default useSlaTimer;
