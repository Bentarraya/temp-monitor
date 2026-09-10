"use client";

import { useEffect, useState } from "react";

type Reading = { id: number; suhu: number; kelembaban: number; recorded_at: string };
type StatusResponse = {
  online: boolean;
  lastSeen: string | null;
  live: { suhu: number; kelembaban: number; recorded_at: string } | null;
  latest: Reading | null;
  todayCount: number;
  target: number;
  readings: Reading[];
};

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

function timeAgo(iso: string | null) {
  if (!iso) return "belum pernah";
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s} detik lalu`;
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  return `${Math.floor(s / 3600)} jam lalu`;
}

export default function Page() {
  const [data, setData] = useState<StatusResponse | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        const json = await res.json();
        if (alive) setData(json);
      } catch {
        // diamkan, coba lagi di polling berikutnya
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const latest = data?.live ?? data?.latest;
  const count = data?.todayCount ?? 0;
  const target = data?.target ?? 24;
  const history = data?.readings ?? [];

  return (
    <div className="page">
      <div className="panel">
        <div className="header">
          <div>
            <h1>Stasiun Suhu</h1>
            <div className="sub">ESP32 · DHT11</div>
          </div>
          <div className="status">
            <span className={`dot ${data?.online ? "online" : ""}`} />
            {data ? (data.online ? "Terhubung" : "Terputus") : "Memuat…"}
          </div>
        </div>

        <div className="readouts">
          <div className="readout temp">
            <div className="label">Suhu</div>
            <div className="value mono">
              {latest ? latest.suhu.toFixed(1) : "—"}
              <span className="unit">°C</span>
            </div>
          </div>
          <div className="readout hum">
            <div className="label">Kelembaban</div>
            <div className="value mono">
              {latest ? latest.kelembaban.toFixed(0) : "—"}
              <span className="unit">%</span>
            </div>
          </div>
        </div>

        <div className="meta-row mono">
          <span>update terakhir: {timeAgo(data?.lastSeen ?? null)}</span>
          <span>{formatTime(latest?.recorded_at ?? null)}</span>
        </div>

        <div className="progress-block">
          <div className="progress-head">
            <span>Data hari ini</span>
            <span className="count mono">{count} / {target} jam</span>
          </div>
          <div className="ticks">
            {Array.from({ length: target }).map((_, i) => (
              <div key={i} className={`tick ${i < count ? "filled" : ""}`} />
            ))}
          </div>
        </div>

        <div className="log">
          <div className="log-head">Riwayat per jam</div>
          {history.length === 0 ? (
            <div className="empty">Belum ada data masuk hari ini.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Suhu</th>
                  <th>Kelembaban</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{formatTime(r.recorded_at)}</td>
                    <td className="mono">{r.suhu.toFixed(1)}°C</td>
                    <td className="mono">{r.kelembaban.toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="footer-note">
          Saat 24 titik data terkumpul, sheet otomatis diarsipkan ke Drive
          lalu data direset untuk siklus berikutnya.
        </div>
      </div>
    </div>
  );
}
