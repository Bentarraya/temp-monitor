-- Tabel data suhu/kelembaban per jam
create table if not exists readings (
  id bigint generated always as identity primary key,
  suhu numeric not null,
  kelembaban numeric not null,
  recorded_at timestamptz not null default now()
);

create index if not exists readings_recorded_at_idx on readings (recorded_at);

-- Status koneksi ESP32 (di-upsert tiap heartbeat / kirim data)
create table if not exists device_status (
  device_id text primary key,
  last_seen timestamptz not null default now(),
  suhu numeric,
  kelembaban numeric
);

-- Log tiap kali sheet berhasil disinkron & diarsip ke Drive (opsional, buat histori)
create table if not exists sync_log (
  id bigint generated always as identity primary key,
  synced_at timestamptz not null default now(),
  rows_synced int not null,
  drive_file_id text
);

-- Matikan RLS karena semua akses lewat service role key di server (API route)
alter table readings enable row level security;
alter table device_status enable row level security;
alter table sync_log enable row level security;
-- Tidak ada policy dibuat -> hanya service_role (dipakai backend) yang bisa akses.
