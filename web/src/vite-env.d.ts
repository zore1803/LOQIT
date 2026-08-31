/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_LOCATIONIQ_API_KEY: string
  readonly VITE_GOOGLE_MAPS_API_KEY?: string
  readonly VITE_GROQ_API_KEY?: string
  readonly VITE_PUBLIC_SITE_URL?: string
  readonly VITE_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
