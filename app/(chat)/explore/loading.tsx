import { Skeleton } from "@/components/ui/skeleton";
export default function ExploreLoading() {
  return <div className="page-container pb-tabbar"><div className="mb-8 space-y-3"><Skeleton className="h-8 w-48" /></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({length:9}).map((_,i)=><div key={i} className="rounded-2xl border p-5 space-y-3"><Skeleton className="size-12 rounded-xl" /><Skeleton className="h-3 w-full" /></div>)}</div></div>;
}
