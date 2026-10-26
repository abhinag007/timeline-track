import { LogOut } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/actions";
import { SidebarNav, SidebarNavList, TabBar, TabBarList } from "@/components/NavLinks";
import { LogoTile } from "@/components/Logo";
import { PageSkeleton } from "@/components/ui";
import SubmitButton from "@/components/SubmitButton";
import ThemeToggle from "@/components/ThemeToggle";

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <LogoTile />
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight">Timeline</span>
        <span className="block text-xs text-faint">Track your days</span>
      </span>
    </Link>
  );
}

// The shell is static; every page reads the session itself (requireUserId),
// so pages stream in behind the Suspense boundary.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <p className="eyebrow mt-9 mb-2 px-3">Menu</p>
        <Suspense fallback={<SidebarNavList pathname={null} />}>
          <SidebarNav />
        </Suspense>

        <div className="mt-auto space-y-3">
          <div className="card-flat p-4">
            <p className="text-sm font-medium">End-of-day ritual</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">Write one messy paragraph. Claude turns it into done items, to-dos and events.</p>
          </div>
          <div className="flex items-center gap-1">
            <form action={logout} className="flex-1">
              <SubmitButton className="btn-ghost w-full justify-start px-3 py-2.5">
                <LogOut className="size-4" />
                Sign out
              </SubmitButton>
            </form>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/80 px-4 py-3 backdrop-blur-xl lg:hidden">
          <Logo />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <form action={logout}>
              <SubmitButton className="icon-btn" title="Sign out" aria-label="Sign out">
                <LogOut className="size-4" />
              </SubmitButton>
            </form>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-32 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
      </div>

      <Suspense fallback={<TabBarList pathname={null} />}>
        <TabBar />
      </Suspense>
    </div>
  );
}
