import { createClient } from "@supabase/supabase-js";

// Dipakai HANYA di server (API routes). Pakai service role key supaya
// bisa insert/select/delete tanpa terganjal RLS, dan key ini tidak
// pernah dikirim ke browser karena tidak diprefix NEXT_PUBLIC_.
export function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error("Supabase env vars belum diset");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      // Paksa no-store: Vercel/Next.js suka nge-cache fetch ke API luar
      // (termasuk request Supabase-js), walaupun route-nya udah dynamic.
      fetch: (input, init) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
