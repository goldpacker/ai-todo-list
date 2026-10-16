import "server-only";
import { notFound } from "next/navigation";
import { TodoError } from "@/core/errors";

/** Parses a route id param, 404ing on anything that isn't a positive integer. */
export function parseId(param: string): number {
  const id = Number(param);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return id;
}

/** Runs a core read, turning the core's NOT_FOUND into the app's 404 page. */
export function orNotFound<T>(read: () => T): T {
  try {
    return read();
  } catch (err) {
    if (err instanceof TodoError && err.code === "NOT_FOUND") notFound();
    throw err;
  }
}
