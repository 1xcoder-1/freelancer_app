import { BackendStatus } from '@/components/BackendStatus';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
      <header className="text-center max-w-2xl mb-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-2">
          Freelance Book OS
        </h1>
        <p className="text-slate-400 text-sm">
          Unified Freelancer Platform — Next.js Web + Electron Desktop + React Native Android + Python FastAPI
        </p>
      </header>

      <main className="w-full max-w-3xl">
        <BackendStatus />
      </main>
    </div>
  );
}
