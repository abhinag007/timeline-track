"use client";

import { ArrowRight, CalendarClock, CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react";
import { useActionState } from "react";
import { login } from "@/app/actions";

const SAMPLE = [
  { icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-300", title: "Fixed the token refresh bug", tag: "Building" },
  { icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-300", title: "Reviewed two pull requests", tag: "Work" },
  { icon: Circle, tone: "bg-amber-500/15 text-amber-300", title: "Write tests for the webhook handler", tag: "Building" },
  { icon: CalendarClock, tone: "bg-violet-500/15 text-violet-200", title: "Sprint demo · tomorrow", tag: "Work" },
];

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-2">
      <div className="gradient-accent relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -top-32 -left-32 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -right-24 -bottom-40 size-[28rem] rounded-full bg-fuchsia-400/30 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Sparkles className="size-[18px]" />
          </span>
          <span className="font-semibold">Timeline</span>
        </div>

        <div className="relative my-auto max-w-md">
          <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight">Write one messy paragraph. Get a clean timeline.</h1>
          <p className="mt-4 text-white/75">Claude splits your day into what you did, what&apos;s left and what&apos;s coming up, then keeps track for you.</p>

          <div className="mt-10 space-y-2.5 rounded-3xl border border-white/15 bg-black/15 p-4 backdrop-blur-md">
            {SAMPLE.map(({ icon: Icon, tone, title, tag }, i) => (
              <div key={title} className="rise flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2.5" style={{ animationDelay: `${200 + i * 120}ms` }}>
                <span className={`flex size-7 items-center justify-center rounded-lg ${tone}`}>
                  <Icon className="size-3.5" strokeWidth={2.4} />
                </span>
                <span className="flex-1 text-sm font-medium">{title}</span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px]">{tag}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/60">Late nights count: days roll over at 4 AM</p>
      </div>

      <main className="flex items-center justify-center px-5 py-12">
        <form action={action} className="w-full max-w-sm space-y-6">
          <div>
            <span className="gradient-accent mb-6 flex size-11 items-center justify-center rounded-2xl text-white shadow-card lg:hidden">
              <Sparkles className="size-5" />
            </span>
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-1 text-sm text-muted">Sign in to log your day.</p>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="label">Email</span>
              <input name="email" type="email" required placeholder="you@example.com" autoComplete="email" className="input py-3" />
            </label>
            <label className="block">
              <span className="label">Password</span>
              <input name="password" type="password" required placeholder="••••••••" autoComplete="current-password" className="input py-3" />
            </label>
          </div>
          {state?.error && <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">{state.error}</p>}
          <button className="btn w-full py-3" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {pending ? "Signing in…" : "Sign in"}
            {!pending && <ArrowRight className="size-4" />}
          </button>
        </form>
      </main>
    </div>
  );
}
