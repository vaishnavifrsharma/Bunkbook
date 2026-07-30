import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig = {
  allowedDevOrigins: [
    "192.168.1.13",
    "https://192.168.1.13:3000",
    "localhost:3000",
  ],
};

export default withPWA(nextConfig);