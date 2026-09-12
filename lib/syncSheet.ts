import { getSupabaseServer } from "@/lib/supabaseClient";
import { writeRowsToSheet, archiveToNewTab, clearWorkingSheet } from "@/lib/googleSheets";

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

  const d = new Date();
  const dateLabel =
    d.toISOString().slice(0, 10) + "_" + d.toISOString().slice(11, 16).replace(":", "");

  try {
    await writeRowsToSheet(rows);
    const archiveTab = await archiveToNewTab(dateLabel);
    await clearWorkingSheet();

    await supabase.from("readings").delete().gte("id", 0);
    await supabase.from("sync_log").insert({
      rows_synced: rows.length,
      drive_file_id: archiveTab,
    });

    return { synced: true, count: rows.length, archiveTab };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Sync ke Google Sheet gagal:", message);
    return { synced: false, count: rows.length, error: message };
  }
}
