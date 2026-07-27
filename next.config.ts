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
    /**
     * 远程图片优化白名单。
     *
     * 项目已从 Vercel Blob 迁移到阿里云 OSS，移除了原有的
     * avatar.vercel.sh / *.public.blob.vercel-storage.com 配置。
     *
     * 当前支持的图片来源：
     * 1. 阿里云 OSS 默认域名 *.aliyuncs.com（如 oss-cn-hangzhou.aliyuncs.com）
     * 2. OSS 自定义域名 / CDN（通过 OSS_PUBLIC_DOMAIN 环境变量配置，构建时读取）
     */
    remotePatterns: [
      // 阿里云 OSS 默认域名：https://{bucket}.{region}.aliyuncs.com/{key}
      {
        protocol: "https",
        hostname: "*.aliyuncs.com",
      },
      // OSS 自定义域名 / CDN（如配置了 OSS_PUBLIC_DOMAIN 环境变量）
      ...(process.env.OSS_PUBLIC_DOMAIN
        ? (() => {
            try {
              const url = new URL(process.env.OSS_PUBLIC_DOMAIN!);
              return [
                {
                  protocol: url.protocol.replace(
                    ":",
                    "",
                  ) as "http" | "https",
                  hostname: url.hostname,
                  ...(url.port ? { port: url.port } : {}),
                },
              ];
            } catch {
              return [];
            }
          })()
        : []),
    ],
  },
  // 允许的开发来源：通过环境变量 ALLOWED_DEV_ORIGINS 配置（逗号分隔），
  // 避免将开发者本地 IP 硬编码到源码中。
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS
    ? process.env.ALLOWED_DEV_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
    : [],
};

export default nextConfig;
