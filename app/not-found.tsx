import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-7xl font-bold text-muted-foreground/20">404</div>
      <h1 className="text-2xl font-semibold tracking-tight">页面未找到</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        您访问的页面可能已被移除、重命名，或暂时不可用。
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        返回首页
      </Link>
    </div>
  );
}
