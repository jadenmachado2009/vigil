/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // The floating dev badge sits on top of the interface and reads as a stray
  // widget in screenshots.
  devIndicators: false,
  // PGlite ships a WASM build that must not be traced into the serverless
  // bundle; it is only ever loaded in local development.
  serverExternalPackages: ['@electric-sql/pglite'],
  // Lets `npm run build:check` compile into a separate directory so a
  // production build never clobbers a running dev server's .next output.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // PGlite ships WebAssembly and resolves its own filesystem assets. Bundling it
  // rewrites those paths and breaks migration at runtime, so it stays external.
  serverExternalPackages: ['@electric-sql/pglite'],
};
