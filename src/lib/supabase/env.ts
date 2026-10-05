export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Saknar NEXT_PUBLIC_SUPABASE_URL eller NEXT_PUBLIC_SUPABASE_ANON_KEY i .env.local",
    );
  }

  return { url, anonKey };
}
