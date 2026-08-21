import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The real storefront lives at /store; the old scaffold landing page
      // and the legacy mock device-browser pages are retired in its favor.
      { source: "/", destination: "/store", permanent: false },
      { source: "/devices", destination: "/store", permanent: true },
      { source: "/devices/:id", destination: "/store", permanent: true },
    ];
  },
};

export default nextConfig;
