import { auth } from "@/app/(auth)/auth";
import { isAdmin } from "@/lib/utils";
import { KnowledgeView } from "@/app/(chat)/admin/knowledge/knowledge-view";

/**
 * /knowledge 页面（知识库管理）
 *
 * 所有正式用户可访问。管理员有完整 CRUD 权限。
 */
export default async function KnowledgePage() {
  const session = await auth();
  const userIsAdmin = isAdmin(session?.user ?? {});

  return <KnowledgeView userIsAdmin={userIsAdmin} />;
}
