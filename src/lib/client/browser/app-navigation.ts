// Vitest aliases $app/navigation here. Production Home uses SvelteKit goto.
export async function goto(url: string): Promise<void> {
  history.pushState({}, "", url);
}
