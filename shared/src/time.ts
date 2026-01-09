export const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
export const ONE_HOUR_MS = 60 * 60 * 1000;
export const ONE_DAY_MS = 24 * ONE_HOUR_MS;

export function toUtcDate(input: string | Date | number): Date {
  return new Date(input);
}

export function alignTickBoundary(date: Date): Date {
  const utc = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    0,
    0,
    0
  ));
  const hour = utc.getUTCHours();
  const remainder = hour % 6;
  if (remainder === 0) {
    return utc;
  }
  const alignedHour = hour - remainder;
  return new Date(Date.UTC(
    utc.getUTCFullYear(),
    utc.getUTCMonth(),
    utc.getUTCDate(),
    alignedHour,
    0,
    0,
    0
  ));
}

export function tickWithBuffer(date: Date, bufferMinutes = 5): Date {
  const boundary = alignTickBoundary(date);
  return new Date(boundary.getTime() + bufferMinutes * 60 * 1000);
}

export function nextTickBoundary(date: Date): Date {
  const boundary = alignTickBoundary(date);
  if (date.getTime() === boundary.getTime()) {
    return boundary;
  }
  return new Date(boundary.getTime() + SIX_HOURS_MS);
}

export function bucketEndTime(ts: Date, timeframe: '6h' | '1d'): Date {
  const utc = new Date(Date.UTC(
    ts.getUTCFullYear(),
    ts.getUTCMonth(),
    ts.getUTCDate(),
    ts.getUTCHours(),
    0,
    0,
    0
  ));
  if (timeframe === '6h') {
    const hour = utc.getUTCHours();
    const remainder = hour % 6;
    const bucketHour = hour - remainder + (remainder === 0 ? 0 : 6);
    if (bucketHour === 24) {
      return new Date(Date.UTC(
        utc.getUTCFullYear(),
        utc.getUTCMonth(),
        utc.getUTCDate() + 1,
        0,
        0,
        0,
        0
      ));
    }
    return new Date(Date.UTC(
      utc.getUTCFullYear(),
      utc.getUTCMonth(),
      utc.getUTCDate(),
      bucketHour,
      0,
      0,
      0
    ));
  }

  const endDay = new Date(Date.UTC(
    utc.getUTCFullYear(),
    utc.getUTCMonth(),
    utc.getUTCDate(),
    0,
    0,
    0,
    0
  ));
  if (utc.getUTCHours() === 0) {
    return endDay;
  }
  return new Date(Date.UTC(
    utc.getUTCFullYear(),
    utc.getUTCMonth(),
    utc.getUTCDate() + 1,
    0,
    0,
    0,
    0
  ));
}
