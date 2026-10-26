"use client";

import { Check, KeyRound, Loader2, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { removeClaudeKey, saveClaudeKey } from "@/app/actions";

// Demo visitors bring their own Anthropic key. The dialog is mounted once in the
// app layout; anything can open it with openClaudeKeyDialog().
const OPEN_EVENT = "claude-key:open";
const ASKED = "claude-key-asked";

export function openClaudeKeyDialog() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function ClaudeKeyButton({ hasKey, compact = false }: { hasKey: boolean; compact?: boolean }) {
  if (compact) {
    return (
      <button
        type="button"
        onClick={openClaudeKeyDialog}
        className={hasKey ? "icon-btn" : "btn-secondary px-3 py-1.5 text-xs"}
        title={hasKey ? "Claude key added" : "Add your Claude API key"}
        aria-label={hasKey ? "Claude key added" : "Add Claude key"}
      >
        <KeyRound className="size-4" />
        {!hasKey && "Add key"}
      </button>
    );
  }
  return (
    <button type="button" onClick={openClaudeKeyDialog} className={hasKey ? "btn-ghost w-full justify-start px-3 py-2.5" : "btn w-full"}>
      {hasKey ? <Check className="size-4 text-accent" /> : <KeyRound className="size-4" />}
      {hasKey ? "Claude key added" : "Add Claude key"}
    </button>
  );
}

export function ClaudeKeyDialog({ hasKey }: { hasKey: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(saveClaudeKey, undefined);
  // The error from an earlier attempt is hidden when the dialog opens again.
  const [hideError, setHideError] = useState(false);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    setHideError(false);
  }

  useEffect(() => {
    const open = () => {
      setHideError(true);
      ref.current?.showModal();
    };
    window.addEventListener(OPEN_EVENT, open);
    // Ask once per browser session, right after the demo starts.
    if (!hasKey) {
      try {
        if (!sessionStorage.getItem(ASKED)) {
          sessionStorage.setItem(ASKED, "1");
          open();
        }
      } catch {}
    }
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, [hasKey]);

  useEffect(() => {
    if (state?.ok) ref.current?.close();
  }, [state]);

  return (
    <dialog
      ref={ref}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <form action={action} className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink text-bg">
            <KeyRound className="size-5" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-semibold tracking-tight">{hasKey ? "Your Claude API key" : "Add your Claude API key"}</h2>
            <p className="mt-1 text-sm text-muted">The demo uses your own Anthropic key to split logs and import roadmaps. Everything else works without one.</p>
          </div>
          <button type="button" onClick={() => ref.current?.close()} className="icon-btn -mt-1 -mr-2" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        {hasKey && (
          <p className="flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-ink">
            <Check className="size-4" /> A key is saved for this demo. Paste a new one to replace it.
          </p>
        )}

        <label className="block">
          <span className="label">API key</span>
          <input name="key" type="password" required placeholder="sk-ant-…" autoComplete="off" spellCheck={false} className="input py-3 font-mono" />
          <span className="mt-1.5 block text-xs text-faint">
            Get one at{" "}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink">
              console.anthropic.com
            </a>
            . Each log costs a few cents on your key; roadmap imports cost more.
          </span>
        </label>

        <p className="text-xs leading-relaxed text-faint">
          The key is stored encrypted in a cookie in this browser only. It is never saved to the database, and it is deleted when you sign out or the demo ends after 24
          hours.
        </p>

        {state?.error && !hideError && <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">{state.error}</p>}

        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasKey && (
            <button type="button" onClick={() => removeClaudeKey().then(() => ref.current?.close())} className="btn-ghost mr-auto text-rose-600 dark:text-rose-400">
              Remove key
            </button>
          )}
          <button type="button" onClick={() => ref.current?.close()} className="btn-secondary">
            Not now
          </button>
          <button className="btn" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? "Checking…" : "Save key"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
