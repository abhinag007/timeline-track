// Shimmer placeholders shaped like each page, used by the routes' loading.tsx
// so a click shows the new page's outline immediately.

function Bar({ className = "" }: { className?: string }) {
  return <div className={`shimmer rounded-lg ${className}`} />;
}

// Thin indeterminate bar along the top of the viewport while a page streams in.
export function TopProgress() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden">
      <div className="bg-accent progress-slide h-full w-1/3 rounded-full" />
    </div>
  );
}

function Header({ actions = false, back = false }: { actions?: boolean; back?: boolean }) {
  return (
    <div className="space-y-3">
      {back && <Bar className="mb-5 h-4 w-24" />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-3">
          <Bar className="h-3 w-28" />
          <Bar className="h-9 w-56 sm:w-72" />
          <Bar className="h-3.5 w-72 max-w-full sm:w-96" />
        </div>
        {actions && <Bar className="h-10 w-36 rounded-xl" />}
      </div>
    </div>
  );
}

function Stats() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="card space-y-4 p-4">
          <div className="flex justify-between">
            <Bar className="h-3 w-16" />
            <Bar className="size-7" />
          </div>
          <Bar className="h-7 w-20" />
          <Bar className="h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}

function ItemRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Bar className="size-7 shrink-0" />
          <div className="flex-1 space-y-2.5">
            <Bar className="h-3.5" />
            <div className="flex gap-2">
              <Bar className="h-4 w-16 rounded-full" />
              <Bar className="h-4 w-20 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading">
      <TopProgress />
      {children}
    </div>
  );
}

export function TodaySkeleton() {
  return (
    <Wrap>
      <Header />
      <Stats />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <Bar className="size-9 rounded-xl" />
            <div className="space-y-2">
              <Bar className="h-3.5 w-40" />
              <Bar className="h-2.5 w-52" />
            </div>
          </div>
          <Bar className="h-44 rounded-xl" />
          <div className="flex justify-end">
            <Bar className="h-10 w-40 rounded-xl" />
          </div>
        </div>
        <div className="card space-y-5">
          <Bar className="h-3.5 w-24" />
          <ItemRows count={3} />
        </div>
      </div>
    </Wrap>
  );
}

export function TimelineSkeleton() {
  return (
    <Wrap>
      <Header actions />
      <Stats />
      <div className="card space-y-4">
        <Bar className="h-3.5 w-20" />
        <Bar className="h-36 rounded-xl" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-4">
          <Bar className="h-[72px] w-14 shrink-0 rounded-2xl sm:w-16" />
          <div className="card flex-1 space-y-5">
            <Bar className="h-4 w-24" />
            <ItemRows count={3 - i} />
          </div>
        </div>
      ))}
    </Wrap>
  );
}

export function CardGridSkeleton({ back = false }: { back?: boolean }) {
  return (
    <Wrap>
      <Header actions back={back} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card space-y-5">
            <div className="flex items-center gap-3">
              <Bar className="size-10 rounded-xl" />
              <div className="space-y-2">
                <Bar className="h-3.5 w-28" />
                <Bar className="h-4 w-16 rounded-full" />
              </div>
            </div>
            <Bar className="h-1.5 rounded-full" />
            <Bar className="h-3 w-40" />
          </div>
        ))}
      </div>
    </Wrap>
  );
}

export function DetailSkeleton() {
  return (
    <Wrap>
      <div className="space-y-5">
        <Bar className="h-4 w-24" />
        <div className="flex items-center gap-4">
          <Bar className="size-14 rounded-2xl" />
          <div className="space-y-2.5">
            <Bar className="h-8 w-56" />
            <Bar className="h-3 w-40" />
          </div>
        </div>
      </div>
      <Stats />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="card space-y-5">
          <Bar className="h-4 w-28" />
          <ItemRows count={4} />
        </div>
        <div className="card space-y-5">
          <Bar className="h-4 w-24" />
          <ItemRows count={2} />
        </div>
      </div>
    </Wrap>
  );
}

export function EditorSkeleton() {
  return (
    <Wrap>
      <Header back />
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bar className="size-9 rounded-xl" />
            <Bar className="h-3.5 w-40" />
          </div>
          <Bar className="h-8 w-36 rounded-xl" />
        </div>
        <Bar className="h-72 rounded-xl" />
      </div>
    </Wrap>
  );
}

export function ExportSkeleton() {
  return (
    <Wrap>
      <Header actions />
      <Bar className="h-10 w-80 max-w-full rounded-xl" />
      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="card space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Bar className="h-2.5 w-16" />
              <Bar className="h-10 rounded-xl" />
            </div>
          ))}
        </div>
        <div className="card space-y-4">
          <Bar className="h-7 w-2/3" />
          {["w-11/12", "w-3/4", "w-5/6", "w-3/5", "w-2/3", "w-1/2"].map((w) => (
            <Bar key={w} className={`h-3 ${w}`} />
          ))}
        </div>
      </div>
    </Wrap>
  );
}
