import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = getSupabaseServer();

  const { data: readings } = await supabase
    .from("readings")
    .select("id, suhu, kelembaban, recorded_at")
    .order("recorded_at", { ascending: true });

  const { data: status } = await supabase
    .from("device_status")
    .select("*")
    .order("last_seen", { ascending: false })
    .limit(1)
    .maybeSingle();

  const online = status ? Date.now() - new Date(status.last_seen).getTime() < 5 * 60 * 1000 : false;
  const latest = readings && readings.length > 0 ? readings[readings.length - 1] : null;

  return NextResponse.json({
    online,
    lastSeen: status?.last_seen ?? null,
    latest,
    todayCount: readings?.length ?? 0,
    target: 24,
    readings: readings ?? [],
  });
}
