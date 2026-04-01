/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVATE_KEY: string;
  readonly VITE_INDEXER_URL: string;
  readonly VITE_WILDDUCK_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
