import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-16">
      <p className="text-xs font-medium text-subtle">404</p>
      <h1 className="text-lg font-semibold tracking-tight">Not found</h1>
      <p className="text-ui text-muted">That Task, Lane, Person or Initiative doesn’t exist, or was removed.</p>
      <Link href="/" className={buttonClass("secondary", "sm", "mt-2")}>
        Back to Today
      </Link>
    </div>
  );
}
