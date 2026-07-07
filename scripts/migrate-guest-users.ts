import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { config } from "dotenv";
import { user } from "@/lib/db/schema";

// 加载 .env.local 文件
config({ path: ".env.local" });

/**
 * 迁移脚本：将邮箱以 guest- 开头的用户标记为访客用户
 * 
 * 使用方法：
 * npx tsx scripts/migrate-guest-users.ts
 */
async function migrateGuestUsers() {
  console.log("开始迁移访客用户数据...\n");

  // 初始化数据库连接
  const client = postgres(process.env.POSTGRES_URL ?? "");
  const db = drizzle(client);

  try {
    // 查找所有邮箱以 guest- 开头但 isAnonymous 为 false 的用户
    const guestUsersToMigrate = await db.execute(sql`
      SELECT id, email, "isAnonymous"
      FROM "User"
      WHERE email LIKE 'guest-%' AND "isAnonymous" = false
    `);

    const guestUsersArray = guestUsersToMigrate as unknown as Array<{
      id: string;
      email: string;
      isAnonymous: string;
    }>;

    console.log(`找到 ${guestUsersArray.length} 个需要迁移的访客用户：\n`);
    guestUsersArray.forEach((u, index) => {
      console.log(`${index + 1}. ${u.email} (ID: ${u.id})`);
    });
    console.log("");

    if (guestUsersArray.length === 0) {
      console.log("✅ 无需迁移，所有 guest- 用户已正确标记！");
      return;
    }

    // 更新这些用户的 isAnonymous 字段为 true
    const result = await db
      .update(user)
      .set({ isAnonymous: true })
      .where(sql`email LIKE 'guest-%' AND "isAnonymous" = false`);

    console.log(`✅ 成功迁移 ${guestUsersArray.length} 个访客用户！`);
    console.log("所有 guest- 开头的用户已标记为 isAnonymous = true\n");

    // 验证迁移结果
    const verification = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE email LIKE 'guest-%' AND "isAnonymous" = true) AS "correctly_marked",
        COUNT(*) FILTER (WHERE email LIKE 'guest-%' AND "isAnonymous" = false) AS "remaining",
        COUNT(*) FILTER (WHERE email LIKE 'guest-%') AS "total_guest_users"
      FROM "User"
    `);

    const verificationRow = (verification as unknown as Record<string, string>[])[0] ?? {};
    console.log("迁移验证：");
    console.log(`  - 总访客用户数: ${Number(verificationRow.total_guest_users ?? 0)}`);
    console.log(`  - 已正确标记: ${Number(verificationRow.correctly_marked ?? 0)}`);
    console.log(`  - 待标记: ${Number(verificationRow.remaining ?? 0)}`);
  } catch (error) {
    console.error("❌ 迁移失败:", error);
    process.exit(1);
  }
}

// 执行迁移
migrateGuestUsers()
  .then(() => {
    console.log("\n迁移完成！");
    process.exit(0);
  })
  .catch((error) => {
    console.error("迁移过程中发生错误:", error);
    process.exit(1);
  });
