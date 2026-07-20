import { Skeleton } from "@/components/ui/skeleton";
export default function ChatLoading() {
  return <div className="flex h-dvh w-full"><div className="flex-1 flex flex-col"><div className="flex-1 p-4 space-y-4"><Skeleton className="h-12 w-2/3 rounded-2xl" /></div><div className="border-t p-4"><Skeleton className="h-24 rounded-2xl" /></div></div></div>;
}
