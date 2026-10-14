import React from 'react';
import { X, ExternalLink, Globe, Search, ShieldCheck } from 'lucide-react';
import { GroundingSource } from '../types';

interface GroundingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sources: GroundingSource[];
  queries: string[];
}

export const GroundingDrawer: React.FC<GroundingDrawerProps> = ({
  isOpen,
  onClose,
  sources,
  queries,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#0b2545]">
                Fuentes y Trazabilidad Web
              </h3>
              <p className="text-[11px] text-slate-500">
                Google Search Grounding en dominios de Bolivia
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Queries Section */}
          {queries && queries.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                <Search className="w-3.5 h-3.5 text-amber-600" />
                <span>Búsquedas Realizadas en Tiempo Real:</span>
              </div>
              <div className="space-y-1.5">
                {queries.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700"
                  >
                    "{q}"
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sources Section */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Páginas Oficiales Consultadas ({sources.length}):</span>
            </div>

            {sources.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No se registraron fuentes externas directas.
              </p>
            ) : (
              <div className="space-y-2.5">
                {sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-xs text-[#0b2545] group-hover:text-blue-700 line-clamp-2">
                        {src.title || src.uri}
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0 mt-0.5" />
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate mt-1">
                      {src.uri}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 text-center">
          Verificación objetiva de páginas universitarias en Bolivia (.bo / .edu.bo)
        </div>
      </div>
    </div>
  );
};
