import { createClient } from "@supabase/supabase-js";

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit, retries = 2): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, { ...init, cache: "no-store" });
      // 502/503/504 = masalah sementara di server Supabase, layak dicoba ulang
      if ([502, 503, 504].includes(res.status) && attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("fetchWithRetry: kehabisan percobaan");
}

export function getSupabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error("Supabase env vars belum diset");
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => fetchWithRetry(input, init),
    },
  });
}
