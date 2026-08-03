export default function Loading() {
  return (
    <main className="page" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="loading-spinner" aria-label="Loading…">
        <div className="spinner" />
        <p className="loading-text">Loading…</p>
      </div>
    </main>
  );
}
