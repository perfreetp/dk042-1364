import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDateTime(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatSlaRemaining(
  deadline: string,
  warnHours: number,
  dangerHours: number,
): { text: string; level: 'safe' | 'warn' | 'danger' } {
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs <= 0) {
    const absMs = Math.abs(diffMs);
    const absHours = Math.floor(absMs / (1000 * 60 * 60));
    const absMinutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
    let text = '';
    if (absHours > 0) {
      text = `超时 ${absHours}h${absMinutes > 0 ? absMinutes + 'm' : ''}`;
    } else {
      text = `超时 ${absMinutes}m`;
    }
    return { text, level: 'danger' };
  }

  let level: 'safe' | 'warn' | 'danger' = 'safe';
  if (diffHours <= dangerHours) {
    level = 'danger';
  } else if (diffHours <= warnHours) {
    level = 'warn';
  }

  let text = '';
  if (diffHours >= 1) {
    const wholeHours = Math.floor(diffHours);
    const minutes = Math.round((diffHours - wholeHours) * 60);
    if (minutes >= 60) {
      text = `${wholeHours + 1}h`;
    } else if (minutes === 0) {
      text = `${wholeHours}h`;
    } else {
      text = `${wholeHours}h${minutes}m`;
    }
  } else {
    const minutes = Math.ceil(diffHours * 60);
    text = `${minutes}m`;
  }

  return { text, level };
}

export function calculateChangeRate(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export function formatConfidence(value: number): string {
  const clamped = Math.max(0, Math.min(1, value));
  return `${Math.round(clamped * 100)}%`;
}
