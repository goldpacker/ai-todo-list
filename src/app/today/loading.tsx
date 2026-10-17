export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="mb-3 h-10 w-80 max-w-full rounded-2xl bg-surface0" />
      <div className="mb-8 h-4 w-48 rounded-full bg-surface0/60" />
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-[20px] bg-mantle p-4">
            <div className="h-5 w-24 rounded-full bg-surface0" />
            <div className="h-24 rounded-2xl bg-surface0/70" />
            <div className="h-24 rounded-2xl bg-surface0/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
