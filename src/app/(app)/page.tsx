import { Suspense } from "react";
import { LibraryView } from "@/components/LibraryView";
import { Loader2 } from "lucide-react";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-accent" />
        </div>
      }
    >
      <LibraryView />
    </Suspense>
  );
}
