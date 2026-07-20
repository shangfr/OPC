import { Skeleton } from "@/components/ui/skeleton";
export default function AdminLoading() {
  return <div className="page-container pb-tabbar"><div className="mb-6 space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72" /></div><div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4">{Array.from({length:4}).map((_,i)=><div key={i} className="rounded-xl border border-border/40 p-4 space-y-3"><Skeleton className="h-4 w-20" /><Skeleton className="h-8 w-16" /></div>)}</div></div>;
}
