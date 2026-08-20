/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_FIPE_TOKEN?: string;
  readonly VITE_MOTOMARKS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
