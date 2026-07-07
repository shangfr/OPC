import { getPendingListingApplications } from "@/lib/db/queries";
import { ApplicationReviewView } from "./review-view";

/**
 * 管理员后台：上架/下架申请审核页。
 */
export default async function AdminApplicationsPage() {
  const applications = await getPendingListingApplications();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">上架审核</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        审核创作者/企业提交的 OPC 上架与下架申请。
      </p>

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
    </div>
  );
}
