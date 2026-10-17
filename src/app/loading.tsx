export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="mb-3 h-10 w-96 max-w-full rounded-2xl bg-surface0" />
      <div className="mb-6 h-4 w-56 rounded-full bg-surface0/60" />
      <div className="mb-6 h-28 rounded-[20px] bg-mantle" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex w-[300px] shrink-0 flex-col gap-3 rounded-[20px] bg-mantle p-4">
            <div className="h-5 w-24 rounded-full bg-surface0" />
            <div className="h-24 rounded-2xl bg-surface0/70" />
            <div className="h-24 rounded-2xl bg-surface0/50" />
          </div>
        ))}
      </div>
    </div>
  );
}
