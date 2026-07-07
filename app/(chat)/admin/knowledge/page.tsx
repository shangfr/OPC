import { auth } from "@/app/(auth)/auth";
import { isAdmin } from "@/lib/utils";
import { KnowledgeView } from "./knowledge-view";

/**
 * 知识库管理页（Server Component wrapper）
 *
 * Auth.js v5 纯 Server Component 模式：
 * 在 Server Component 中调用 auth() 获取角色信息，通过 prop 传入客户端组件。
 */
export default async function KnowledgePage() {
  const session = await auth();
  const userIsAdmin = isAdmin(session?.user ?? {});

  return <KnowledgeView userIsAdmin={userIsAdmin} />;
}
