/// <reference types="vite/client" />

declare const __BUILD_TIME__: string;

interface Window {
  __serverStatusRecoverAssets?: (force?: boolean) => boolean;
}
