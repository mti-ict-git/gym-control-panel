/**
 * Rekam kegagalan grant akses gym secara live.
 *
 * Buffer /api/gym-access-log cuma memuat 200 event (~2 menit, karena dibanjiri
 * always_allow), jadi kejadian saat jam sesi hilang sebelum sempat dilihat. Script ini
 * polling terus-menerus dan menyimpan event penting (attempt/grant/fail/error/success/
 * prune) ke file, sudah di-dedup, supaya bisa dianalisa setelah sesi selesai.
 *
 * Usage:
 *   node backend/scripts/monitor-grant-failures.js [menit=720] [outfile]
 */
const BASE = process.env.GYM_MONITOR_BASE || 'https://mti-gym.merdekabattery.com';
const minutes = Number(process.argv[2] || 720);
const outFile = process.argv[3] || 'backend/_grant_monitor.log';
const POLL_MS = 20000;
const IGNORE = new Set(['always_allow', 'worker_tick_start', 'worker_tick_end']);

const fs = await import('node:fs');
const seen = new Set();
const stop = Date.now() + minutes * 60_000;
let polls = 0;
let kept = 0;

const stamp = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 19).replace('T', ' ');
const write = (line) => { fs.appendFileSync(outFile, line + '\n', 'utf-8'); };

write(`\n===== MONITOR MULAI ${stamp()} WITA (durasi ${minutes} menit) =====`);

const tick = async () => {
  polls += 1;
  try {
    const r = await fetch(`${BASE}/api/gym-access-log`, { signal: AbortSignal.timeout(15000) });
    const j = await r.json();
    for (const e of j.events || []) {
      if (IGNORE.has(e.type)) continue;
      const key = `${e.t}|${e.type}|${e.employee_id || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      kept += 1;
      const wita = new Date(new Date(e.t).getTime() + 8 * 3600_000).toISOString().slice(11, 19);
      const bits = [
        wita + ' WITA',
        String(e.type).toUpperCase().padEnd(8),
        'emp=' + (e.employee_id || '-'),
        e.card_no ? 'card=' + e.card_no : '',
        e.tz ? 'tz=' + e.tz : '',
        e.error ? 'ERROR="' + e.error + '"' : '',
      ].filter(Boolean);
      write(bits.join(' '));
    }
  } catch (err) {
    write(`${stamp()} WITA  [monitor] poll gagal: ${err.message}`);
  }
  if (Date.now() < stop) setTimeout(tick, POLL_MS);
  else write(`===== MONITOR SELESAI ${stamp()} WITA | ${polls} polling, ${kept} event direkam =====`);
};

tick();
