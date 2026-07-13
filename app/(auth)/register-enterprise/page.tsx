"use client";

import { Building2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "@/components/chat/toast";
import { registerEnterpriseAction } from "@/lib/enterprise/actions";

/**
 * 企业注册/升级页面
 *
 * 流程：
 * 1. 用户先注册个人账号（跳转到 /register）
 * 2. 登录后访问本页面填写企业信息
 * 3. 调用 registerEnterpriseAction 创建企业记录
 * 4. 用户升级为 enterprise 账号（企业管理员），获得团队功能
 *
 * 企业注册后账号类型变为 enterprise，可：
 * - 获得团队功能（创建团队、管理成员、创建团队个人账号）
 * - 创建/管理企业私有 OPC
 * - 申请上架 OPC 到公开市场（需管理员审核）
 * - 在交易市场订阅其他 OPC
 */
export default function RegisterEnterprisePage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const [state, formAction] = useActionState<
    { success: boolean; error?: string; data?: { id: string } },
    FormData
  >(async (_prev, formData) => {
    setPending(true);
    try {
      return await registerEnterpriseAction({
        name: (formData.get("name") as string) || "",
        creditCode: (formData.get("creditCode") as string) || "",
        contactName: (formData.get("contactName") as string) || "",
        contactPhone: (formData.get("contactPhone") as string) || "",
        licenseImage: null,
      });
    } finally {
      setPending(false);
    }
  }, { success: false });

  useEffect(() => {
    if (state?.success) {
      toast({ type: "success", description: "企业注册成功！已获得团队功能，正在跳转..." });
      router.push("/team");
    } else if (state?.error) {
      toast({ type: "error", description: state.error });
    }
  }, [state, router]);

  return (
    <>
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
          <Building2 className="size-6 text-primary" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">升级企业账号</h1>
        <p className="text-sm text-muted-foreground">
          升级为企业账号，获得团队功能并成为企业管理员
        </p>
      </div>

      <div className="auth-slide-in w-full" style={{ animationDelay: "0.28s" }}>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="name">
              企业名称
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder="例如：智谱科技有限公司"
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="creditCode">
              统一社会信用代码
            </label>
            <input
              id="creditCode"
              name="creditCode"
              type="text"
              required
              placeholder="18 位信用代码"
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="contactName">
              联系人姓名
            </label>
            <input
              id="contactName"
              name="contactName"
              type="text"
              required
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="contactPhone">
              联系电话
            </label>
            <input
              id="contactPhone"
              name="contactPhone"
              type="tel"
              required
              placeholder="企业联系电话"
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            升级企业账号
          </button>

          <p className="text-center text-[13px] text-muted-foreground">
            {"还没有账号？"}
            <Link
              className="text-foreground underline-offset-4 hover:underline"
              href="/register"
            >
              先注册账号
            </Link>
          </p>
        </form>
      </div>
    </>
  );
}
