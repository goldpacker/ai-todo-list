"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const message = error instanceof Error && error.message ? error.message : "An unexpected error occurred.";
  return (
    <div role="alert" className="flex flex-col items-start gap-3 py-16">
      <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-lg text-ui text-muted">{message}</p>
      <Button size="sm" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
