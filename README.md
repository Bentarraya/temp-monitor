# Stasiun Suhu — ESP32 + DHT11 → Supabase → Sheets/Drive → Web UI

Alur datanya: **ESP32 baca DHT11 tiap jam → POST ke API custom (Next.js di
Vercel) → simpan ke Supabase → tiap jam sebuah cron cek: kalau sudah 24 data
hari itu, tulis ke Google Sheet, arsipkan salinannya ke Google Drive, kosongkan
sheet kerja, lalu reset tabel di Supabase.** Web UI nampilin suhu/kelembaban
terkini, status koneksi ESP32, timestamp, dan progres 24 jam.

## 1. Supabase
1. Buat project baru di supabase.com.
2. Buka SQL editor, jalankan isi `supabase/schema.sql`.
3. Ambil `Project URL` dan `service_role key` (Settings → API) — **bukan**
   `anon key`, karena API route jalan di server dan butuh akses penuh.

## 2. Google Sheet + Service Account
1. Buat Google Sheet baru, kasih nama tab `Data` (atau sesuaikan
   `GOOGLE_SHEET_TAB`). Baris pertama nanti diisi header otomatis.
2. Buat folder terpisah di Drive lu buat arsip harian, catat folder ID-nya
   (bagian akhir URL folder).
3. Di Google Cloud Console: buat project → aktifkan **Google Sheets API** dan
   **Google Drive API** → buat **Service Account** → buat key JSON.
4. Share Google Sheet **dan** folder arsip ke email service account itu
   (contoh: `xxxx@xxxx.iam.gserviceaccount.com`) sebagai **Editor**.
5. Dari JSON key, ambil `client_email` dan `private_key`.

## 3. Environment Variables (Vercel)
Isi sesuai `.env.example`. Yang paling gampang salah:
- `GOOGLE_PRIVATE_KEY` — tempel isi private key, tapi newline harus jadi
  literal `\n` (satu baris panjang).
- `DEVICE_API_KEY` — bikin string acak panjang, ini yang dicek dari header
  `x-api-key` waktu ESP32 kirim data. Jangan dipakai ulang dari project lain.
- `CRON_SECRET` — samain dengan Environment Variable yang lu set di tab
  **Cron Jobs** Vercel (Vercel otomatis kirim `Authorization: Bearer <secret>`
  ke endpoint cron kalau ini diset).

## 4. Deploy ke Vercel
```
vercel deploy
```
`vercel.json` udah nyiapin cron yang manggil `/api/sync-sheet` tiap jam
(menit ke-5) buat ngecek apakah 24 data udah kekumpul dan perlu disinkron +
direset.

## 5. Firmware ESP32
1. Buka `esp32/esp32_dht11.ino` di Arduino IDE.
2. Install library **DHT sensor library** (Adafruit) + **Adafruit Unified
   Sensor** lewat Library Manager.
3. Ganti `WIFI_SSID`, `WIFI_PASSWORD`, `API_BASE` (domain Vercel lu),
   `API_KEY` (samain dengan `DEVICE_API_KEY`).
4. Wiring DHT11: VCC→3.3V, GND→GND, DATA→GPIO4 (atau ganti `DHTPIN`).
5. Upload. ESP32 kirim 1 data suhu/jam + heartbeat tiap 2 menit biar status
   "terhubung" di web selalu akurat walau belum waktunya kirim data jam-an.

## Cara kerja detail
- **Hourly enforcement**: dijaga dua lapis — firmware nunggu 1 jam sebelum
  kirim lagi, dan API (`/api/readings`) nolak insert kalau data terakhir
  kurang dari ~55 menit lalu (jaga-jaga kalau ESP32 restart/ngirim dobel).
- **Reset otomatis**: `/api/sync-sheet` (dipanggil cron tiap jam) baru
  benar-benar nulis ke Sheet + arsip ke Drive + hapus data Supabase begitu
  baris di tabel `readings` sudah mencapai 24.
- **Indikator "terhubung"**: berdasarkan `device_status.last_seen` — dianggap
  online kalau heartbeat/data terakhir masuk dalam 5 menit terakhir.
- **Arsip Drive**: karena Google Sheet memang sudah otomatis tersimpan di
  Drive, "simpan ke Drive" di sini diwujudkan sebagai *snapshot* harian
  (salinan file bertanggal) di folder arsip, supaya histori tiap hari tidak
  ketimpa saat sheet kerja dikosongkan lagi.

## Struktur folder
```
app/
  page.tsx              → dashboard web
  layout.tsx / globals.css
  api/readings/route.ts → ESP32 kirim data jam-an ke sini
  api/heartbeat/route.ts→ ESP32 ping tiap beberapa menit
  api/status/route.ts   → dikonsumsi dashboard (polling 30 detik)
  api/sync-sheet/route.ts → dipanggil cron, sync ke Sheets/Drive + reset
lib/
  supabaseClient.ts
  googleSheets.ts
supabase/schema.sql
esp32/esp32_dht11.ino
```
