import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        hostname: "cdn.shopify.com",
        pathname: "/s/files/**",
        port: "",
        protocol: "https",
      },
    ],
  },
};

export default nextConfig;
