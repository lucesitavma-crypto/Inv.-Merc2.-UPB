import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  Printer,
  Globe,
  Award,
  Table as TableIcon,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  Eye,
  RotateCcw,
  FileDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { renderMarkdown, parseAnalysisSections, sanitizeMarkdown } from '../utils/markdownParser';
import { VisualDashboard } from './VisualDashboard';
import { exportDashboardToPDF } from '../utils/pdfExport';
import { AnalysisResult } from '../types';

interface AnalysisViewerProps {
  result: AnalysisResult;
  onOpenGrounding: () => void;
  onReset: () => void;
}

export const AnalysisViewer: React.FC<AnalysisViewerProps> = ({
  result,
  onOpenGrounding,
  onReset,
}) => {
  // Default to the highly attractive visual dashboard!
  const [viewMode, setViewMode] = useState<'dashboard' | 'markdown'>('dashboard');
  const [copied, setCopied] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [exportFeedback, setExportFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const cleanMarkdown = sanitizeMarkdown(result.markdown);
  const parsed = parseAnalysisSections(cleanMarkdown);

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(cleanMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    // If not in dashboard mode, switch first so the executive board is in DOM
    if (viewMode !== 'dashboard') {
      setViewMode('dashboard');
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    setIsExportingPDF(true);
    setExportFeedback(null);
    setExportStatus('Capturando tablero ejecutivo...');

    try {
      await exportDashboardToPDF({
        elementId: 'tablero-visual-ejecutivo',
        programName: resolvedProgramName,
        parsed,
        groundingSources: result.grounding?.sources,
        onProgress: (stage) => setExportStatus(stage),
      });

      setExportFeedback({
        type: 'success',
        message: '¡El archivo .pdf se ha generado y descargado correctamente en su equipo!',
      });
      setTimeout(() => setExportFeedback(null), 5000);
    } catch (err: any) {
      console.error('Error al exportar PDF:', err);
      // Emergency fallback: call vector generator directly
      try {
        const { generateExecutiveVectorPDF } = await import('../utils/pdfExport');
        generateExecutiveVectorPDF({
          programName: resolvedProgramName,
          parsed,
          groundingSources: result.grounding?.sources,
        });
        setExportFeedback({
          type: 'success',
          message: '¡Se generó y descargó el dictamen ejecutivo en formato .pdf!',
        });
      } catch (innerErr) {
        setExportFeedback({
          type: 'error',
          message: 'Ocurrió un inconveniente al generar el PDF. Por favor, reintente en unos instantes.',
        });
      }
    } finally {
      setIsExportingPDF(false);
      setExportStatus('');
    }
  };

  const renderedHtml = renderMarkdown(cleanMarkdown);

  // Compute robust program display name
  const isInvalid = (name?: string): boolean => {
    if (!name) return true;
    const clean = name.trim().toLowerCase();
    if (clean.length < 4) return true;
    if (clean === 'upb' || clean === 'upb postgrado' || clean === 'programa de postgrado upb') return true;
    if (clean === 'cartilla upb' || clean.includes('cartilla upb (google drive)')) return true;
    if (clean === 'no especifica' || clean === '-' || clean === 'diplomado upb') return true;
    if (clean.startsWith('[') && clean.endsWith(']')) return true;
    if (clean.includes('radiografía') || clean.includes('radiografia')) return true;
    return false;
  };

  const getResolvedName = (): string => {
    if (!isInvalid(parsed.radiografiaData.nombre)) return parsed.radiografiaData.nombre!.trim();
    const nameRow = parsed.tableData?.rows.find((r) => r.variable.toLowerCase().includes('nombre'));
    if (nameRow && !isInvalid(nameRow.upb)) return nameRow.upb.replace(/[*_#\[\]]/g, '').trim();
    if (!isInvalid(result.programName)) return result.programName.trim();
    const dipMatch = cleanMarkdown.match(/Diplomado en [^\n\r*|#.,;]{8,80}/i);
    if (dipMatch && !isInvalid(dipMatch[0])) return dipMatch[0].trim();
    return parsed.radiografiaData.nombre || result.programName || 'Diplomado de Postgrado UPB';
  };

  const resolvedProgramName = getResolvedName();

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#0b2545] text-amber-400 flex items-center justify-center font-serif font-black text-lg shadow-sm">
            UPB
          </div>
          <div>
            <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
              <span>Dictamen de Inteligencia Competitiva</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-400 font-normal">
                {new Date(result.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold font-serif text-[#0b2545] leading-snug">
              {resolvedProgramName}
            </h2>
          </div>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium">
            <button
              onClick={() => setViewMode('dashboard')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'dashboard'
                  ? 'bg-gradient-to-r from-[#0b2545] to-[#134074] text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Tablero Visual Ejecutivo</span>
            </button>
            <button
              onClick={() => setViewMode('markdown')}
              className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'markdown'
                  ? 'bg-white text-[#0b2545] font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              <span>Documento Markdown</span>
            </button>
          </div>

          {/* Action buttons */}
          <button
            onClick={handleCopyMarkdown}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-all flex items-center gap-1.5"
            title="Copiar informe en formato Markdown"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-600" />
                <span>Copiar</span>
              </>
            )}
          </button>

          {/* Botón Principal: Exportar Tablero a PDF */}
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 text-white shadow-xs border border-red-500/30 transition-all flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-wait cursor-pointer"
            title="Exportar toda la información del Tablero Visual Ejecutivo en formato .pdf"
          >
            {isExportingPDF ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>{exportStatus || 'Generando PDF...'}</span>
              </>
            ) : (
              <>
                <FileDown className="w-3.5 h-3.5 text-white" />
                <span>Exportar Tablero (.PDF)</span>
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-all flex items-center gap-1.5"
            title="Imprimir o guardar en PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Imprimir</span>
          </button>

          {result.grounding?.sources && result.grounding.sources.length > 0 && (
            <button
              onClick={onOpenGrounding}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 transition-all flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>Fuentes Web ({result.grounding.sources.length})</span>
            </button>
          )}

          <button
            onClick={onReset}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-all flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3 text-amber-700" />
            <span>Evaluar Otra Cartilla</span>
          </button>
        </div>
      </div>

      {/* Alerta de Estado de Exportación PDF */}
      {exportFeedback && (
        <div
          className={`rounded-2xl px-4 py-3 text-xs flex items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200 ${
            exportFeedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
              : 'bg-amber-50 text-amber-900 border border-amber-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {exportFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span className="font-medium">{exportFeedback.message}</span>
          </div>
          <button
            onClick={() => setExportFeedback(null)}
            className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded-md hover:bg-black/5"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Notice if Google Drive extraction notes exist */}
      {result.driveNotice && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-900 flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{result.driveNotice}</span>
        </div>
      )}

      {/* VIEW 1: High-End Visual Dashboard (Default) */}
      {viewMode === 'dashboard' && (
        <VisualDashboard
          parsed={parsed}
          rawMarkdown={cleanMarkdown}
          programName={resolvedProgramName}
          groundingSources={result.grounding?.sources}
          onExportPDF={handleExportPDF}
          isExportingPDF={isExportingPDF}
          exportStatus={exportStatus}
        />
      )}

      {/* VIEW 2: Formal Printable Markdown Report */}
      {viewMode === 'markdown' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-10 shadow-sm print:p-0 print:border-none print:shadow-none">
          {/* Institutional Report Header */}
          <div className="border-b-2 border-[#0b2545] pb-5 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-amber-600 tracking-wider uppercase">
                Universidad Privada Boliviana · Vicerrectorado de Postgrado
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#0b2545] mt-1">
                Dictamen Oficial de Inteligencia Competitiva
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1">
                Evaluación frente a la Oferta Académica Nacional en Bolivia
              </p>
            </div>
            <div className="text-right text-xs text-slate-500 space-y-0.5">
              <div>
                <strong>Fecha:</strong>{' '}
                {new Date(result.timestamp).toLocaleDateString('es-BO', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
              <div>
                <strong>Filtro territorial:</strong> Universidades Oficiales de Bolivia
              </div>
              <div>
                <strong>Protocolo:</strong> Cero Alucinaciones / "No especifica"
              </div>
            </div>
          </div>

          {/* Rendered Markdown Body */}
          <div
            className="prose prose-slate max-w-none text-slate-800 leading-relaxed
              prose-headings:font-serif prose-headings:text-[#0b2545] prose-headings:tracking-tight
              prose-h3:text-xl prose-h3:font-bold prose-h3:border-b prose-h3:border-slate-200 prose-h3:pb-2 prose-h3:mt-8 prose-h3:mb-4
              prose-h4:text-base prose-h4:font-bold prose-h4:text-slate-900
              prose-p:text-sm prose-p:leading-relaxed
              prose-ul:text-sm prose-ul:my-3 prose-li:my-1
              prose-table:text-xs prose-table:w-full prose-table:border-collapse prose-table:my-6
              prose-th:bg-[#0b2545] prose-th:text-white prose-th:p-3 prose-th:text-left prose-th:font-semibold prose-th:border prose-th:border-slate-300
              prose-td:p-3 prose-td:border prose-td:border-slate-200 prose-td:align-top
              prose-strong:text-[#0b2545] prose-strong:font-bold"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />

          {/* Institutional Signoff Stamp */}
          <div className="mt-12 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Verificación y análisis contrastado en el mercado educativo de Bolivia</span>
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              UPB-INTEL-REPORT · {result.id}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
