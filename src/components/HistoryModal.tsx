import React from 'react';
import { X, Clock, FileText, Trash2, ArrowUpRight } from 'lucide-react';
import { AnalysisResult } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: AnalysisResult[];
  onSelect: (item: AnalysisResult) => void;
  onClear: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onSelect,
  onClear,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[80vh] shadow-2xl flex flex-col border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-bold text-sm text-[#0b2545]">
                Historial de Análisis de Postgrado
              </h3>
              <p className="text-[11px] text-slate-500">
                Informes de posicionamiento generados en esta sesión
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

        {/* Modal List */}
        <div className="flex-1 overflow-y-auto p-5">
          {history.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              No hay análisis guardados en el historial aún.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelect(item);
                    onClose();
                  }}
                  className="p-3.5 rounded-xl border border-slate-200 hover:border-amber-500 hover:bg-amber-50/30 transition-all cursor-pointer group flex items-start justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-[#0b2545] group-hover:text-amber-800 truncate">
                      {item.programName}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                      <span>{new Date(item.timestamp).toLocaleString('es-BO')}</span>
                      {item.grounding?.sources && (
                        <span>• {item.grounding.sources.length} fuentes web</span>
                      )}
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {history.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <button
              onClick={onClear}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpiar Historial</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#0b2545] text-white text-xs font-semibold rounded-lg hover:bg-[#13315c]"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
