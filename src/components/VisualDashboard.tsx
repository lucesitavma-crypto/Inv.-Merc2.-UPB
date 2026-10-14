import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  Building2,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ShieldCheck,
  ExternalLink,
  Target,
  ArrowRight,
  School,
  FileText,
  Globe,
  FileDown,
  Loader2,
} from 'lucide-react';
import { ParsedAnalysisSections, renderMarkdown } from '../utils/markdownParser';

interface VisualDashboardProps {
  parsed: ParsedAnalysisSections;
  rawMarkdown: string;
  programName?: string;
  groundingSources?: Array<{ title: string; uri: string }>;
  onExportPDF?: () => void;
  isExportingPDF?: boolean;
  exportStatus?: string;
}

export const VisualDashboard: React.FC<VisualDashboardProps> = ({
  parsed,
  rawMarkdown,
  programName,
  groundingSources,
  onExportPDF,
  isExportingPDF,
  exportStatus,
}) => {
  const [fitAllColumns, setFitAllColumns] = useState(false);
  const { radiografiaData, hallazgosList, tableData, conclusionesData, fuentesList, fuentesRaw } = parsed;

  // Resolve official program display name with strict validations and fallbacks
  const getProgramDisplayName = (): string => {
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

    // 1. Direct radiografia data
    const rName = radiografiaData.nombre?.trim();
    if (!isInvalid(rName)) {
      return rName!;
    }

    // 2. Table row "Nombre del Programa"
    const nameRow = tableData?.rows.find((r) => r.variable.toLowerCase().includes('nombre'));
    if (nameRow && !isInvalid(nameRow.upb)) {
      return nameRow.upb.replace(/[*_#\[\]]/g, '').trim();
    }

    // 3. Program name passed via props
    const pName = programName?.trim();
    if (!isInvalid(pName)) {
      return pName!;
    }

    // 4. Regex scan for Diplomado en ... in raw markdown
    const dipMatch = rawMarkdown.match(/Diplomado en [^\n\r*|#.,;]{8,80}/i);
    if (dipMatch && !isInvalid(dipMatch[0])) {
      return dipMatch[0].trim();
    }

    return rName || pName || 'Diplomado de Postgrado UPB';
  };

  const programDisplayName = getProgramDisplayName();

  // Helper for styling table values
  const renderCellValue = (val: string, isUPB: boolean = false, isSimilarityRow: boolean = false) => {
    // If it is the UPB reference column in the similarity row, leave it completely blank / empty
    if (isUPB && isSimilarityRow) {
      return null;
    }

    if (!val || val === '-' || val === '—' || val.toLowerCase() === 'n/a') {
      if (isUPB) return null;
      return <span className="text-slate-400 italic">No especifica</span>;
    }

    const lower = val.toLowerCase().trim();

    // Prevent any similarity pill from ever rendering on UPB
    if (isUPB && (lower.includes('alta') || lower.includes('media') || lower.includes('baja') || lower.includes('similitud'))) {
      return null;
    }

    if (lower.includes('sin oferta') || lower.includes('no ofrece') || lower.includes('sin programa')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <span>Sin oferta identificada</span>
        </span>
      );
    }

    if (lower === 'no especifica' || lower.includes('no especifica')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
          <HelpCircle className="w-3 h-3 text-slate-400" />
          <span>No especifica</span>
        </span>
      );
    }

    if (lower === 'alta' || lower.includes('similitud alta') || lower.includes('alta (')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Similitud Alta</span>
        </span>
      );
    }

    if (lower === 'media' || lower.includes('similitud media')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <Target className="w-3.5 h-3.5 text-amber-600" />
          <span>Similitud Media</span>
        </span>
      );
    }

    if (lower === 'baja' || lower.includes('similitud baja')) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
          <span>Similitud Baja</span>
        </span>
      );
    }

    const isParagraph = val.length > 45;

    return (
      <p
        className={`leading-relaxed text-xs sm:text-[13px] ${
          isUPB ? 'font-medium text-[#0b2545]' : 'text-slate-700'
        } ${isParagraph ? 'py-1 text-slate-800 leading-normal' : ''}`}
      >
        {val}
      </p>
    );
  };

  // Helper for university badge styling
  const getUniversityBadge = (nombre: string) => {
    const n = nombre.toUpperCase();
    if (n.includes('CATÓLICA') || n.includes('CATOLICA') || n.includes('UCB')) {
      return { acronym: 'UCB', badgeColor: 'bg-blue-600 text-white' };
    }
    if (n.includes('UPSA')) {
      return { acronym: 'UPSA', badgeColor: 'bg-red-700 text-white' };
    }
    if (n.includes('VALLE') || n.includes('UNIVALLE')) {
      return { acronym: 'UNIVALLE', badgeColor: 'bg-amber-600 text-white' };
    }
    if (n.includes('ANDRÉS') || n.includes('ANDRES') || n.includes('UMSA')) {
      return { acronym: 'UMSA', badgeColor: 'bg-indigo-700 text-white' };
    }
    if (n.includes('MILITAR') || n.includes('EMI')) {
      return { acronym: 'EMI', badgeColor: 'bg-emerald-700 text-white' };
    }
    if (n.includes('FRANZ') || n.includes('UNIFRANZ')) {
      return { acronym: 'UNIFRANZ', badgeColor: 'bg-orange-600 text-white' };
    }
    if (n.includes('MORENO') || n.includes('UAGRM')) {
      return { acronym: 'UAGRM', badgeColor: 'bg-rose-700 text-white' };
    }
    if (n.includes('UTEPSA')) {
      return { acronym: 'UTEPSA', badgeColor: 'bg-cyan-700 text-white' };
    }
    if (n.includes('SAVIO') || n.includes('UPDS')) {
      return { acronym: 'UPDS', badgeColor: 'bg-teal-700 text-white' };
    }
    if (n.includes('NUR')) {
      return { acronym: 'NUR', badgeColor: 'bg-purple-700 text-white' };
    }
    return { acronym: 'PORTAL', badgeColor: 'bg-slate-700 text-white' };
  };

  const fallbackFuentes = [
    {
      nombre: 'Universidad Católica Boliviana "San Pablo" (Postgrado UCB)',
      url: 'https://postgrado.ucb.edu.bo/',
      descripcion: 'Portal oficial de programas de postgrado y diplomados',
    },
    {
      nombre: 'Universidad Privada de Santa Cruz de la Sierra (UPSA - DIP)',
      url: 'https://www.upsa.edu.bo/index.php/es/postgrado',
      descripcion: 'Dirección de Investigación y Postgrado',
    },
    {
      nombre: 'Universidad del Valle (UNIVALLE Postgrado)',
      url: 'https://www.univalle.edu/postgrado/',
      descripcion: 'Vicerrectorado de Postgrado e Investigación',
    },
    {
      nombre: 'Universidad Mayor de San Andrés (UMSA Postgrado)',
      url: 'https://postgrado.umsa.bo/',
      descripcion: 'Centro de Estudios y Postgrado Universitario',
    },
    {
      nombre: 'Escuela Militar de Ingeniería (EMI Postgrado)',
      url: 'https://postgrado.emi.edu.bo/',
      descripcion: 'Unidad Académica de Postgrado',
    },
    {
      nombre: 'Universidad Franz Tamayo (UNIFRANZ Postgrado)',
      url: 'https://postgrado.unifranz.edu.bo/',
      descripcion: 'Escuela de Postgrado',
    },
    {
      nombre: 'Universidad Autónoma Gabriel René Moreno (UAGRM Postgrado)',
      url: 'https://postgradouagrm.edu.bo/',
      descripcion: 'Dirección Universitaria de Postgrado / CIFTT',
    },
    {
      nombre: 'Universidad Tecnológica Privada de Santa Cruz (UTEPSA Postgrado)',
      url: 'https://www.utepsa.edu/postgrado/',
      descripcion: 'Centro de Postgrado y Educación Continua',
    },
    {
      nombre: 'Universidad Privada Domingo Savio (UPDS Postgrado)',
      url: 'https://postgrado.upds.edu.bo/',
      descripcion: 'Escuela de Postgrado Nacional',
    },
    {
      nombre: 'Universidad NUR (NUR Postgrado)',
      url: 'https://nur.edu/postgrado/',
      descripcion: 'Dirección de Postgrado',
    },
  ];

  const displayFuentes = React.useMemo(() => {
    const list = fuentesList && fuentesList.length > 0 ? [...fuentesList] : [...fallbackFuentes];
    if (groundingSources && groundingSources.length > 0) {
      for (const gs of groundingSources) {
        if (!list.some((item) => item.url.replace(/\/$/, '') === gs.uri.replace(/\/$/, ''))) {
          list.push({
            nombre: gs.title || 'Portal de Postgrado Boliviano',
            url: gs.uri,
            descripcion: 'Fuente consultada mediante búsqueda web oficial',
          });
        }
      }
    }
    return list;
  }, [fuentesList, groundingSources]);

  return (
    <div id="tablero-visual-ejecutivo" className="space-y-8 animate-in fade-in duration-300">
      {/* 1. SECCIÓN: RADIOGRAFÍA DEL PROGRAMA UPB */}
      <section className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 relative overflow-hidden">
        {/* Header de la Sección 01 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-5 border-b border-slate-100">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center font-bold text-base shadow-2xs shrink-0 mt-0.5 sm:mt-0">
              01
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-amber-600 tracking-wider uppercase">
                  Análisis Curricular Interno
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 text-[10px] font-semibold border border-amber-200/60">
                  Cartilla Evaluada
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold font-serif text-[#0b2545] leading-tight mt-0.5">
                Radiografía del Programa UPB
              </h3>
            </div>
          </div>
          <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 text-xs font-semibold border border-blue-200 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            Fuente Oficial Cartilla
          </span>
        </div>

        {/* Tarjeta Destacada: Nombre Oficial del Programa Reconocido */}
        <div className="mb-6 bg-gradient-to-r from-[#0b2545] via-[#13315c] to-[#0a213e] rounded-2xl p-4 sm:p-5 text-white shadow-sm border border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-300/30 shadow-inner">
              <Award className="w-6 h-6 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>Nombre del Programa Reconocido</span>
                <span className="w-1 h-1 rounded-full bg-amber-400" />
                <span className="text-blue-200 font-normal">UPB Formación Continua & Postgrado</span>
              </div>
              <h4 className="text-base sm:text-lg lg:text-xl font-bold font-serif text-white tracking-wide mt-0.5 leading-snug break-words">
                {programDisplayName}
              </h4>
            </div>
          </div>
          <div className="self-start sm:self-auto shrink-0 flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-white/10 text-xs font-medium text-amber-200 border border-white/10 backdrop-blur-xs flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Brochure Reconocido</span>
            </span>
            {onExportPDF && (
              <button
                type="button"
                onClick={onExportPDF}
                disabled={isExportingPDF}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 text-white text-xs font-bold border border-red-400/40 shadow-xs flex items-center gap-1.5 transition-all hover:scale-[1.02] disabled:opacity-60 cursor-pointer no-print"
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
            )}
          </div>
        </div>

        {/* Bento Grid layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Metrics & Value Proposition */}
          <div className="lg:col-span-5 space-y-4">
            {/* Value Proposition Box */}
            <div className="bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 rounded-2xl p-5 border border-amber-200/80 shadow-2xs">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Enfoque & Propuesta de Valor</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed italic font-serif">
                "{radiografiaData.enfoque || 'Propuesta académica de postgrado enfocada en competencias aplicadas y rigor directivo.'}"
              </p>
            </div>

            {/* Quick KPI Spec Pills */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <Clock className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Carga Horaria</div>
                <div className="text-xs font-bold text-[#0b2545] mt-0.5 truncate" title={radiografiaData.cargaHoraria}>
                  {radiografiaData.cargaHoraria || 'No especifica'}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <Calendar className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Duración</div>
                <div className="text-xs font-bold text-[#0b2545] mt-0.5 truncate" title={radiografiaData.duracion}>
                  {radiografiaData.duracion || 'No especifica'}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <BookOpen className="w-4 h-4 text-indigo-600 mx-auto mb-1" />
                <div className="text-[10px] text-slate-500 uppercase font-semibold">Modalidad</div>
                <div className="text-xs font-bold text-[#0b2545] mt-0.5 truncate" title={radiografiaData.modalidad}>
                  {radiografiaData.modalidad || 'No especifica'}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Plan de Estudios / Modules Timeline */}
          <div className="lg:col-span-7 bg-slate-50/80 rounded-2xl p-5 border border-slate-200">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Plan de Estudios Extraído ({radiografiaData.modulos.length} Módulos)
                </h4>
              </div>
              <span className="text-[11px] text-slate-500">Malla curricular</span>
            </div>

            {radiografiaData.modulos.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4">
                No se desglosaron módulos en la cartilla o se describieron en bloque único.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {radiografiaData.modulos.map((mod, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs hover:border-amber-300 transition-all"
                  >
                    <span className="w-6 h-6 rounded-lg bg-[#0b2545] text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-2xs">
                      {idx + 1}
                    </span>
                    <span className="text-xs sm:text-sm font-medium text-slate-800 leading-snug">
                      {mod}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. SECCIÓN: HALLAZGOS EN EL MERCADO BOLIVIANO */}
      <section className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-700 flex items-center justify-center font-bold text-sm shadow-2xs">
              02
            </div>
            <div>
              <span className="text-[11px] font-bold text-blue-600 tracking-wider uppercase">
                Rastreo de Mercado Nacional
              </span>
              <h3 className="text-xl font-bold font-serif text-[#0b2545]">
                Hallazgos en el Mercado Boliviano
              </h3>
            </div>
          </div>
          <span className="text-xs text-slate-500 hidden sm:block">
            Homologación semántica por esencia curricular
          </span>
        </div>

        {hallazgosList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {hallazgosList.map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-slate-200 p-5 bg-gradient-to-br from-white to-slate-50/50 hover:border-blue-300 hover:shadow-xs transition-all relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0b2545] text-white">
                      <School className="w-3 h-3 text-amber-400" />
                      {item.universidad || `Competidor ${idx + 1}`}
                    </span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                      Mercado Bolivia (.bo)
                    </span>
                  </div>

                  <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                    {item.nombre}
                  </h4>

                  <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                    {item.descripcion}
                  </p>
                </div>

                {item.url && (
                  <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      <span>Ver fuente en portal oficial</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
            {parsed.hallazgosRaw ? (
              <div
                className="prose prose-slate max-w-none text-xs"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(parsed.hallazgosRaw) }}
              />
            ) : (
              'Programas identificados en el ecosistema de postgrados de Bolivia.'
            )}
          </div>
        )}
      </section>

      {/* 3. SECCIÓN: TABLA COMPARATIVA OBLIGATORIA */}
      <section className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0b2545] text-amber-300 flex items-center justify-center font-bold text-sm shadow-2xs">
              03
            </div>
            <div>
              <span className="text-[11px] font-bold text-amber-600 tracking-wider uppercase">
                Matriz Obligatoria
              </span>
              <h3 className="text-xl font-bold font-serif text-[#0b2545]">
                Tabla Comparativa de Programas Académicos
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              type="button"
              onClick={() => setFitAllColumns(!fitAllColumns)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-[#0b2545] transition-all border border-slate-200 shadow-2xs no-print cursor-pointer"
              title="Alternar entre vista de ancho completo y vista ajustada a pantalla"
            >
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span>{fitAllColumns ? 'Ver ancho expandido' : 'Ajustar todas las columnas a pantalla'}</span>
            </button>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              Comparativa Frente a Competidores Directos
            </span>
          </div>
        </div>

        {tableData && tableData.rows.length > 0 ? (
          <div className="space-y-3">
            <div className={`rounded-2xl border border-slate-200 ${fitAllColumns ? 'overflow-x-visible' : 'overflow-x-auto'}`}>
              <table className={`w-full text-left border-collapse text-xs sm:text-sm ${fitAllColumns ? 'min-w-0 table-auto' : 'min-w-[700px]'}`}>
                <thead>
                  <tr className="bg-[#0b2545] text-white">
                    <th className={`p-3.5 font-semibold text-xs tracking-wider uppercase border-r border-white/10 sticky left-0 bg-[#0b2545] z-10 shadow-sm ${fitAllColumns ? 'w-[16%]' : 'min-w-[130px] sm:min-w-[150px]'}`}>
                      Variable
                    </th>
                    <th className={`p-3.5 font-bold text-xs tracking-wider uppercase bg-[#13315c] text-amber-300 border-r border-white/10 shadow-inner ${fitAllColumns ? 'w-[28%]' : 'min-w-[190px] sm:min-w-[220px]'}`}>
                      <div className="flex items-center gap-1.5">
                        <span>UPB (Analizado)</span>
                        <Award className="w-3.5 h-3.5 text-amber-400" />
                      </div>
                    </th>
                    {tableData.headers.slice(2).map((headerName, hIdx) => (
                      <th
                        key={hIdx}
                        className={`p-3.5 font-semibold text-xs tracking-wider uppercase ${fitAllColumns ? '' : 'min-w-[180px] sm:min-w-[210px]'} ${
                          hIdx < tableData.headers.length - 3 ? 'border-r border-white/10' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <School className="w-3.5 h-3.5 text-amber-400/80" />
                          <span>{headerName}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {tableData.rows.map((row, rIdx) => {
                    const compValues =
                      row.competitors && row.competitors.length > 0
                        ? row.competitors
                        : [
                            row.competitor1 || 'No especifica',
                            row.competitor2 || 'No especifica',
                            row.competitor3 || 'No especifica',
                            row.competitor4 || 'No especifica',
                          ];

                    const isSimilarityRow = row.variable.toLowerCase().includes('similitud');

                    return (
                      <tr
                        key={rIdx}
                        className={
                          rIdx % 2 === 0
                            ? 'bg-white hover:bg-slate-50/70 transition-colors'
                            : 'bg-slate-50/40 hover:bg-slate-50 transition-colors'
                        }
                      >
                        <td className="p-3.5 font-bold text-[#0b2545] border-r border-slate-200 sticky left-0 bg-inherit z-10">
                          {row.variable}
                        </td>
                        <td className={`p-3.5 bg-amber-50/25 border-r border-slate-200 font-medium ${isSimilarityRow ? 'text-center' : ''}`}>
                          {isSimilarityRow ? null : renderCellValue(row.upb, true, isSimilarityRow)}
                        </td>
                        {compValues.map((compVal, cIdx) => (
                          <td
                            key={cIdx}
                            className={`p-3.5 ${
                              cIdx < compValues.length - 1 ? 'border-r border-slate-200' : ''
                            }`}
                          >
                            {renderCellValue(compVal, false, isSimilarityRow)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Aviso explicativo de exportación PDF */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                <span>En el PDF descargado, esta tabla se exporta en página apaisada A4 (Landscape) de 297 mm, permitiendo visualizar todas las universidades completas sin cortes ni barra de desplazamiento.</span>
              </span>
              <span className="text-slate-400 font-medium shrink-0">
                {tableData.headers.length - 1} instituciones comparadas
              </span>
            </div>
          </div>
        ) : (
          <div
            className="prose prose-slate max-w-none text-xs sm:text-sm overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(parsed.tablaComparativaRaw) }}
          />
        )}
      </section>

      {/* 4. SECCIÓN: CONCLUSIONES ESTRATÉGICAS */}
      <section className="bg-gradient-to-br from-[#0b2545] via-[#13315c] to-[#08182b] text-white rounded-3xl p-6 sm:p-10 shadow-lg relative overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-[#0b2545] flex items-center justify-center font-bold text-sm shadow-md">
              04
            </div>
            <div>
              <span className="text-[11px] font-bold text-amber-300 tracking-wider uppercase">
                Dictamen Ejecutivo
              </span>
              <h3 className="text-xl sm:text-2xl font-bold font-serif text-white">
                Conclusiones Estratégicas
              </h3>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-semibold border border-white/15">
            <TrendingUp className="w-3.5 h-3.5" />
            Estrategia de Mercado
          </span>
        </div>

        {/* Strategic Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
          {/* Fortalezas y Ventaja Competitiva */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-emerald-400/30 shadow-inner">
            <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-300 uppercase tracking-wider mb-3">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span>Principal Ventaja Competitiva UPB</span>
            </div>
            <p className="text-xs sm:text-sm text-blue-50 leading-relaxed font-sans">
              {conclusionesData.ventajaCompetitiva ||
                'Posicionamiento de alto valor respaldado por profundidad técnica, rigor académico y orientación ejecutiva directa.'}
            </p>
          </div>

          {/* Alerta y Oportunidades de Mejora */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-amber-400/30 shadow-inner">
            <div className="flex items-center gap-2.5 text-xs font-bold text-amber-300 uppercase tracking-wider mb-3">
              <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span>Punto de Alerta & Mejora Frente al Mercado</span>
            </div>
            <p className="text-xs sm:text-sm text-blue-50 leading-relaxed font-sans">
              {conclusionesData.puntoAlerta ||
                'Optimizar la agilidad de cursada y maximizar la visibilidad de beneficios y certificaciones complementarias frente a competidores.'}
            </p>
          </div>
        </div>

        {/* Full Text Synthesis */}
        {conclusionesData.fullText && (
          <div className="mt-6 pt-6 border-t border-white/15 relative z-10">
            <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-2">
              Síntesis Analítica Integral:
            </div>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed font-serif">
              {conclusionesData.fullText}
            </p>
          </div>
        )}
      </section>

      {/* 5. SECCIÓN: FUENTES O PORTALES UNIVERSITARIOS CONSULTADOS (DISEÑO SIMPLE Y ELEGANTE) */}
      <section className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-slate-200/60 gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#0b2545] text-amber-400 flex items-center justify-center font-bold text-xs">
              05
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold font-serif text-[#0b2545] flex items-center gap-2">
                Fuentes y Portales Universitarios Consultados
                <span className="text-[11px] font-sans font-normal text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                  {displayFuentes.length} instituciones
                </span>
              </h3>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-medium text-slate-600">Portales oficiales .bo</span>
          </span>
        </div>

        {/* Lista visual limpia y simplificada de fuentes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {displayFuentes.map((f, idx) => {
            const badge = getUniversityBadge(f.nombre);
            // Get clean hostname
            let cleanDomain = f.url;
            try {
              cleanDomain = new URL(f.url).hostname.replace(/^www\./, '');
            } catch {
              cleanDomain = f.url.replace(/^https?:\/\//, '').split('/')[0];
            }

            return (
              <a
                key={idx}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                title={`${f.nombre} — ${f.url}`}
                className="group flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl bg-white border border-slate-200/80 hover:border-blue-400 hover:bg-blue-50/40 hover:shadow-2xs transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${badge.badgeColor}`}
                  >
                    {badge.acronym}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-700">
                      {f.nombre.replace(/\(.*?\)/g, '').trim() || f.nombre}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">
                      {cleanDomain}
                    </p>
                  </div>
                </div>

                <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 shrink-0 transition-colors" />
              </a>
            );
          })}
        </div>

        {/* Subnota simple y discreta */}
        <div className="mt-3.5 pt-3 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-slate-400 font-sans">
          <span>Verificación territorial en Bolivia (UPB Inteligencia Competitiva)</span>
          <span className="font-mono">Filtro geográfico .edu.bo / .bo</span>
        </div>
      </section>
    </div>
  );
};
