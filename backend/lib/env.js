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
