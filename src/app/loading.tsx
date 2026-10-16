export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="mb-8 h-6 w-40 rounded bg-active" />
      <div className="mb-3 h-3 w-24 rounded bg-hover" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="mb-2 h-8 rounded-md bg-hover" />
      ))}
    </div>
  );
}
