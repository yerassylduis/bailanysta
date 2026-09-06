import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "**.public.blob.vercel-storage.com" }] },
  turbopack: { root: path.resolve(import.meta.dirname) },
};

export default nextConfig;
