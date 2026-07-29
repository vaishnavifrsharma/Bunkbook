import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  /* config options here */
  // @ts-ignore - Next.js 15 might have this typed or untyped depending on the canary version
  allowedDevOrigins: ['192.168.1.13', 'https://192.168.1.13:3000', '192.168.1.13:3000', 'localhost', '127.0.0.1'],
  experimental: {
    allowedDevOrigins: ['192.168.1.13', 'https://192.168.1.13:3000', '192.168.1.13:3000', 'localhost', '127.0.0.1'],
  },
};

export default withPWA(nextConfig);
