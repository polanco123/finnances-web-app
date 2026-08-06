import type { NextConfig } from "next";

// basePath only applies when building for GitHub Pages (set explicitly in
// .github/workflows/nextjs.yml). Locally (npm run dev / npm run build)
// GITHUB_PAGES is unset, so the app serves from "/" as usual.
const isGithubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isGithubPages ? "/finnances-web-app" : "",
  assetPrefix: isGithubPages ? "/finnances-web-app" : "",
  images: { unoptimized: true },
  distDir: "dist",
};

export default nextConfig;
