import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    localPatterns: [
      // Allow Next/Image to render images served by our own API routes,
      // including query-string based endpoints like `folder-image?name=...`.
      // Omitting `search` allows any query string (or none).
      { pathname: "/api/movies/**" },
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "images-na.ssl-images-amazon.com",
        pathname: "/images/**",
      },
      {
        protocol: "https",
        hostname: "ia.media-imdb.com",
        pathname: "/images/**",
      },
    ],
  },
};

export default nextConfig;
