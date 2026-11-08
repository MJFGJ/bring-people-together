import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* This app is fully real-time/client-driven (lobby + live puzzle state),
     so there's nothing to statically cache or prerender. */
};

export default nextConfig;
