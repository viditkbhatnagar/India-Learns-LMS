import { Route, Routes } from 'react-router-dom';

function Landing() {
  return (
    <main className="min-h-screen bg-brand-cream flex items-center justify-center p-6">
      <section className="max-w-xl w-full bg-white border border-black/5 shadow-sm rounded-xl p-10 text-center">
        <p className="text-brand-orange uppercase tracking-wide text-sm font-semibold mb-3">
          India Learns
        </p>
        <h1 className="text-brand-navy text-4xl font-bold leading-tight mb-4">
          Hello India Learns
        </h1>
        <p className="text-muted text-base">
          LMS for LUC Diploma Programs · Phase 1 scaffolding (M1)
        </p>
      </section>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
    </Routes>
  );
}
