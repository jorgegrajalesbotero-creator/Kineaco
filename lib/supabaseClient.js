import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Si faltan las variables, avisamos de forma clara en vez de dejar que
// createClient lance "supabaseUrl is required" y rompa el build/prerender.
// En Vercel deben configurarse en: Settings → Environment Variables.
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabase] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
      "Configúralas en Vercel → Settings → Environment Variables (Production, Preview y Development)."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);