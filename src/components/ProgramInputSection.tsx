import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Globe,
  Link as LinkIcon,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Building2,
  ChevronRight,
  FileCheck,
  AlertCircle,
  X,
} from 'lucide-react';
import { BOLIVIAN_COMPETITORS } from '../data/upbPrograms';

interface ProgramInputSectionProps {
  onStartAnalysis: (params: {
    driveUrl: string;
    pdfBase64: string;
    pdfName: string;
    programText: string;
    programName: string;
    focusUniversities: string[];
  }) => void;
  isLoading: boolean;
}

export const ProgramInputSection: React.FC<ProgramInputSectionProps> = ({
  onStartAnalysis,
  isLoading,
}) => {
  // Tabs: only explicit user inputs (upload PDF, Google Drive, or paste document text)
  const [activeTab, setActiveTab] = useState<'upload' | 'drive' | 'manual'>('upload');

  // Input states - strictly empty by default, no preloaded data
  const [driveUrl, setDriveUrl] = useState<string>('');
  const [pdfFile, setPdfFile] = useState<{
    name: string;
    base64: string;
    sizeKb: number;
  } | null>(null);
  const [programName, setProgramName] = useState<string>('');
  const [manualText, setManualText] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Selected competitor universities filter in Bolivia (all by default)
  const [selectedUniversities, setSelectedUniversities] = useState<string[]>(
    BOLIVIAN_COMPETITORS.map((u) => u.id)
  );

  const toggleUniversity = (id: string) => {
    if (selectedUniversities.includes(id)) {
      if (selectedUniversities.length > 1) {
        setSelectedUniversities(selectedUniversities.filter((u) => u !== id));
      }
    } else {
      setSelectedUniversities([...selectedUniversities, id]);
    }
  };

  // Handle PDF file selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setValidationError('Por favor selecciona un archivo PDF válido (.pdf).');
      return;
    }

    setValidationError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const resultStr = reader.result as string;
      const base64Data = resultStr.split(',')[1];
      setPdfFile({
        name: file.name,
        base64: base64Data,
        sizeKb: Math.round(file.size / 1024),
      });

      // Suggest program name from file name if user hasn't typed one
      if (!programName) {
        const cleanName = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
        setProgramName(cleanName);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePdf = () => {
    setPdfFile(null);
    setProgramName('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    let finalDriveUrl = '';
    let finalPdfBase64 = '';
    let finalPdfName = '';
    let finalProgramText = '';
    let finalProgramName = programName.trim();

    if (activeTab === 'upload') {
      if (!pdfFile) {
        setValidationError('Debes seleccionar y subir el archivo PDF de la cartilla o brochure.');
        return;
      }
      finalPdfBase64 = pdfFile.base64;
      finalPdfName = pdfFile.name;
      if (!finalProgramName) {
        finalProgramName = pdfFile.name.replace(/\.pdf$/i, '');
      }
      finalProgramText = manualText.trim();
    } else if (activeTab === 'drive') {
      if (!driveUrl.trim()) {
        setValidationError('Por favor ingresa el enlace de Google Drive de la cartilla en formato PDF.');
        return;
      }
      finalDriveUrl = driveUrl.trim();
      finalProgramName = programName.trim();
      finalProgramText = manualText.trim();
    } else if (activeTab === 'manual') {
      if (!manualText.trim()) {
        setValidationError('Por favor introduce o pega la información completa de la cartilla o brochure del programa.');
        return;
      }
      if (!finalProgramName) {
        finalProgramName = 'Programa Diplomado UPB';
      }
      finalProgramText = manualText.trim();
    }

    onStartAnalysis({
      driveUrl: finalDriveUrl,
      pdfBase64: finalPdfBase64,
      pdfName: finalPdfName,
      programText: finalProgramText,
      programName: finalProgramName,
      focusUniversities: selectedUniversities,
    });
  };

  const hasSelectedDocument =
    (activeTab === 'upload' && pdfFile !== null) ||
    (activeTab === 'drive' && driveUrl.trim().length > 0) ||
    (activeTab === 'manual' && manualText.trim().length > 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
      {/* Top Banner */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#0b2545] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-600" />
            Carga de Cartilla / Brochure a Evaluar
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Selecciona la cartilla oficial que deseas auditar. El análisis se realizará exclusivamente en base a los datos de este documento.
          </p>
        </div>

        {/* Input Mode Selector */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl self-start md:self-auto text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setActiveTab('upload');
              setValidationError(null);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-white text-[#0b2545] font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            <span>Subir Archivo PDF</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('drive');
              setValidationError(null);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'drive'
                ? 'bg-white text-[#0b2545] font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>Google Drive (.pdf)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('manual');
              setValidationError(null);
            }}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'manual'
                ? 'bg-white text-[#0b2545] font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>Texto de la Cartilla</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6">
        {/* Error notification if validation fails */}
        {validationError && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Tab 1: Direct PDF Upload */}
        {activeTab === 'upload' && (
          <div className="space-y-5">
            {!pdfFile ? (
              <div className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-8 text-center transition-all bg-slate-50/50 hover:bg-amber-50/10">
                <input
                  type="file"
                  id="pdf-upload"
                  accept="application/pdf,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="pdf-upload"
                  className="cursor-pointer flex flex-col items-center justify-center"
                >
                  <div className="w-14 h-14 rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center mb-3 shadow-xs">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    Haz clic aquí o arrastra el archivo PDF de la cartilla UPB
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Sube el brochure oficial (diplomado, plan de estudios, materias, horas y modalidad) para iniciar la extracción analítica.
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs">
                    Examinar archivo en tu equipo (.pdf)
                  </span>
                </label>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-emerald-300 bg-emerald-50/40 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Cartilla PDF Cargada Exitosamente
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      {pdfFile.name}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Tamaño: {pdfFile.sizeKb} KB · Formato PDF
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRemovePdf}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                  title="Eliminar y seleccionar otro archivo"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre del Programa (Opcional, se detecta del PDF):
                </label>
                <input
                  type="text"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="Ej: Diplomado en Transformación Digital e Inteligencia Artificial"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Instrucciones o foco particular para este programa (Opcional):
                </label>
                <input
                  type="text"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Ej: Priorizar comparación de herramientas prácticas y horas lectivas"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Google Drive Link */}
        {activeTab === 'drive' && (
          <div className="space-y-5">
            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                  <LinkIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-blue-950">
                    Vincular Archivo PDF desde Google Drive
                  </h3>
                  <p className="text-xs text-blue-800 mt-0.5">
                    Pega el enlace compartido del archivo .pdf de la cartilla UPB alojado en Google Drive. El analista accederá a los datos de ese documento para contrastarlo con el mercado boliviano.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Enlace del archivo PDF en Google Drive:
              </label>
              <input
                type="url"
                value={driveUrl}
                onChange={(e) => {
                  setDriveUrl(e.target.value);
                  setValidationError(null);
                }}
                placeholder="https://drive.google.com/file/d/..."
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-slate-800"
                required={activeTab === 'drive'}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Asegúrate de que el archivo tenga permisos de lectura ("Cualquier persona con el enlace").
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre del Programa (Opcional, se extrae de la cartilla):
                </label>
                <input
                  type="text"
                  value={programName}
                  onChange={(e) => setProgramName(e.target.value)}
                  placeholder="Se extrae automáticamente de la portada del brochure"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Notas adicionales sobre el programa (Opcional):
                </label>
                <input
                  type="text"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="Ej: Versión 2025 para ejecutivos"
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Manual Text Input */}
        {activeTab === 'manual' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Nombre del Programa a Evaluar:
              </label>
              <input
                type="text"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                placeholder="Ej: Diplomado en Ciberseguridad y Gestión de Riesgos TI"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                required={activeTab === 'manual'}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Texto / Contenido extraído de la cartilla o brochure:
              </label>
              <textarea
                rows={6}
                value={manualText}
                onChange={(e) => {
                  setManualText(e.target.value);
                  setValidationError(null);
                }}
                placeholder="Pega aquí los módulos o materias, carga horaria, duración, modalidad y propuesta de valor de la cartilla del programa de la UPB..."
                className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed text-slate-800"
                required={activeTab === 'manual'}
              />
            </div>
          </div>
        )}

        {/* Bolivian Competitor Priority Selector */}
        <div className="mt-6 pt-5 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Filtro Geográfico Boliviano (Universidades a Contrastar):
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 font-medium">
                {selectedUniversities.length} de {BOLIVIAN_COMPETITORS.length} universidades
              </span>
              <button
                type="button"
                onClick={() => setSelectedUniversities(BOLIVIAN_COMPETITORS.map((u) => u.id))}
                className="px-2 py-0.5 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setSelectedUniversities(['UCB', 'UPSA', 'UNIVALLE', 'UMSA', 'EMI'])}
                className="px-2 py-0.5 text-[11px] rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
              >
                Top 5
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {BOLIVIAN_COMPETITORS.map((uni) => {
              const isChecked = selectedUniversities.includes(uni.id);
              return (
                <button
                  key={uni.id}
                  type="button"
                  onClick={() => toggleUniversity(uni.id)}
                  className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                    isChecked
                      ? 'border-[#0b2545] bg-[#0b2545]/5 text-[#0b2545] font-semibold ring-1 ring-[#0b2545]/20'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{uni.id}</span>
                    <span className="text-[10px] text-slate-500 font-mono">.{uni.domain.split('.').pop()}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 truncate mt-0.5" title={uni.name}>
                    {uni.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              El análisis comparativo investigará a toda la competencia universitaria boliviana a partir de la cartilla seleccionada.
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading || !hasSelectedDocument}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm text-white shadow-md transition-all flex items-center justify-center gap-2 ${
              isLoading || !hasSelectedDocument
                ? 'bg-slate-400 cursor-not-allowed opacity-75'
                : 'bg-gradient-to-r from-[#0b2545] to-[#134074] hover:from-[#13315c] hover:to-[#0b2545] active:scale-98 ring-2 ring-amber-400/30'
            }`}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Mapeando Toda la Competencia en Bolivia...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Analizar Frente a Toda la Competencia</span>
                <ChevronRight className="w-4 h-4 text-white/70" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
