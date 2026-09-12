import { getSupabaseServer } from "@/lib/supabaseClient";
import { writeRowsToSheet, archiveSheetToDrive, clearWorkingSheet } from "@/lib/googleSheets";

const TARGET_ROWS = 24;

export async function checkAndSyncIfFull() {
  const supabase = getSupabaseServer();

  const { data: rows, error } = await supabase
    .from("readings")
    .select("id, suhu, kelembaban, recorded_at")
    .order("recorded_at", { ascending: true });

  if (error || !rows || rows.length < TARGET_ROWS) {
    return { synced: false, count: rows?.length ?? 0 };
  }

  const dateLabel = new Date().toISOString().slice(0, 10);

  try {
    await writeRowsToSheet(rows);
    const driveFileId = await archiveSheetToDrive(dateLabel);
    await clearWorkingSheet();

    await supabase.from("readings").delete().gte("id", 0);
    await supabase.from("sync_log").insert({
      rows_synced: rows.length,
      drive_file_id: driveFileId,
    });

    return { synced: true, count: rows.length, driveFileId };
  } catch (err) {
    // Jangan biarin ini bikin seluruh request /api/readings gagal —
    // data sensor tetap kesimpen, tapi sync-nya dilaporin gagal biar
    // ketauan errornya, bukan diam-diam nyangkut.
    const message = err instanceof Error ? err.message : String(err);
    console.error("Sync ke Google Sheet/Drive gagal:", message);
    return { synced: false, count: rows.length, error: message };
  }
}
