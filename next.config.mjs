/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // Lets `npm run build:check` compile into a separate directory so a
  // production build never clobbers a running dev server's .next output.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // PGlite ships WebAssembly and resolves its own filesystem assets. Bundling it
  // rewrites those paths and breaks migration at runtime, so it stays external.
  serverExternalPackages: ['@electric-sql/pglite'],
};
