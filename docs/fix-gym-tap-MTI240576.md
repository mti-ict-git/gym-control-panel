# Runbook: perbaikan tap gym MTI240576 (Meinda) + perbaikan sistemik

> Jalankan dari **server production** atau mesin yang terhubung ke `10.60.10.x`
> (DB `10.60.10.47`, Vault `10.60.10.6`). Mesin dev biasa belum tentu terjangkau.
>
> Akar masalah: grant akses pintu gym (`UploadCardByDoorUnitNo` → Vault) tidak pernah
> nyangkut ke kartu Meinda, sementara `gym_controller_access_override` ditulis "allow"
> walau upload gagal (bug masking) + override-nya nyangkut di `MANUAL_LOCK` (19:09).
> Efek samping: tap selalu "Wrong Time Zone" → tidak ada valid entry → scanner anggap
> bolos → auto-ban NO_SHOW_3X. Lihat memory: gym-tap-wrong-timezone.

---

## BAGIAN 1 — Perbaikan langsung Meinda (tanpa perlu deploy)

### 1.1 Tes + fix grant ke controller (sekaligus diagnosa)
Buka URL ini di browser (atau curl) dari mesin yang terhubung ke Vault:

```
http://10.60.10.6/Vaultsite/APIwebservice2.asmx/UploadCardByDoorUnitNo?CardNo=1453472210&UnitNo=0031&CustomAccessTZ=01
```

Baca XML balasannya:
- `<UploadStatus>1</UploadStatus>` → **SUKSES**. Kartunya kini punya akses pintu gym; dia bisa tap.
- `UploadStatus` bukan `1` → **GAGAL**. Baca `<Log>` untuk alasan dari Vault
  (kemungkinan kartunya perlu **re-enroll** / ada masalah data kartu di Vault).
  Ini jawaban pasti "kenapa grant tidak nyangkut".

### 1.2 Reset override yang nyangkut (MANUAL_LOCK) — di DB gym (10.60.10.47)
Agar worker mengelola dia lagi (bukan dipin oleh manual lock):

```sql
DELETE FROM dbo.gym_controller_access_override
WHERE EmployeeID = 'MTI240576' AND UnitNo = '0031';
```

### 1.3 Unban + void no-show palsu — di DB gym
```sql
-- angkat ban
UPDATE dbo.gym_booking_ban
SET BannedUntil = DATEADD(day,-1, CONVERT(date, DATEADD(hour,8,GETUTCDATE()))),
    ConsecutiveNoShow = 0,
    UnbanRemark = 'False NO_SHOW_3X from gym grant failure (Wrong Time Zone)',
    UnbanAt = GETDATE(), ActionBy = 'itsupport', UpdatedAt = GETDATE()
WHERE EmployeeID = 'MTI240576';

-- batalkan booking no-show palsu (7 hari terakhir) agar scanner tidak nge-ban lagi
-- (TIDAK menyentuh booking hari ini)
UPDATE dbo.gym_booking
SET Status = 'CANCELLED',
    RejectedReason = 'Voided: gym access not granted (Wrong Time Zone) - false no-show'
WHERE EmployeeID = 'MTI240576' AND Status IN ('BOOKED','CHECKIN')
  AND BookingDate <  CONVERT(date, DATEADD(hour,8,GETUTCDATE()))
  AND BookingDate >= DATEADD(day,-7, CONVERT(date, DATEADD(hour,8,GETUTCDATE())));
```

> Alternatif tanpa void: deploy Bagian 2 (#2) dulu, lalu cukup jalankan UPDATE ban saja.

---

## BAGIAN 2 — Perbaikan sistemik (deploy perubahan kode)

Sudah diubah di repo (review diff dulu):
- `backend/routes/gym.js` — **#3**: override hanya ditulis kalau upload SOAP sukses (stop masking).
- `backend/app.js` — **#2**: scanner no-show menganggap tap apa pun di pintu gym (termasuk
  "Wrong Time Zone") sebagai HADIR, jadi tidak ada auto-ban palsu.

Deploy: pull/copy ke server production, lalu restart backend (`node backend/app.js`).

---

## BAGIAN 3 — Verifikasi
1. Buka lagi URL 1.1 → `UploadStatus=1`.
2. Minta Meinda tap → harus "Valid Entry" di unit 0031 (cek Live view app / `tblTransaction`).
3. Pastikan dia tidak ada di daftar ban.
4. Setelah Bagian 2 ter-deploy, pantau worker (`/api/gym-access-log`) — grant gagal kini
   tampil `ok:false`, tidak lagi tersembunyi.

---

## Catatan: 6 user lain (MTIBJ174/336/339/340/342/343)
Grant mereka gagal dengan **"CardNo not found for employee_id"** — kartunya belum terdaftar
aktif di `DataDBEnt.dbo.CardDB` (Status=1, Block=0, del_state=0). Daftarkan/aktifkan kartunya
di Vault, atau cek kenapa StaffNo mereka tidak punya kartu aktif. Ini terpisah dari kasus Meinda.

## Tools siap pakai (kalau mau via skrip, bukan SQL manual)
- `node backend/scripts/grant-gym-access.js 1453472210 0031 01`  (= langkah 1.1)
- `node backend/scripts/unban-employee.js MTI240576 --void`       (= langkah 1.3)
- `node backend/scripts/check-emp-tap.js MTI240576`               (diagnosa lengkap)
- `node backend/scripts/check-worker-log.js https://mti-gym.merdekabattery.com MTI240576`
