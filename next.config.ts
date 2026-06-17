import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/proxy/:path*",
        destination: "http://backend:5000/:path*",
      },
    ];
  },
};

export default nextConfig;