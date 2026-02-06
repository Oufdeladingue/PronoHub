'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import Image from 'next/image'

interface DurationExtensionModalProps {
  isOpen: boolean
  onClose: () => void
  tournamentId: string
  onApply: (journeysToAdd: number) => Promise<void>
}

export default function DurationExtensionModal({
  isOpen,
  onClose,
  tournamentId,
  onApply
}: DurationExtensionModalProps) {
  const [selectedJourneys, setSelectedJourneys] = useState(10)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const journeyOptions = [5, 10, 15, 20, 30]

  const handleApply = async () => {
    try {
      setLoading(true)
      await onApply(selectedJourneys)
      onClose()
    } catch (error) {
      console.error('Erreur application extension:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4">
      <div className="relative max-w-sm w-full rounded-2xl overflow-hidden shadow-2xl border border-[#ff9900]/25">

        {/* Background */}
        <div className="absolute inset-0">
          <Image
            src="/images/modals/purchase-bg.png"
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 384px"
            className="object-cover scale-[1.04]"
            style={{ filter: 'saturate(1.1) contrast(1.05)' }}
            priority
          />
          <div
            className="absolute inset-0 pointer-events-none opacity-85"
            style={{
              background: `
                radial-gradient(110% 80% at 50% 15%, rgba(0,0,0,.55) 0%, rgba(0,0,0,0) 60%),
                radial-gradient(110% 90% at 50% 110%, rgba(0,0,0,.60) 0%, rgba(0,0,0,0) 62%),
                radial-gradient(90% 90% at -10% 50%, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 62%),
                radial-gradient(90% 90% at 110% 50%, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 62%)
              `
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none opacity-90"
            style={{
              background: `
                radial-gradient(55% 40% at 50% 28%, rgba(255,153,0,.16) 0%, rgba(255,153,0,0) 65%),
                radial-gradient(60% 45% at 50% 80%, rgba(255,153,0,.08) 0%, rgba(255,153,0,0) 70%)
              `,
              filter: 'blur(10px)'
            }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-2.5 right-2.5 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/35 text-white/90 transition-all border border-white/10 disabled:opacity-50"
          style={{ backdropFilter: 'blur(6px)' }}
        >
          <X className="w-4 h-4" strokeWidth={2} />
        </button>

        {/* Content */}
        <div
          className="relative z-[1] m-3.5 p-4 flex flex-col items-center text-center"
          style={{ filter: 'blur(0.3px)' }}
        >
          <h2 className="text-white text-[24px] font-black leading-tight uppercase mb-2"
              style={{ textShadow: '0 10px 26px rgba(0,0,0,.55)' }}>
            COMBIEN DE JOURNÉES<br />
            <span className="text-[#ffb000]" style={{ textShadow: '0 0 18px rgba(255,176,0,.22)' }}>
              VEUX-TU AJOUTER ?
            </span>
          </h2>

          <div className="w-[200px] max-w-full mx-auto my-2 flex items-center justify-center">
            <Image
              src="/images/modals/calendar-ext.png"
              alt="Calendrier"
              width={200}
              height={200}
              className="h-auto"
              style={{ width: '100%', height: 'auto', filter: 'drop-shadow(0 20px 28px rgba(0,0,0,.45))' }}
            />
          </div>

          {/* Sélection du nombre de journées */}
          <div className="w-full mb-4">
            <div className="flex gap-2 justify-center flex-wrap">
              {journeyOptions.map((count) => (
                <button
                  key={count}
                  onClick={() => setSelectedJourneys(count)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                    selectedJourneys === count
                      ? 'bg-[#ff9900] text-[#1b1200] scale-105'
                      : 'bg-white/10 text-white/70 hover:bg-white/20'
                  } disabled:opacity-50`}
                >
                  {count}J
                </button>
              ))}
            </div>
          </div>

          <div className="relative mb-3.5 w-full">
            <div
              className="absolute pointer-events-none opacity-75 -z-10"
              style={{
                inset: '-30px',
                background: `
                  radial-gradient(ellipse 85% 110% at 48% 50%, rgba(0,0,0,.42) 20%, rgba(0,0,0,0) 70%),
                  radial-gradient(ellipse 95% 120% at 52% 45%, rgba(0,0,0,.35) 15%, rgba(0,0,0,0) 75%),
                  radial-gradient(circle at 30% 60%, rgba(0,0,0,.25) 10%, rgba(0,0,0,0) 50%),
                  radial-gradient(circle at 70% 40%, rgba(0,0,0,.25) 10%, rgba(0,0,0,0) 50%)
                `,
                filter: 'blur(20px)'
              }}
            />
            <p className="relative text-white/85 text-[16px] leading-[1.45] text-center z-[1]"
               style={{ textShadow: '0 2px 8px rgba(0,0,0,.65), 0 10px 30px rgba(0,0,0,.45)' }}>
              Tu as acheté un crédit d'extension.<br/>
              Choisis combien de journées tu veux ajouter.
            </p>
          </div>

          <button
            onClick={handleApply}
            disabled={loading}
            className="w-full bg-gradient-to-b from-[#ffb000] via-[#ff9900] to-[#e07f00] text-[#1b1200] font-black text-[15px] py-3 px-3.5 rounded-[14px] flex items-center justify-center transition-all mb-2.5 hover:translate-y-[-1px] hover:brightness-[1.03] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              boxShadow: '0 16px 34px rgba(0,0,0,.40), 0 0 0 1px rgba(0,0,0,.18), 0 0 18px rgba(255,153,0,.12)'
            }}>
            {loading ? 'Application...' : `Ajouter ${selectedJourneys} journées`}
          </button>

          <div className="relative">
            <p className="relative text-white/70 text-xs text-center"
               style={{ textShadow: '0 2px 8px rgba(0,0,0,.65), 0 10px 30px rgba(0,0,0,.45)' }}>
              Tu pourras toujours ajouter plus de journées plus tard
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
