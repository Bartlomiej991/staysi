// Publiczna konfiguracja dla aplikacji. Klucz "anon" Supabase jest publiczny z założenia:
// dane chroni RLS w bazie. Klucz Claude i klucz service_role nigdy tu nie trafiają.
export default function handler(req, res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "public, max-age=300");
  res.send(JSON.stringify({
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || ""
  }));
}
