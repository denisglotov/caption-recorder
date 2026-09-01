/// <reference types="wxt/browser" />

declare module '*?raw' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}
