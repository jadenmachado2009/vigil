/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // Lets `npm run build:check` compile into a separate directory so a
  // production build never clobbers a running dev server's .next output.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};
