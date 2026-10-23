import type { ConnectionList, ConnectionView } from "$lib/shared/contracts/connections";
import { fetchJson } from "../browser/fetch";

export const connectionUi = $state({
  busy: false,
  connections: [] as ConnectionView[],
  error: null as string | null,
});

export function resetConnectionUi(): void {
  connectionUi.busy = false;
  connectionUi.connections = [];
  connectionUi.error = null;
}

export async function loadConnections(method: "GET" | "POST" = "GET"): Promise<void> {
  connectionUi.busy = true;
  try {
    const listed = await fetchJson<ConnectionList>("/api/connections", { method });
    connectionUi.connections = listed.connections ?? [];
    connectionUi.error = null;
  } catch (err) {
    connectionUi.error = err instanceof Error ? err.message : String(err);
  } finally {
    connectionUi.busy = false;
  }
}
