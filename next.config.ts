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
  reactCompiler: true,
  // 将含原生绑定的 Node.js 包标记为外部包，避免被 bundler 打包
  // （webpack 模式下 @grpc/grpc-js 等原生模块无法被打包）
  serverExternalPackages: [
    "@opentelemetry/sdk-node",
    "@opentelemetry/auto-instrumentations-node",
    "@opentelemetry/exporter-trace-otlp-http",
    "@opentelemetry/sdk-trace-node",
    "@grpc/grpc-js",
  ],
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
  // 允许的开发来源：通过环境变量 ALLOWED_DEV_ORIGINS 配置（逗号分隔），
  // 避免将开发者本地 IP 硬编码到源码中。
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS
    ? process.env.ALLOWED_DEV_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : [],
};

export default nextConfig;
