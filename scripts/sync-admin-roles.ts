import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { config } from "dotenv";
import { user } from "@/lib/db/schema";

// 加载 .env.local 文件
config({ path: ".env.local" });

async function syncAdminRoles() {
  console.log("开始同步管理员角色...\n");

  // 获取环境变量中的管理员邮箱
  const adminEmailsRaw = process.env.ADMIN_EMAILS ?? "";
  const adminEmails = adminEmailsRaw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (adminEmails.length === 0) {
    console.log("✅ ADMIN_EMAILS 未配置，无需同步");
    return;
  }

  console.log(`ADMIN_EMAILS 配置的管理员邮箱 (${adminEmails.length} 个)：`);
  adminEmails.forEach((email, index) => {
    console.log(`  ${index + 1}. ${email}`);
  });
  console.log("");

  // 初始化数据库连接
  const client = postgres(process.env.POSTGRES_URL ?? "");
  const db = drizzle(client);

  try {
    // 查找这些邮箱对应的用户
    const foundUsers = await db.execute(sql`
      SELECT id, email, role
      FROM "User"
      WHERE LOWER(email) IN (${sql.join(
        adminEmails.map((email) => sql`${email}`),
        { separator: ", " }
      )})
    `);

    const foundUsersArray = (foundUsers as unknown as Array<{
      id: string;
      email: string;
      role: string;
    }>) || [];

    console.log(`找到 ${foundUsersArray.length} 个对应用户：\n`);

    if (foundUsersArray.length === 0) {
      console.log("⚠️ 未找到对应用户，请先确保这些邮箱的用户已注册");
      return;
    }

    // 显示当前角色状态
    foundUsersArray.forEach((u, index) => {
      const isAlreadyAdmin = u.role === "admin";
      console.log(
        `${index + 1}. ${u.email} (ID: ${u.id}) - 当前角色: ${u.role} ${isAlreadyAdmin ? "✓" : "需要更新"}`
      );
    });
    console.log("");

    // 筛选出需要更新的用户
    const usersToUpdate = foundUsersArray.filter((u) => u.role !== "admin");

    if (usersToUpdate.length === 0) {
      console.log("✅ 所有管理员邮箱对应的用户已正确设置 role='admin'，无需更新");
      return;
    }

    console.log(`准备更新 ${usersToUpdate.length} 个用户的角色为 admin...\n`);

    // 更新这些用户的角色
    const result = await db
      .update(user)
      .set({ role: "admin" })
      .where(
        sql`id IN (${sql.join(
          usersToUpdate.map((u) => u.id),
          { separator: ", " }
        )})`
      );

    console.log(`✅ 成功更新 ${usersToUpdate.length} 个用户的角色为 admin！\n`);

    // 验证更新结果
    const verification = await db.execute(sql`
      SELECT email, role
      FROM "User"
      WHERE LOWER(email) IN (${sql.join(
        adminEmails.map((email) => sql`${email}`),
        { separator: ", " }
      )})
      ORDER BY email
    `);

    const verificationArray = (verification as unknown as Array<{
      email: string;
      role: string;
    }>) || [];

    console.log("验证结果：");
    verificationArray.forEach((u, index) => {
      console.log(`  ${index + 1}. ${u.email} - role: ${u.role} ${u.role === "admin" ? "✓" : "✗"}`);
    });

    // 检查是否有邮箱没有找到对应用户
    const foundEmails = foundUsersArray.map((u) => u.email.toLowerCase());
    const notFoundEmails = adminEmails.filter(
      (email) => !foundEmails.includes(email)
    );

    if (notFoundEmails.length > 0) {
      console.log(`\n⚠️ 以下邮箱在数据库中未找到对应用户：`);
      notFoundEmails.forEach((email) => {
        console.log(`  - ${email}`);
      });
      console.log("这些用户注册后需要手动设置角色为 admin，或重新运行此脚本。");
    }
  } catch (error) {
    console.error("❌ 同步失败:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

syncAdminRoles()
  .then(() => {
    console.log("\n同步完成！");
    process.exit(0);
  })
  .catch((error) => {
    console.error("同步过程中发生错误:", error);
    process.exit(1);
  });
