import type { NextConfig } from "next";

const basePath = process.env.IS_DEMO === "1" ? "/demo" : "";

const nextConfig: NextConfig = {
  ...(basePath
    ? {
        basePath,
        assetPrefix: "/demo-assets",
        redirects: async () => [
          {
            source: "/",
            destination: basePath,
            permanent: false,
            basePath: false,
          },
        ],
      }
    : {}),
  output: "standalone",
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  // 🚨 暂时注释掉这些，测试动画是否恢复
  // cacheComponents: true,
  // experimental: {
  //   prefetchInlining: true,
  //   cachedNavigations: true,
  //   appNewScrollHandler: true,
  //   inlineCss: true,
  //   turbopackFileSystemCacheForDev: true,
  // },
  logging: {
    fetches: {
      fullUrl: false,
    },
    incomingRequests: false,
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  allowedDevOrigins: ['10.137.109.204','192.168.3.6'],
};

export default nextConfig;
