"use server";

import { compare } from "bcrypt-ts";
import { z } from "zod";

import { DUMMY_PASSWORD } from "@/lib/constants";
import {
  countRecentPhoneCodes,
  createUser,
  createUserByPhone,
  getUser,
  getUserByPhone,
  verifyPhoneCode,
  createTeamWithOwner,
} from "@/lib/db/queries";
import {
  isValidChinaPhone,
  normalizePhone,
  SMS_RATE_LIMIT,
} from "@/lib/ai/sms-service";

import { signIn } from "./auth";

const authFormSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(6, "密码至少需要 6 个字符"),
});

export type LoginActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "invalid_data"
    | "user_not_found"
    | "wrong_password";
  message?: string;
};

export const login = async (
  _: LoginActionState,
  formData: FormData
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    // 先查用户是否存在，区分"用户不存在"和"密码错误"
    // 使用 dummy password 做 timing-safe 比较，防止邮箱枚举
    const users = await getUser(validatedData.email);

    if (users.length === 0) {
      await compare(validatedData.password, DUMMY_PASSWORD);
      return { status: "user_not_found" };
    }

    const [user] = users;

    if (!user.password) {
      await compare(validatedData.password, DUMMY_PASSWORD);
      return { status: "user_not_found" };
    }

    const passwordsMatch = await compare(validatedData.password, user.password);

    if (!passwordsMatch) {
      return { status: "wrong_password" };
    }

    // 凭证正确，调用 signIn 创建 session
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        status: "invalid_data",
        message: firstError?.message ?? "提交数据验证失败",
      };
    }

    return { status: "failed", message: "登录失败，请稍后重试" };
  }
};

export type RegisterActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    | "invalid_data";
  message?: string;
};

export const register = async (
  _: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.get("email"),
      password: formData.get("password"),
    });

    const [user] = await getUser(validatedData.email);

    if (user) {
      return { status: "user_exists", message: "该邮箱已被注册" };
    }

    await createUser(validatedData.email, validatedData.password);

    // SaaS 多租户：注册成功后自动为用户创建默认团队（owner 角色）
    try {
      const [newUser] = await getUser(validatedData.email);
      if (newUser) {
        await createTeamWithOwner({
          userId: newUser.id,
          name: `${newUser.email?.split("@")[0] ?? "我的"}的团队`,
        });
      }
    } catch {
      // 团队创建失败不阻断注册流程，用户可在团队设置页手动创建
    }

    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        status: "invalid_data",
        message: firstError?.message ?? "提交数据验证失败",
      };
    }

    return { status: "failed", message: "注册失败，请稍后重试" };
  }
};

// ===== 手机号注册登录 =====

const phoneSchema = z.object({
  phone: z.string().min(1, "手机号不能为空"),
  code: z.string().length(6, "验证码必须是 6 位数字"),
});

export type PhoneActionState = {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "invalid_data"
    | "user_exists"
    | "user_not_found"
    | "code_invalid"
    | "rate_limited";
  message?: string;
};

/**
 * 手机号注册：校验验证码 → 创建用户 → 自动登录
 */
export const registerByPhone = async (
  _: PhoneActionState,
  formData: FormData
): Promise<PhoneActionState> => {
  try {
    const raw = {
      phone: formData.get("phone"),
      code: formData.get("code"),
    };

    let phone = String(raw.phone ?? "");
    const code = String(raw.code ?? "");

    if (!isValidChinaPhone(phone)) {
      return {
        status: "invalid_data",
        message: "手机号格式不正确，请输入 11 位中国大陆手机号",
      };
    }

    phone = normalizePhone(phone);

    if (!/^\d{6}$/.test(code)) {
      return {
        status: "invalid_data",
        message: "验证码必须是 6 位数字",
      };
    }

    // 检查是否已注册
    const existing = await getUserByPhone(phone);
    if (existing.length > 0) {
      return { status: "user_exists", message: "该手机号已注册，请直接登录" };
    }

    // 校验验证码
    const valid = await verifyPhoneCode(phone, code, "register");
    if (!valid) {
      return {
        status: "code_invalid",
        message: "验证码错误或已过期，请重新获取",
      };
    }

    // 创建用户
    await createUserByPhone(phone);

    // SaaS 多租户：注册成功后自动为用户创建默认团队（owner 角色）
    try {
      const [newUser] = await getUserByPhone(phone);
      if (newUser) {
        await createTeamWithOwner({
          userId: newUser.id,
          name: `${phone.slice(-4)}的团队`,
        });
      }
    } catch {
      // 团队创建失败不阻断注册流程
    }

    // 自动登录（使用 phone provider，password 传 "phone-verified" 占位）
    await signIn("phone", {
      phone,
      password: "phone-verified",
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: "invalid_data",
        message: error.errors[0]?.message ?? "提交数据验证失败",
      };
    }
    return { status: "failed", message: "注册失败，请稍后重试" };
  }
};

/**
 * 手机号登录：校验验证码 → 查找用户 → 自动登录
 */
export const loginByPhone = async (
  _: PhoneActionState,
  formData: FormData
): Promise<PhoneActionState> => {
  try {
    let phone = String(formData.get("phone") ?? "");
    const code = String(formData.get("code") ?? "");

    if (!isValidChinaPhone(phone)) {
      return {
        status: "invalid_data",
        message: "手机号格式不正确，请输入 11 位中国大陆手机号",
      };
    }

    phone = normalizePhone(phone);

    if (!/^\d{6}$/.test(code)) {
      return {
        status: "invalid_data",
        message: "验证码必须是 6 位数字",
      };
    }

    // 检查用户是否存在
    const existing = await getUserByPhone(phone);
    if (existing.length === 0) {
      return { status: "user_not_found", message: "该手机号未注册，请先注册" };
    }

    // 校验验证码
    const valid = await verifyPhoneCode(phone, code, "login");
    if (!valid) {
      return {
        status: "code_invalid",
        message: "验证码错误或已过期，请重新获取",
      };
    }

    // 自动登录
    await signIn("phone", {
      phone,
      password: "phone-verified",
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        status: "invalid_data",
        message: error.errors[0]?.message ?? "提交数据验证失败",
      };
    }
    return { status: "failed", message: "登录失败，请稍后重试" };
  }
};

/**
 * 检查发送验证码前的限流（供前端调用前预检）
 */
export async function checkPhoneRateLimit(phone: string): Promise<{
  ok: boolean;
  message?: string;
}> {
  const normalized = normalizePhone(phone);
  if (!isValidChinaPhone(normalized)) {
    return { ok: false, message: "手机号格式不正确" };
  }

  const count = await countRecentPhoneCodes(normalized, 60);
  if (count >= SMS_RATE_LIMIT.maxPerHour) {
    return {
      ok: false,
      message: `发送过于频繁，每小时最多 ${SMS_RATE_LIMIT.maxPerHour} 次`,
    };
  }

  return { ok: true };
}
