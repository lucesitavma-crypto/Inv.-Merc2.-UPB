import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ProgramInputSection } from './components/ProgramInputSection';
import { AnalysisViewer } from './components/AnalysisViewer';
import { AnalysisLoadingIndicator } from './components/AnalysisLoadingIndicator';
import { GroundingDrawer } from './components/GroundingDrawer';
import { HistoryModal } from './components/HistoryModal';
import { AnalysisResult } from './types';
import {
  Sparkles,
  ShieldAlert,
  Search,
  BookOpen,
  Building,
  GraduationCap,
  Scale,
  Compass,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentResult, setCurrentResult] = useState<AnalysisResult | null>(null);
  const [analyzingName, setAnalyzingName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastParams, setLastParams] = useState<any>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isGroundingOpen, setIsGroundingOpen] = useState(false);

  // Load history from localStorage on initial render
  useEffect(() => {
    try {
      const saved = localStorage.getItem('upb_postgrado_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Could not read history from localStorage', e);
    }
  }, []);

  // Save history to localStorage
  const saveToHistory = (newResult: AnalysisResult) => {
    try {
      const updated = [newResult, ...history.filter((h) => h.id !== newResult.id)].slice(0, 15);
      setHistory(updated);
      localStorage.setItem('upb_postgrado_history', JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save history to localStorage', e);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('upb_postgrado_history');
    } catch (e) {}
  };

  const handleStartAnalysis = async (params: {
    driveUrl: string;
    pdfBase64: string;
    pdfName: string;
    programText: string;
    programName: string;
    focusUniversities: string[];
  }) => {
    setIsLoading(true);
    setErrorMessage(null);
    setLastParams(params);
    setAnalyzingName(params.programName || 'Diplomado UPB');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          driveUrl: params.driveUrl,
          pdfBase64: params.pdfBase64,
          pdfMimeType: 'application/pdf',
          programText: params.programText,
          programName: params.programName,
          focusUniversities: params.focusUniversities,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let rawError = errorData.error || `Error del servidor (${response.status})`;
        // If rawError is serialized JSON from upstream Gemini API, parse cleanly
        if (typeof rawError === 'string' && rawError.startsWith('{')) {
          try {
            const parsed = JSON.parse(rawError);
            if (parsed.error?.message) {
              rawError = parsed.error.message;
            }
          } catch {
            // Keep raw error string
          }
        }
        throw new Error(rawError);
      }

      const data = await response.json();

      const newAnalysis: AnalysisResult = {
        id: `upb-${Date.now()}`,
        timestamp: new Date().toISOString(),
        programName: data.programName || params.programName || 'Programa de Postgrado UPB',
        markdown: data.markdown,
        driveNotice: data.driveNotice,
        grounding: data.grounding,
      };

      setCurrentResult(newAnalysis);
      saveToHistory(newAnalysis);
    } catch (err: any) {
      console.error('Error in handleStartAnalysis:', err);
      let msg = err.message || 'Ocurrió un error temporal al procesar el análisis de postgrado.';
      // Clean up raw JSON string if present
      if (typeof msg === 'string' && msg.includes('{"error":')) {
        try {
          const match = msg.match(/\{"error":\{.*\}\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.error?.message) {
              msg = parsed.error.message;
            }
          }
        } catch {
          // ignore parse error
        }
      }
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800">
      {/* Top Header */}
      <Header
        onOpenHistory={() => setIsHistoryOpen(true)}
        historyCount={history.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Institutional Mission Banner (visible when not viewing result or loading) */}
        {!currentResult && !isLoading && (
          <div className="bg-gradient-to-br from-[#0b2545] via-[#13315c] to-[#134074] text-white rounded-3xl p-6 sm:p-8 mb-8 shadow-md border border-amber-500/20 relative overflow-hidden">
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300 text-xs font-semibold mb-3 shadow-xs backdrop-blur-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-semibold tracking-wide text-amber-200 text-xs sm:text-[12.5px]">
                  Universidad Privada Boliviana - Formación Continua & Postgrado
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-[32px] font-serif font-black tracking-tight leading-tight text-white drop-shadow-xs">
                Inteligencia de Mercado (Diplomados)
              </h2>
              <p className="text-sm sm:text-[14.5px] text-blue-100/90 mt-2.5 leading-relaxed font-normal">
                Herramienta analítica para evaluar la cartilla o brochure del programa de Formación Continua & Postgrado de la UPB que selecciones frente al mercado universitario en Bolivia (UCB, UPSA, Univalle, Unifranz, UMSA, EMI y otras).
              </p>

              {/* 3 Core Methodology Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10 text-xs">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                    <BookOpen className="w-4 h-4" />
                    <span>1. Extracción Drive / PDF</span>
                  </div>
                  <p className="text-[11px] text-blue-100/80 leading-normal">
                    Lectura rigurosa del brochure: materias, horas académicas, duración y propuesta pedagógica.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10 text-xs">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                    <Search className="w-4 h-4" />
                    <span>2. Búsqueda Web (.bo)</span>
                  </div>
                  <p className="text-[11px] text-blue-100/80 leading-normal">
                    Rastreo semántico con Google Search en webs oficiales de universidades bolivianas acreditadas.
                  </p>
                </div>

                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10 text-xs">
                  <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                    <Scale className="w-4 h-4" />
                    <span>3. Cero Alucinaciones</span>
                  </div>
                  <p className="text-[11px] text-blue-100/80 leading-normal">
                    Si un dato no figura en las fuentes oficiales, se rotula estrictamente "No especifica".
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-900">
                <strong className="font-bold block text-sm">Error en el análisis de postgrado</strong>
                <p className="mt-1 leading-relaxed text-slate-700">{errorMessage}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Puede deberse a un límite temporal de peticiones o saturación de red. El sistema cuenta con reintento automático y conmutación de modelos.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
              {lastParams && (
                <button
                  type="button"
                  onClick={() => handleStartAnalysis(lastParams)}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reintentar ahora</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="px-3 py-2 text-rose-700 hover:text-rose-900 text-xs font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Input Configuration Section (only show when not in loading state and no active result view or when user clicks New Analysis) */}
        {!isLoading && !currentResult && (
          <ProgramInputSection
            onStartAnalysis={handleStartAnalysis}
            isLoading={isLoading}
          />
        )}

        {/* Loading Progress Indicator */}
        {isLoading && (
          <AnalysisLoadingIndicator programName={analyzingName} />
        )}

        {/* Analysis Result Viewer */}
        {!isLoading && currentResult && (
          <AnalysisViewer
            result={currentResult}
            onOpenGrounding={() => setIsGroundingOpen(true)}
            onReset={() => setCurrentResult(null)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#0b2545]">Universidad Privada Boliviana (UPB)</span>
            <span className="font-medium text-slate-600">· Formación Continua La Paz</span>
          </div>
          <div className="font-medium text-slate-600 sm:text-right">
            Luz Vivian Machicado Alcoreza - Coordinadora de Admisiones y Reclutamiento
          </div>
        </div>
      </footer>

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelect={(item) => setCurrentResult(item)}
        onClear={handleClearHistory}
      />

      {/* Grounding Sources Drawer */}
      {currentResult && (
        <GroundingDrawer
          isOpen={isGroundingOpen}
          onClose={() => setIsGroundingOpen(false)}
          sources={currentResult.grounding?.sources || []}
          queries={currentResult.grounding?.searchQueries || []}
        />
      )}
    </div>
  );
}
