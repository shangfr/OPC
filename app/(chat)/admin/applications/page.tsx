import { ClipboardCheck } from "lucide-react";
import { getPendingListingApplications } from "@/lib/db/queries";
import { ApplicationReviewView } from "./review-view";

/**
 * 管理员后台：上架/下架申请审核页。
 */
export default async function AdminApplicationsPage() {
  const applications = await getPendingListingApplications();

  return (
    <div className="page-container pb-tabbar">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="size-6 text-primary" />
        <div>
          <h1 className="page-title">上架审核</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            审核创作者/企业提交的 OPC 上架与下架申请。
          </p>
        </div>
      </div>

      {/* 待审核数量徽标 */}
      <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
        <span className="size-2 rounded-full bg-amber-500" />
        <span className="text-sm font-medium">
          待审核申请 {applications.length} 条
        </span>
      </div>

      {applications.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
            <ClipboardCheck className="size-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium">暂无待审核申请</p>
            <p className="mt-1 text-xs text-muted-foreground">
              所有上架/下架申请已处理完毕
            </p>
          </div>
        </div>
      ) : (
        <ApplicationReviewView
          applications={applications.map((a) => ({
            id: a.id,
            agentId: a.agentId,
            agentName: a.agentName,
            applicantName: a.applicantName,
            type: a.type,
            description: a.description,
            status: a.status,
            createdAt: a.createdAt.toISOString(),
          }))}
        />
      )}
    </div>
  );
}
