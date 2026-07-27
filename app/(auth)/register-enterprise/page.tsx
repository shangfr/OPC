"use client";

import { Building2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "@/components/chat/toast";
import { registerEnterpriseAction } from "@/lib/enterprise/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
        <h1
          className="auth-slide-in text-[28px] font-bold tracking-tight text-center"
          style={{ animationDelay: "0.1s" }}
        >
          升级企业账号
        </h1>
        <p
          className="auth-slide-in text-[15px] text-muted-foreground/80 text-center"
          style={{ animationDelay: "0.18s" }}
        >
          升级为企业账号，获得团队功能并成为企业管理员
        </p>
      </div>

      <div
        className="auth-slide-in mt-5 w-full pt-2"
        style={{ animationDelay: "0.28s" }}
      >
        <form action={formAction} className="flex flex-col gap-4">
          {/* 企业信息分组 */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/80">
              <Separator className="flex-1" />
              企业信息
              <Separator className="flex-1" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="name">
                企业名称
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                placeholder="例如：智谱科技有限公司"
                className="h-11"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="creditCode">
                统一社会信用代码
              </label>
              <Input
                id="creditCode"
                name="creditCode"
                type="text"
                required
                placeholder="18 位信用代码"
                className="h-11"
              />
            </div>
          </div>

          {/* 联系信息分组 */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[13px] font-medium text-foreground/80">
              <Separator className="flex-1" />
              联系信息
              <Separator className="flex-1" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="contactName">
                联系人姓名
              </label>
              <Input
                id="contactName"
                name="contactName"
                type="text"
                required
                className="h-11"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="contactPhone">
                联系电话
              </label>
              <Input
                id="contactPhone"
                name="contactPhone"
                type="tel"
                required
                placeholder="企业联系电话"
                className="h-11"
              />
            </div>
          </div>

          {state?.error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {state.error}
            </div>
          )}

          <Button
            type="submit"
            disabled={pending}
            variant="gradient"
            className="h-11 w-full text-[15px] font-medium"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            升级企业账号
          </Button>

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
