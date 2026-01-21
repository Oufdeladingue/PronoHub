export default function VestiaireLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)]">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <img
            src="/images/logo.svg"
            alt="PronoHub"
            className="w-20 h-20 animate-pulse drop-shadow-[0_0_30px_rgba(255,153,0,0.6)]"
            fetchPriority="high"
          />
          <div className="absolute inset-0 -m-2">
            <svg className="w-24 h-24 animate-spin-slow" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255, 153, 0, 0.2)" strokeWidth="3" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="#ff9900" strokeWidth="3" strokeLinecap="round" strokeDasharray="70 200" />
            </svg>
          </div>
        </div>
        <p className="text-[#ff9900] font-semibold text-sm animate-pulse">
          Déploiement du Tifo en cours...
        </p>
      </div>
    </div>
  )
}
