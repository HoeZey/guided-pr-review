import type { StoredAction } from "../../shared/contracts/catalog.ts";
import type { ActionRepository } from "../repositories/ports.ts";

export type ActionService = {
  queue: (input: unknown) => Promise<{ id: string }>;
  wait: (input?: unknown) => Promise<StoredAction | null>;
  complete: (input: unknown) => Promise<{ ok: true }>;
};

export function createActionService(repos: ActionRepository): ActionService {
  return {
    queue: (input) => repos.queueAction(input),
    wait: (input) => repos.waitForAction(input),
    complete: (input) => repos.completeAction(input),
  };
}
