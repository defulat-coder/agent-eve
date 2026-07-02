import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@agent-template/ui", "@agent-template/shared"]
};

export default nextConfig;
