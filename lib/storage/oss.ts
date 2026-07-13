// lib/storage/oss.ts
// ============================================================
// 阿里云 OSS 文件存储适配层
//
// 替代 @vercel/blob，提供统一的文件上传/删除/读取接口。
// 使用 OSS REST API + v1 签名算法，无需额外依赖（仅用 Node.js crypto）。
//
// 环境变量：
// OSS_REGION — 区域，如 oss-cn-hangzhou
// OSS_ACCESS_KEY_ID — AccessKey ID
// OSS_ACCESS_KEY_SECRET — AccessKey Secret
// OSS_BUCKET — Bucket 名称
// OSS_ENDPOINT — (可选)自定义端点，如 https://oss-cn-hangzhou.aliyuncs.com
// OSS_PUBLIC_DOMAIN — (可选)CDN/自定义域名，如 https://cdn.example.com
// ============================================================

import crypto from "node:crypto";

export interface UploadResult {
  url: string;
  pathname: string;
  contentType: string;
}

export interface UploadOptions {
  contentType?: string;
  access?: "public" | "private";
}

function getOssConfig() {
  const region = process.env.OSS_REGION;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  const bucket = process.env.OSS_BUCKET;
  const endpoint = process.env.OSS_ENDPOINT || (region ? `https://${region}.aliyuncs.com` : undefined);
  const publicDomain = process.env.OSS_PUBLIC_DOMAIN;

  if (!accessKeyId || !accessKeySecret || !bucket || !endpoint) {
    throw new Error(
      "OSS 配置缺失：请设置 OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET",
    );
  }
  return { region, accessKeyId, accessKeySecret, bucket, endpoint, publicDomain };
}

/**
 * 构建 OSS v1 签名的 CanonicalizedResource
 */
function buildCanonicalizedResource(bucket: string, objectKey: string): string {
  return `/${bucket}/${objectKey}`;
}

/**
 * OSS v1 签名算法
 * StringToSign = METHOD\n\nContent-MD5\nContent-Type\nDate\nCanonicalizedOSSHeaders\nCanonicalizedResource
 * 
 * ⚠️ 修复点：不再使用 `.join("\n")`，避免因 CanonicalizedOSSHeaders 结尾自带 `\n` 而产生多余的空行。
 */
function sign(
  method: string,
  accessKeySecret: string,
  contentMd5: string,
  contentType: string,
  date: string,
  canonicalizedHeaders: string,
  canonicalizedResource: string,
): string {
  // 严格按照 OSS 文档拼接，确保每一项之间只有一个 \n
  const stringToSign = 
    method + "\n" + 
    contentMd5 + "\n" + 
    contentType + "\n" + 
    date + "\n" + 
    canonicalizedHeaders + 
    canonicalizedResource;

  return crypto.createHmac("sha1", accessKeySecret).update(stringToSign).digest("base64");
}

/**
 * 上传文件到 OSS (支持 Buffer, ArrayBuffer, string)
 */
