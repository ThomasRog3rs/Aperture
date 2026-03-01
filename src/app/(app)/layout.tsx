import { Sidebar } from "@/components/Sidebar";
import { Suspense } from "react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Suspense fallback={<div className="hidden w-64 sm:block border-r border-border bg-background" />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col sm:ml-64">
        {children}
      </div>
    </div>
  );
}
