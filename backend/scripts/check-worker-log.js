/**
 * Ambil log worker (in-memory access events) dari backend yang sedang berjalan,
 * lalu filter untuk satu karyawan. Read-only (GET /gym-access-log).
 *
 * Usage:
 *   node backend/scripts/check-worker-log.js http://10.60.10.xx:5055 MTI240576
 *   node backend/scripts/check-worker-log.js                # default localhost:5055, MTI240576
 */
const base = (process.argv[2] || 'http://localhost:5055').replace(/\/+$/, '');
const emp = (process.argv[3] || 'MTI240576').trim().toUpperCase();
const card = process.argv[4] || '1453472210';

const run = async () => {
  // Production serves the API under /api/...; bare /gym-access-log hits the SPA. Try /api first.
  const paths = ['/api/gym-access-log', '/gym-access-log'];
  console.log(`GET ${base}{${paths.join(',')}}  (filter: ${emp} / card ${card})\n`);
  let json;
  try {
    for (const path of paths) {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(`${base}${path}`, { signal: ctrl.signal });
      clearTimeout(to);
      const txt = await r.text();
      try { const j = JSON.parse(txt); if (j && Array.isArray(j.events)) { json = j; break; } } catch { /* HTML/SPA, try next */ }
    }
    if (!json) throw new Error('no JSON access-log endpoint responded');
  } catch (e) {
    console.log(`❌ Tidak bisa menjangkau backend di ${base} (${e.name === 'AbortError' ? 'timeout' : e.message}).`);
    console.log(`   Pastikan alamat & port backend benar dan bisa diakses dari mesin ini.`);
    process.exit(1);
  }
  const events = Array.isArray(json?.events) ? json.events : [];
  console.log(`Total event di buffer: ${events.length}`);
  const mine = events.filter(e => {
    const s = JSON.stringify(e).toUpperCase();
    return s.includes(emp) || s.includes(String(card));
  });
  if (!mine.length) {
    console.log(`\n⚠️  TIDAK ADA event untuk ${emp} di 200 event terakhir.`);
    console.log(`   Artinya worker TIDAK sedang mencoba grant untuk dia (atau buffer sudah ter-rotate).`);
    console.log(`   -> Kalau dia sedang dalam jam sesi & worker normal, harusnya ada 'attempt'/'grant' tiap ~60 detik.`);
    console.log(`\n   Ringkasan tipe event yang ADA (semua karyawan):`);
    const counts = {};
    for (const e of events) counts[e.type] = (counts[e.type] || 0) + 1;
    console.table(counts);
    return;
  }
  console.log(`\n=== ${mine.length} event untuk ${emp} (kronologis) ===`);
  for (const e of mine) {
    const extra = [e.allow != null ? `allow=${e.allow}` : '', e.tz ? `tz=${e.tz}` : '', e.unit_no ? `unit=${e.unit_no}` : '', e.card_no ? `card=${e.card_no}` : '', e.error ? `ERROR="${e.error}"` : ''].filter(Boolean).join(' ');
    console.log(`  ${e.t}  [${e.type}]  ${extra}`);
  }
  const fails = mine.filter(e => e.type === 'fail' || e.type === 'error');
  console.log(`\n=== KESIMPULAN ===`);
  if (fails.length) {
    console.log(`Worker MENCOBA grant tapi GAGAL. Pesan error terakhir:`);
    console.log(`  "${fails[fails.length - 1].error || '(kosong)'}"`);
    console.log(`-> Ini alasan grant pintu gym tidak nyangkut ke kartunya.`);
  } else if (mine.some(e => e.type === 'success' || e.type === 'grant')) {
    console.log(`Worker melaporkan SUKSES grant. Kalau tap tetap ditolak, masalah ada di sisi Vault/controller`);
    console.log(`(upload "sukses" di app belum tentu UploadStatus=1 di controller — lihat catatan bug masking).`);
  } else {
    console.log(`Ada event 'attempt' tapi tanpa hasil jelas — lihat daftar di atas.`);
  }
};
run();
