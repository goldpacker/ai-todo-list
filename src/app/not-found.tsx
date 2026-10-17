import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 py-16">
      <p className="font-mono text-sm text-peach">404</p>
      <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">This task wandered off.</h1>
      <p className="max-w-md text-sm text-subtext0">
        No Task, Lane, Person or Initiative lives here. Maybe it was dropped, or an agent tidied it away.
      </p>
      <Link href="/" className={buttonClass("primary", "md", "mt-2")}>
        Back to Lanes
      </Link>
    </div>
  );
}
