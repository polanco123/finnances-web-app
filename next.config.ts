import type { NextConfig } from "next";

// basePath only applies when building for GitHub Pages (set explicitly in
// .github/workflows/nextjs.yml). Locally (npm run dev / npm run build)
// GITHUB_PAGES is unset, so the app serves from "/" as usual.
const isGithubPages = process.env.GITHUB_PAGES === "true";

const basePath = isGithubPages ? "/finnances-web-app" : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath,
  images: { unoptimized: true },
  distDir: "dist",
  // Next's basePath is NOT auto-applied to plain <img src="/..."> tags
  // (only to next/image, next/link, etc.) — expose it so components can
  // prefix hardcoded /public asset paths themselves.
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
