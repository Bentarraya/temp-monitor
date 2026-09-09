import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseClient";
import { writeRowsToSheet, archiveSheetToDrive, clearWorkingSheet } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TARGET_ROWS = 24;

// Dipanggil Vercel Cron tiap jam. Kalau data hari ini sudah 24 baris:
// 1. Tulis semua baris ke Google Sheet
// 2. Arsipkan salinan sheet itu ke folder Google Drive
// 3. Kosongkan lagi sheet kerja
// 4. Reset (hapus) data di tabel readings Supabase
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServer();

  const { data: rows, error } = await supabase
    .from("readings")
    .select("id, suhu, kelembaban, recorded_at")
    .order("recorded_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rows || rows.length < TARGET_ROWS) {
    return NextResponse.json({ synced: false, count: rows?.length ?? 0 });
  }

  const dateLabel = new Date().toISOString().slice(0, 10);

  await writeRowsToSheet(rows);
  const driveFileId = await archiveSheetToDrive(dateLabel);
  await clearWorkingSheet();

  const { error: delError } = await supabase
    .from("readings")
    .delete()
    .gte("id", 0); // hapus semua baris

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  await supabase.from("sync_log").insert({
    rows_synced: rows.length,
    drive_file_id: driveFileId,
  });

  return NextResponse.json({ synced: true, count: rows.length, driveFileId });
}
