export function envTrim(value) {
  const s = value == null ? '' : String(value);
  const t = s.trim();
  return t.length > 0 ? t : '';
}

export function envBool(value, defaultValue) {
  const v = value == null ? undefined : String(value).toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return !!defaultValue;
}

export function envInt(value, defaultValue) {
  const v = envTrim(value);
  if (!v) return defaultValue;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

export function startOfDayUtcDateForOffsetMinutes(offsetMinutes) {
  const off = Number.isFinite(offsetMinutes) ? offsetMinutes : 0;
  const nowUtcMs = Date.now();
  const inOffset = new Date(nowUtcMs + off * 60_000);
  return new Date(Date.UTC(inOffset.getUTCFullYear(), inOffset.getUTCMonth(), inOffset.getUTCDate()));
}
