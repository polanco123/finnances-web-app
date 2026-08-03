import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/finnances-web-app",
  assetPrefix: "/finnances-web-app",
  images: { unoptimized: true },
  distDir: "dist",
};

export default nextConfig;
