import { z } from "zod";
import { ACTORS, LANES, PREP_KINDS, PRIORITIES } from "./domain";
import { TodoError } from "./errors";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date as YYYY-MM-DD")
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), "Not a real calendar date")
  .describe("Calendar date, YYYY-MM-DD");

const nonEmpty = (what: string) => z.string().trim().min(1, `${what} must not be empty`);

export const sourceInput = z
  .object({
    url: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Link to the Slack thread, ticket, doc, etc. Omit for a conversation."),
    summary: nonEmpty("Source summary").describe(
      "The relevant context distilled at capture time, so a Worker can act without opening the link.",
    ),
  })
  .describe("Where the Task came from");

export const personRef = z
  .union([
    nonEmpty("Person").describe('A name ("Priya Shah") or a handle ("@priya")'),
    z.object({
      name: nonEmpty("Person name"),
      handles: z.array(nonEmpty("Handle")).optional().describe('e.g. ["@priya", "priya@corp.com"]'),
      role: z.string().trim().min(1).optional().describe('How they relate to the Task, e.g. "author", "decider"'),
    }),
  ])
  .describe("A Person linked to the Task; unknown people are created automatically");

export const taskInput = z.object({
  title: nonEmpty("Title"),
  description: z.string().optional().describe("What done looks like, constraints, acceptance criteria"),
  lane: z.enum(LANES).describe("Exactly one Lane; see `lanes` for definitions"),
  priority: z.enum(PRIORITIES).optional().describe("Defaults to normal"),
  dueDate: isoDate.optional(),
  repo: nonEmpty("Repo").optional().describe("Registered Repo name. Required for the delegate Lane."),
  sources: z.array(sourceInput).optional(),
  people: z.array(personRef).optional(),
  parentId: z.number().int().positive().optional().describe("Existing Initiative to file this Task under"),
});

export const initiativeInput = z.object({
  title: nonEmpty("Title"),
  description: z.string().optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: isoDate.optional(),
  sources: z.array(sourceInput).optional(),
  people: z.array(personRef).optional(),
});

export const captureInput = z
  .object({
    initiative: z
      .union([initiativeInput, z.object({ id: z.number().int().positive() })])
      .optional()
      .describe("Create a new Initiative for these Tasks, or { id } to add them to an existing one"),
    tasks: z.array(taskInput).min(1, "Provide at least one Task"),
    force: z.boolean().optional().describe("Add even if a Source URL is already on file"),
  })
  .describe("Atomic capture: either every Task is written or none are");

export const taskPatch = z.object({
  title: nonEmpty("Title").optional(),
  description: z.string().optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: isoDate.nullable().optional().describe("null clears the due date"),
  repo: nonEmpty("Repo").nullable().optional(),
  people: z.array(personRef).optional().describe("Replaces the linked People"),
  parentId: z.number().int().positive().nullable().optional(),
  followUpDays: z.number().int().min(0).nullable().optional(),
});

export const prepInput = z.object({
  kind: z.enum(PREP_KINDS),
  body: nonEmpty("Prep body").describe("Markdown"),
  author: z.string().trim().min(1).optional().describe('Defaults to "worker"'),
  ready: z.boolean().optional().describe("Also move the Task to ready"),
});

export const repoInput = z.object({
  name: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9._-]+$/, "Repo names may contain letters, digits, '.', '_' and '-'"),
  path: nonEmpty("Repo path"),
  remote: z.string().trim().min(1).optional(),
});

export const laneChangeInput = z.object({
  lane: z.enum(LANES),
  reason: nonEmpty("Reason"),
  actor: z.enum(ACTORS).optional().describe("Defaults to agent"),
  repo: nonEmpty("Repo").optional().describe("Needed when moving into the delegate Lane without a Repo"),
});

export const waitingInput = z.object({
  note: nonEmpty("Waiting note").describe("Who and what the Task is waiting on"),
  followUpDays: z.number().int().min(0).optional().describe("Days before a follow-up is drafted; default 3"),
});

export type SourceInput = z.infer<typeof sourceInput>;
export type PersonRef = z.infer<typeof personRef>;
export type TaskInput = z.infer<typeof taskInput>;
export type InitiativeInput = z.infer<typeof initiativeInput>;
export type CaptureInput = z.infer<typeof captureInput>;
export type TaskPatch = z.infer<typeof taskPatch>;
export type PrepInput = z.infer<typeof prepInput>;
export type RepoInput = z.infer<typeof repoInput>;
export type LaneChangeInput = z.infer<typeof laneChangeInput>;
export type WaitingInput = z.infer<typeof waitingInput>;

/** Validates at the core boundary and converts zod failures into a VALIDATION TodoError. */
export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issues = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  const summary = issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; ");
  throw new TodoError("VALIDATION", `Invalid input: ${summary}`, { issues });
}
