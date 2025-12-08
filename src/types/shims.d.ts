declare module '@tauri-apps/api/event';
declare module '@tauri-apps/api/tauri';
declare module '@tauri-apps/api/dialog';
declare module '@tauri-apps/api/fs';

// Provide a very small JSX declaration so TS doesn't complain about JSX intrinsic elements
declare module 'react/jsx-runtime';

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any;
  }
}
