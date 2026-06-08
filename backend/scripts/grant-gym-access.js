/**
 * Ops tool: push a gym-door access time-zone to the Vault controller for a card,
 * exactly via the production path (UploadCardByDoorUnitNo). Prints UploadStatus + Log
 * so failures are visible (the app endpoint hides these).
 *
 * Usage: node backend/scripts/grant-gym-access.js <CardNo> [UnitNo] [TZ]
 *   TZ 01 = Free Access (grant), 00 = No Access (revoke)
 */
import dotenv from 'dotenv';
dotenv.config();

const CardNo = process.argv[2];
const UnitNo = process.argv[3] || (process.env.GYM_CONTROLLER_UNIT_NO || '0031');
const TZ = process.argv[4] || (process.env.GYM_ACCESS_TZ_ALLOW || '01');
if (!CardNo) { console.error('CardNo required'); process.exit(1); }

const baseUrl = (process.env.VAULT_UPLOAD_ASMX_BASE_URL || process.env.VAULT_ASMX_BASE_URL || process.env.VAULT_API_BASE || '').replace(/\/+$/, '');
const tag = (xml, t) => { const m = new RegExp(`<${t}>([\\s\\S]*?)<\\/${t}>`, 'i').exec(xml); return m ? m[1].trim() : null; };

const run = async () => {
  if (!baseUrl) { console.error('VAULT base URL not configured'); process.exit(1); }
  const url = new URL(`${baseUrl}/UploadCardByDoorUnitNo`);
  url.searchParams.set('CardNo', CardNo);
  url.searchParams.set('UnitNo', UnitNo);
  url.searchParams.set('CustomAccessTZ', TZ);
  console.log(`Granting: CardNo=${CardNo} UnitNo=${UnitNo} TZ=${TZ}\nGET ${url.toString()}\n`);
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(url.toString(), { method: 'GET', signal: ctrl.signal });
    const body = await r.text();
    clearTimeout(to);
    const parsed = { UnitNo: tag(body,'UnitNo'), DoorName: tag(body,'DoorName'), IPAddress: tag(body,'IPAddress'), DoorID: tag(body,'DoorID'), UploadStatus: tag(body,'UploadStatus'), Log: tag(body,'Log') };
    const ok = String(parsed.UploadStatus || '').trim() === '1' && r.ok;
    console.log(`HTTP ${r.status} ${r.ok ? 'OK' : 'NOT-OK'}`);
    console.log('parsed:', JSON.stringify(parsed, null, 2));
    console.log(ok ? '\n✅ UPLOAD SUKSES (UploadStatus=1) — TZ akses terkirim ke controller.'
                   : '\n❌ UPLOAD GAGAL — lihat UploadStatus/Log (alasan dari controller).');
    if (!ok) console.log('\nRAW BODY:\n' + body.slice(0, 2000));
  } catch (e) {
    clearTimeout(to);
    console.log('❌ ERROR Vault:', e.name === 'AbortError' ? 'TIMEOUT 20s (Vault/controller tidak responsif)' : e.message);
  }
};
run();
