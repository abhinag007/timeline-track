import { readDemoKey } from "@/lib/claude-key";
import { getSession } from "@/lib/session";
import { ClaudeKeyButton, ClaudeKeyDialog } from "./ClaudeKey";

// Server wrappers: they render nothing outside a demo session.
async function demoKeyState(): Promise<{ hasKey: boolean } | null> {
  const session = await getSession();
  if (!session?.demo) return null;
  return { hasKey: Boolean(await readDemoKey(session.userId)) };
}

export async function DemoKeyButton({ compact = false }: { compact?: boolean }) {
  const state = await demoKeyState();
  if (!state) return null;
  if (compact) return <ClaudeKeyButton hasKey={state.hasKey} compact />;
  return (
    <div className="card-flat space-y-3 p-4">
      <div>
        <p className="text-sm font-medium">Demo account</p>
        <p className="mt-1 text-xs leading-relaxed text-muted">Sample data, deleted after 24 hours or when you sign out.</p>
      </div>
      <ClaudeKeyButton hasKey={state.hasKey} />
    </div>
  );
}

export async function DemoKeyDialog() {
  const state = await demoKeyState();
  return state ? <ClaudeKeyDialog hasKey={state.hasKey} /> : null;
}
