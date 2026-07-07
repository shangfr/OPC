"use server";

import { signOut } from "@/app/(auth)/auth";

/**
 * 退出登录 Server Action
 *
 * 从 auth.ts 导出的 signOut 是 server-side 函数，
 * 通过独立 "use server" 文件导出，供 Client Component 导入调用。
 */
export async function signOutAction() {
  await signOut({
    redirectTo: "/",
  });
}
