/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

declare module '@stoplight/elements' {
  import type React from 'react';
  export const API: React.ComponentType<any>;
}

