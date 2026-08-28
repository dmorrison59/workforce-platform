export interface DayWindow {
  start: string;
  end: string;
  day: string;
}

function offsetMinutes(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const part of dtf.formatToParts(at)) parts[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((asUtc - at.getTime()) / 60000);
}

export function zonedMidnight(timeZone: string, day: string): Date {
  const guess = new Date(`${day}T00:00:00Z`);
  const first = offsetMinutes(timeZone, guess);
  let instant = new Date(guess.getTime() - first * 60000);
  const check = offsetMinutes(timeZone, instant);
  if (check !== first) instant = new Date(guess.getTime() - check * 60000);
  return instant;
}

export function orgDayWindow(timeZone: string, now: Date): DayWindow {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const nextDay = new Date(new Date(`${day}T00:00:00Z`).getTime() + 86400000)
    .toISOString()
    .slice(0, 10);
  return {
    start: zonedMidnight(timeZone, day).toISOString(),
    end: zonedMidnight(timeZone, nextDay).toISOString(),
    day,
  };
}