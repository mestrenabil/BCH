import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "http://localhost:81",
    "http://127.0.0.1:81",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://21.0.12.215:3000",
    "http://21.0.12.215:81",
  ],
};

export default nextConfig;
