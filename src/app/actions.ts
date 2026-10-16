"use server";

import { refresh } from "next/cache";
import { getCore } from "@/lib/core";
import * as m from "@/lib/mutations";
import type { ActionState } from "@/lib/mutations";

// Thin Server Actions: each forwards the submitted form to the core and refreshes the current route,
// so the response carries both the result and freshly rendered data in one round trip.
// (The app is single-user and bound to 127.0.0.1, so there is no auth layer; the core validates input.)

type Mutation = (core: ReturnType<typeof getCore>, fd: FormData) => ActionState;

async function run(mutation: Mutation, fd: FormData): Promise<ActionState> {
  const result = mutation(getCore(), fd);
  refresh();
  return result;
}

export async function addTaskAction(fd: FormData) {
  return run(m.addTask, fd);
}

export async function createInitiativeAction(fd: FormData) {
  return run(m.createInitiative, fd);
}

export async function updateTaskAction(fd: FormData) {
  return run(m.updateTask, fd);
}

export async function changeLaneAction(fd: FormData) {
  return run(m.changeLane, fd);
}

export async function markDoneAction(fd: FormData) {
  return run(m.markDone, fd);
}

export async function markReadyAction(fd: FormData) {
  return run(m.markReady, fd);
}

export async function dropAction(fd: FormData) {
  return run(m.drop, fd);
}

export async function reopenAction(fd: FormData) {
  return run(m.reopen, fd);
}

export async function setWaitingAction(fd: FormData) {
  return run(m.setWaiting, fd);
}

export async function addNoteAction(fd: FormData) {
  return run(m.addNote, fd);
}
