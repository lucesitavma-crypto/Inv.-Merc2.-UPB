import React, { useEffect, useState } from 'react';
import { Search, FileSearch, Sparkles, Database, CheckCircle2, ShieldAlert } from 'lucide-react';

interface AnalysisLoadingIndicatorProps {
  programName: string;
}

export const AnalysisLoadingIndicator: React.FC<AnalysisLoadingIndicatorProps> = ({
  programName,
}) => {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: 'Paso 1: Extracción de Datos de la Cartilla UPB',
      desc: 'Extrayendo plan de estudios, módulos, modalidad, carga horaria, duración y propuesta de valor...',
      icon: FileSearch,
    },
    {
      title: 'Paso 2: Búsqueda Inteligente en Universidades de Bolivia',
      desc: 'Explorando páginas web oficiales (.edu.bo / .bo) de UCB, UPSA, UNIVALLE, UMSA, EMI con Google Search...',
      icon: Search,
    },
    {
      title: 'Paso 3: Análisis Semántico & Matriz de Competencia',
      desc: 'Homologando programas por enfoque pedagógico y evaluando similitud de módulos...',
      icon: Database,
    },
    {
      title: 'Paso 4: Generación de Tabla Comparativa & Conclusiones',
      desc: 'Estructurando la Radiografía, Tabla obligatoria y Conclusiones Estratégicas de UPB...',
      icon: Sparkles,
    },
  ];

  useEffect(() => {
    const timer1 = setTimeout(() => setActiveStep(1), 3200);
    const timer2 = setTimeout(() => setActiveStep(2), 7500);
    const timer3 = setTimeout(() => setActiveStep(3), 12000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center max-w-2xl mx-auto my-8">
      {/* Animated Spinner & Crest */}
      <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-amber-500 border-r-[#0b2545] animate-spin" />
        <div className="w-12 h-12 rounded-xl bg-[#0b2545] text-amber-400 font-serif font-black flex items-center justify-center text-lg shadow-inner">
          UPB
        </div>
      </div>

      <h3 className="text-lg font-bold text-[#0b2545] font-serif">
        Analizando Posicionamiento Competitivo
      </h3>
      <p className="text-xs text-slate-600 mt-1 mb-8 max-w-md mx-auto">
        Evaluando <strong className="text-slate-800">"{programName}"</strong> frente a la oferta nacional boliviana con filtro geográfico estricto.
      </p>

      {/* Progress Steps */}
      <div className="space-y-3 text-left">
        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          const isDone = idx < activeStep;
          const isCurrent = idx === activeStep;

          return (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                isCurrent
                  ? 'border-amber-500 bg-amber-50/50 ring-1 ring-amber-400/40 shadow-xs'
                  : isDone
                  ? 'border-emerald-200 bg-emerald-50/30 text-emerald-950'
                  : 'border-slate-100 bg-slate-50/50 opacity-50'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  isCurrent
                    ? 'bg-amber-500 text-white animate-pulse'
                    : isDone
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <StepIcon className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={`text-xs font-bold ${
                    isCurrent
                      ? 'text-[#0b2545]'
                      : isDone
                      ? 'text-emerald-900'
                      : 'text-slate-600'
                  }`}
                >
                  {step.title}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {step.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
        <span>Protocolo de Cero Alucinaciones: Datos no especificados se marcarán estrictamente como "No especifica".</span>
      </div>
    </div>
  );
};