export async function upload(
  objectKey: string,
  data: Uint8Array | ArrayBuffer | string,
  options: UploadOptions = {},
): Promise<UploadResult> {
  const config = getOssConfig();

  // 统一转换为 Uint8Array，兼容 fetch 的 BodyInit 类型
  const body: Uint8Array = typeof data === "string" 
    ? new TextEncoder().encode(data) 
    : data instanceof ArrayBuffer 
      ? new Uint8Array(data) 
      : data;

  const contentType = options.contentType || "application/octet-stream";
  const date = new Date().toUTCString();
  const md5 = crypto.createHash("md5").update(body).digest("base64");
  
  const acl = options.access === "private" ? "private" : "public-read";
  // 注意：这里必须以 \n 结尾
  const canonicalizedHeaders = `x-oss-object-acl:${acl}\n`;
  
  const canonicalizedResource = buildCanonicalizedResource(config.bucket, objectKey);

  const signature = sign(
    "PUT",
    config.accessKeySecret,
    md5,
    contentType,
    date,
    canonicalizedHeaders,
    canonicalizedResource,
  );

  const host = `${config.bucket}.${config.endpoint!.replace(/^https?:\/\//, "")}`;
  const url = `https://${host}/${objectKey.replace(/^\//, "")}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `OSS ${config.accessKeyId}:${signature}`,
      "Content-Type": contentType,
      "Content-MD5": md5,
      "Date": date,
      "x-oss-object-acl": acl,
    },
    body: new Blob([body as unknown as BlobPart], { type: contentType }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OSS 上传失败: ${response.status} ${errorText}`);
  }

  // 构建公开访问 URL
  const publicHost = config.publicDomain ? config.publicDomain.replace(/\/$/, "") : `https://${host}`;
  const publicUrl = `${publicHost}/${objectKey.replace(/^\//, "")}`;

  return {
    url: publicUrl,
    pathname: objectKey,
    contentType,
  };
}

/**
 * 便捷方法：上传 Base64 格式的文件到 OSS
 */
export async function uploadBase64(
  base64Data: string,
  fileName: string,
  contentType: string,
  folder: string = "avatars"
): Promise<string> {
  // 提取纯 Base64 字符串
  const base64String = base64Data.split(';base64,').pop() || '';
  const buffer = Buffer.from(base64String, 'base64');
  
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  
  // 健壮的扩展名提取逻辑
  const ext = fileName.includes('.') ? fileName.split('.').pop() : 'jpg';
  
  const objectKey = `${folder}/${timestamp}-${randomStr}.${ext}`;
  
  const result = await upload(objectKey, buffer, {
    contentType,
    access: "public" // 头像等图片通常需要公开读
  });

  return result.url;
}

/**
 * 删除 OSS 中的文件
 */
export async function del(objectUrl: string): Promise<void> {
  const config = getOssConfig();
  const urlObj = new URL(objectUrl);
  const objectKey = urlObj.pathname.replace(/^\//, "");
  const date = new Date().toUTCString();
  const canonicalizedResource = buildCanonicalizedResource(config.bucket, objectKey);

  // 删除操作没有 CanonicalizedOSSHeaders，传递空字符串
  const signature = sign(
    "DELETE",
    config.accessKeySecret,
    "", "",
    date,
    "",
    canonicalizedResource,
  );

  const host = `${config.bucket}.${config.endpoint!.replace(/^https?:\/\//, "")}`;
  const url = `https://${host}/${objectKey}`;

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `OSS ${config.accessKeyId}:${signature}`,
      Date: date,
    },
  });

  // 404 表示文件不存在，视为删除成功
  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    throw new Error(`OSS 删除失败: ${response.status} ${errorText}`);
  }
}

/**
 * 从 OSS 读取文件内容（用于代理读取场景）
 */
export async function get(objectUrl: string): Promise<Response> {
  const config = getOssConfig();
  const urlObj = new URL(objectUrl);
  const objectKey = urlObj.pathname.replace(/^\//, "");
  const date = new Date().toUTCString();
  const canonicalizedResource = buildCanonicalizedResource(config.bucket, objectKey);

  const signature = sign(
    "GET",
    config.accessKeySecret,
    "", "",
    date,
    "",
    canonicalizedResource,
  );

  const host = `${config.bucket}.${config.endpoint!.replace(/^https?:\/\//, "")}`;
  const url = `https://${host}/${objectKey}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `OSS ${config.accessKeyId}:${signature}`,
      Date: date,
    },
  });

  return response;
}

/**
 * 检查 OSS 是否已配置（用于条件判断）
 */
export function isOssConfigured(): boolean {
  return Boolean(
    process.env.OSS_ACCESS_KEY_ID &&
    process.env.OSS_ACCESS_KEY_SECRET &&
    process.env.OSS_BUCKET,
  );
}
