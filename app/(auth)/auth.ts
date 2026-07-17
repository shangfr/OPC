import { compare } from "bcrypt-ts";
import { and, eq } from "drizzle-orm";
import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { DUMMY_PASSWORD } from "@/lib/constants";
import {
  getUser,
  getUserByPhone,
} from "@/lib/db/queries";
import { db } from "@/lib/db/queries";
import { teamMember, user as userTable } from "@/lib/db/schema"; // 修复点 1：添加别名 user as userTable
import { authConfig } from "./auth.config";

export type UserType = "guest" | "regular";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
      role?: string | null;
      phone?: string | null;
      // SaaS 多租户：当前选中的团队 ID（用于租户隔离）
      teamId?: string | null;
      // SaaS 多租户：当前用户在团队中的角色（owner/admin/member）
      teamRole?: "owner" | "admin" | "member" | null;
      // OPC 交易市场：账号类型 personal(2C) / enterprise(2B) / platform(平台)
      accountType?: "personal" | "enterprise" | "platform" | null;
      // 企业账号所属企业 ID
      enterpriseId?: string | null;
      // 套餐驱动型权限：用户级套餐（free/creator/team/enterprise）
      planName?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
    role?: string | null;
    phone?: string | null;
    teamId?: string | null;
    teamRole?: "owner" | "admin" | "member" | null;
    accountType?: "personal" | "enterprise" | "platform" | null;
    enterpriseId?: string | null;
    planName?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
    role?: string | null;
    phone?: string | null;
    // SaaS 多租户：当前团队 ID（持久化在 JWT 中，避免每次请求查库）
    teamId?: string | null;
    // SaaS 多租户：当前用户在团队中的角色
    teamRole?: "owner" | "admin" | "member" | null;
    // OPC 交易市场：账号类型与企业归属
    accountType?: "personal" | "enterprise" | "platform" | null;
    enterpriseId?: string | null;
    // 套餐驱动型权限
    planName?: string | null;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
  unstable_update,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials.email ?? "");
        const password = String(credentials.password ?? "");

        const users = await getUser(email);
        if (users.length === 0) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const [user] = users;
        if (!user.password) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const passwordsMatch = await compare(password, user.password);
        if (!passwordsMatch) {
          return null;
        }

        return { ...user, type: "regular" };
      },
    }),
    // 手机号验证码登录 provider
    // 验证码已在 /api/phone/send-code + actions.ts 中校验，
    // 此处仅根据手机号查找用户并返回（password 字段传 "phone-verified" 占位）
    Credentials({
      id: "phone",
      credentials: {
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const phone = String(credentials.phone ?? "");
        // password 字段是 NextAuth 必填，这里传 "phone-verified" 占位
        const password = String(credentials.password ?? "");

        if (!phone || password !== "phone-verified") {
          return null;
        }

        const users = await getUserByPhone(phone);
        if (users.length === 0) {
          return null;
        }

        const [user] = users;
        return { ...user, type: "regular" };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // 登录时：从 user 对象写入基础信息
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
        token.role = user.role;
        token.phone = (user as { phone?: string | null }).phone ?? null;

        // SaaS：登录时若 user 对象带 teamId（如切换团队 action 传入）则写入 token
        const u = user as { teamId?: string | null };
        if (u.teamId !== undefined) {
          token.teamId = u.teamId;
        }

        // OPC 交易市场：写入账号类型与企业归属
        const mu = user as {
          accountType?: "personal" | "enterprise" | null;
          enterpriseId?: string | null;
        };
        token.accountType = mu.accountType ?? "personal";
        token.enterpriseId = mu.enterpriseId ?? null;
        token.planName = (mu as { planName?: string | null }).planName ?? "free";
      }

      // 会话更新：当调用 unstable_update({ picture, name }) 时，
      // 将更新后的字段写入 token，并持久化到 session cookie。
      // 解决纯 Server Component 模式下 refresh_session cookie 无法持久化 token 的问题。
      if (trigger === "update" && session) {
        const updateData = session as {
          picture?: string | null;
          name?: string | null;
        };
        if (updateData.picture !== undefined) {
          token.picture = updateData.picture;
        }
        if (updateData.name !== undefined) {
          token.name = updateData.name;
        }
      }

      // SaaS：首次登录若 token 中无 teamId，懒加载用户加入的第一个团队
      // （仅在 user 存在的登录瞬间执行一次，不会在每次请求都查库）
      if (user && token.id && token.teamId === undefined) {
        const [first] = await db
          .select({ teamId: teamMember.teamId, role: teamMember.role })
          .from(teamMember)
          .where(eq(teamMember.userId, token.id))
          .limit(1);

        token.teamId = first?.teamId ?? null;
        token.teamRole = first?.role ?? null;
      }

      // SaaS：从 cookie 读取 switchTeamAction 设置的目标 teamId
      // 纯 Server Component 模式下替代 useSession().update({ teamId })
      {
        try {
          const cookieStore = await cookies();
          const switchTeamId = cookieStore.get("switch_team_id")?.value;
          if (switchTeamId) {
            token.teamId = switchTeamId;
            // 同步刷新 teamRole
            const [tm] = await db
              .select({ role: teamMember.role })
              .from(teamMember)
              .where(
                and(
                  eq(teamMember.userId, token.id),
                  eq(teamMember.teamId, switchTeamId)
                )
              )
              .limit(1);
            token.teamRole = tm?.role ?? null;
            // 读取后清除 cookie，避免后续请求重复设置
            cookieStore.delete("switch_team_id");
          }
        } catch {
          // cookies() 在某些环境可能不可用（如 WebSocket），静默忽略
        }
      }

      // 会话刷新：当 Server Action 修改了用户的 accountType / enterpriseId 后，
      // 设置 refresh_session cookie 触发此处从 DB 重新读取最新字段，
      // 确保 token 中的 accountType / enterpriseId / teamId 与数据库一致。
      // （纯 Server Component 模式下替代 useSession().update()）
      {
        try {
          const cookieStore = await cookies();
          const refresh = cookieStore.get("refresh_session")?.value;
          if (refresh && token.id) {
            // 从 DB 重新读取用户最新状态
            // 修复点 2：使用 userTable 替代被遮蔽的 user 变量
            const [latest] = await db
              .select({
                accountType: userTable.accountType,
                enterpriseId: userTable.enterpriseId,
                planName: userTable.planName,
              })
              .from(userTable)
              .where(eq(userTable.id, token.id))
              .limit(1);

            if (latest) {
              token.accountType = latest.accountType;
              token.enterpriseId = latest.enterpriseId ?? null;
              token.planName = latest.planName ?? "free";

              // 若升级为企业账号后尚无 teamId，懒加载第一个团队
              if (!token.teamId) {
                const [first] = await db
                  .select({ teamId: teamMember.teamId, role: teamMember.role })
                  .from(teamMember)
                  .where(eq(teamMember.userId, token.id))
                  .limit(1);

                token.teamId = first?.teamId ?? null;
                token.teamRole = first?.role ?? null;
              } else {
                // teamId 已存在，刷新 teamRole
                const [tm] = await db
                  .select({ role: teamMember.role })
                  .from(teamMember)
                  .where(
                    and(
                      eq(teamMember.userId, token.id),
                      eq(teamMember.teamId, token.teamId)
                    )
                  )
                  .limit(1);
                token.teamRole = tm?.role ?? null;
              }
            }

            // 同步刷新用户名和头像（个人页编辑后立即生效）
            const [latestUser] = await db
              .select({ name: userTable.name, image: userTable.image })
              .from(userTable)
              .where(eq(userTable.id, token.id))
              .limit(1);
            if (latestUser) {
              token.name = latestUser.name ?? null;
              token.picture = latestUser.image ?? null;
            }

            // 读取后清除 cookie
            cookieStore.delete("refresh_session");
          }
        } catch {
          // 静默忽略
        }
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
        session.user.role = token.role;
        session.user.phone = token.phone;

        // 显式映射 token.picture → session.user.image
        // 确保头像更新后 session 中 image 字段与 token 保持一致
        session.user.image = token.picture ?? null;
        // 显式映射 token.name → session.user.name
        session.user.name = token.name ?? null;

        // SaaS：把当前团队 ID 透传到 session，供 Server Component / API 读取
        session.user.teamId = token.teamId ?? null;
        session.user.teamRole = token.teamRole ?? null;

        // OPC 交易市场：透传账号类型与企业归属
        session.user.accountType = token.accountType ?? "personal";
        session.user.enterpriseId = token.enterpriseId ?? null;
        // 套餐驱动型权限
        session.user.planName = token.planName ?? "free";
      }
      return session;
    },
  },
});
