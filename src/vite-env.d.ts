/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Build-time injected variables
declare const __APP_VERSION__: string;
declare const __GIT_HASH__: string;
declare const __BUILD_TIMESTAMP__: string;
declare const __DEV_MODE__: string;