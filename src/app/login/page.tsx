"use client";

import { ArrowRight, CalendarClock, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { login } from "@/app/actions";
import { LogoTile } from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

const SAMPLE = [
  { icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-300", title: "Fixed the token refresh bug", tag: "Building" },
  { icon: CheckCircle2, tone: "bg-emerald-500/15 text-emerald-300", title: "Reviewed two pull requests", tag: "Work" },
  { icon: Circle, tone: "bg-amber-500/15 text-amber-300", title: "Write tests for the webhook handler", tag: "Building" },
  { icon: CalendarClock, tone: "bg-sky-500/15 text-sky-300", title: "Sprint demo · tomorrow", tag: "Work" },
];

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-white/5 bg-[#111110] p-12 text-[#eeeeec] lg:flex lg:flex-col">
        <div className="relative flex items-center gap-2.5">
          <LogoTile />
          <span className="font-semibold tracking-tight">Timeline Track</span>
        </div>

        <div className="relative my-auto max-w-md">
          <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight">Write one messy paragraph. Get a clean timeline.</h1>
          <p className="mt-4 text-[#b5b3ad]">Claude splits your day into what you did, what&apos;s left and what&apos;s coming up, then keeps track for you.</p>

          <div className="mt-10 space-y-2.5 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            {SAMPLE.map(({ icon: Icon, tone, title, tag }, i) => (
              <div key={title} className="rise flex items-center gap-3 rounded-2xl bg-white/[0.05] px-3 py-2.5" style={{ animationDelay: `${200 + i * 120}ms` }}>
                <span className={`flex size-7 items-center justify-center rounded-lg ${tone}`}>
                  <Icon className="size-3.5" strokeWidth={2.4} />
                </span>
                <span className="flex-1 text-sm font-medium">{title}</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-[#b5b3ad]">{tag}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-[#7c7b74]">Late nights count: days roll over at 4 AM</p>
      </div>

      <main className="relative flex items-center justify-center px-5 py-12">
        <ThemeToggle className="icon-btn absolute top-4 right-4" />
        <form action={action} className="w-full max-w-sm space-y-6">
          <div>
            <div className="mb-6 lg:hidden">
              <LogoTile size="lg" />
            </div>
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
