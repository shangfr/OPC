import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="page-container pb-tabbar">
      <div className="mb-6 space-y-3">
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="max-w-2xl space-y-6">
        <div className="rounded-xl border border-border/40 p-6 space-y-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="rounded-xl border border-border/40 p-6 space-y-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
