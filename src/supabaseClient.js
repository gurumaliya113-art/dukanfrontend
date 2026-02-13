import { createClient } from "@supabase/supabase-js";

// Allow running the app without a frontend/.env by falling back to the same
// demo Supabase project the backend uses.
const fallbackUrl = "https://nrxpikexvujleglfnvle.supabase.co";
const fallbackAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yeHBpa2V4dnVqbGVnbGZudmxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTAyNDAsImV4cCI6MjA4NjA2NjI0MH0.IYkXnM8xepEjHMKYto33gC5TspOOeNsAyX_BEu4qZXw";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || fallbackUrl;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || fallbackAnonKey;

if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] Missing REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY. Using fallback demo project; create frontend/.env to use your own Supabase."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
