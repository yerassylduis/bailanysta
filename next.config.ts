import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  agentRules: false,
  devIndicators: false,
  // второй адрес dev-сервера нужен, чтобы тестировать звонок двумя разными аккаунтами в одном браузере
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: { remotePatterns: [{ protocol: "https", hostname: "**.public.blob.vercel-storage.com" }] },
  turbopack: { root: path.resolve(import.meta.dirname) },
};

export default nextConfig;
