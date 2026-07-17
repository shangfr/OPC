import { upload as ossUpload } from "@/lib/storage/oss";
import { NextResponse } from "next/server";
import { auth, unstable_update } from "@/app/(auth)/auth";
import { updateUserProfile } from "@/lib/db/queries";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as Blob | null;

    if (!file) {
      return NextResponse.json({ error: "未上传文件" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "仅支持 JPEG、PNG、GIF、WebP 格式" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `文件大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    const ext = file.type.split("/")[1] || "jpg";
    const filename = `avatars/${session.user.id}-${Date.now()}.${ext}`;
    const fileBuffer = await file.arrayBuffer();

    const blob = await ossUpload(filename, fileBuffer, {
      contentType: file.type,
      access: "public",
    });

    await updateUserProfile({
      userId: session.user.id,
      image: blob.url,
    });

    // 通过 NextAuth 的 unstable_update 将新头像 URL 直接写入
    // JWT token 并持久化到 session cookie。
    // 这样后续所有页面刷新（Server Component 读取 auth()）都能
    // 拿到最新的 session.user.image，无需依赖 refresh_session cookie。
    await unstable_update({ picture: blob.url });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error("[avatar upload] error:", error);
    return NextResponse.json(
      { error: "头像上传失败，请重试" },
      { status: 500 }
    );
  }
}
