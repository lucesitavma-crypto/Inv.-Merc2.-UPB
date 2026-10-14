import React from 'react';
import { Award, Compass, Search, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  onOpenHistory: () => void;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({ onOpenHistory, historyCount }) => {
  return (
    <header className="bg-gradient-to-r from-[#0b2545] via-[#13315c] to-[#134074] text-white border-b border-amber-500/30 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Brand Info */}
          <div className="flex items-center gap-3.5 sm:gap-4">
            {/* Official UPB Logo from upb.edu */}
            <a
              href="https://www.upb.edu"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center p-1 -ml-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group shrink-0 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              title="Universidad Privada Boliviana - Sitio Web Oficial (upb.edu)"
            >
              <img
                src="/upb-logo.png"
                alt="Universidad Privada Boliviana"
                className="h-10 sm:h-12 w-auto max-w-[130px] sm:max-w-[170px] object-contain drop-shadow-sm transition-transform group-hover:scale-[1.02]"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.dataset.triedBackup) {
                    target.dataset.triedBackup = 'true';
                    target.src = 'https://framerusercontent.com/images/mCTA0TbxSOcY38YukKdZ3Grigm4.png';
                  }
                }}
              />
            </a>

            <div className="h-10 w-px bg-white/15 hidden sm:block shrink-0" />

            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-amber-300 bg-amber-400/15 px-2.5 py-0.5 rounded-md border border-amber-400/35 shadow-xs backdrop-blur-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Formación Continua & Postgrado
                </span>
                <span className="hidden sm:inline-flex items-center text-[11px] text-blue-200/80 gap-1 bg-white/5 px-2 py-0.5 rounded">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Contexto Nacional Bolivia
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-[1.625rem] font-bold tracking-tight text-white mt-0.5 font-serif leading-tight drop-shadow-xs">
                Analista de Inteligencia Competitiva Académica
              </h1>
              <p className="text-xs text-blue-100/80 hidden sm:block">
                Evaluación comparativa de Diplomados UPB frente a la oferta de universidades bolivianas
              </p>
            </div>
          </div>

          {/* Controls & Quick Badges */}
          <div className="flex items-center gap-2.5 self-end md:self-auto">
            <button
              onClick={onOpenHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/15 text-blue-100 border border-white/15 transition-all shadow-sm"
              title="Ver análisis guardados"
            >
              <Compass className="w-4 h-4 text-amber-400" />
              <span>Historial</span>
              {historyCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-[#0b2545] font-bold text-[10px]">
                  {historyCount}
                </span>
              )}
            </button>

            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/25 border border-white/10 text-xs text-blue-200">
              <Search className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Google Search Grounding (.bo)</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
