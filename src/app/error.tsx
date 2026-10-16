"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const message = error instanceof Error && error.message ? error.message : "An unexpected error occurred.";
  return (
    <div role="alert" className="flex flex-col items-start gap-4 py-16">
      <p className="font-mono text-sm text-red">error</p>
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Well, that wasn’t supposed to happen.</h1>
      <p className="max-w-lg rounded-xl bg-mantle px-4 py-3 font-mono text-ui text-subtext1">{message}</p>
      <Button variant="primary" onClick={() => retry()}>
        Try again
      </Button>
    </div>
  );
}
