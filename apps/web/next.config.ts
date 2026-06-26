import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@project-template/ui", "@project-template/shared"]
};

export default nextConfig;
