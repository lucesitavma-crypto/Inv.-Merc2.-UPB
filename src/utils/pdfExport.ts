import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';
import { ParsedAnalysisSections } from './markdownParser';

export interface ExportPDFOptions {
  elementId?: string;
  programName?: string;
  parsed?: ParsedAnalysisSections;
  groundingSources?: Array<{ title?: string; uri: string }>;
  onProgress?: (stage: string) => void;
  preferVisual?: boolean;
}

/**
 * Helper to download PDF in sandboxed or iframe browser contexts
 */
function triggerPdfDownload(doc: jsPDF, filename: string): void {
  try {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 1500);
  } catch (err) {
    doc.save(filename);
  }
}

/**
 * Generates an executive, institutional vector PDF report using jsPDF and autoTable.
 * Section 03 (Tabla Comparativa) automatically renders in Landscape A4 (297mm width)
 * ensuring that ALL universities (UPB + all national competitors) are 100% visible,
 * with zero clipping, zero scrollbars, and crystal-clear vector typography.
 */
export function generateExecutiveVectorPDF(options: {
  programName?: string;
  parsed?: ParsedAnalysisSections;
  groundingSources?: Array<{ title?: string; uri: string }>;
  onProgress?: (stage: string) => void;
}): void {
  const { programName = 'Diplomado de Postgrado UPB', parsed, onProgress } = options;

  onProgress?.('Estructurando informe ejecutivo en PDF...');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 14;
  let cursorY = margin;

  const navyColor = [11, 37, 69] as [number, number, number];
  const goldColor = [217, 119, 6] as [number, number, number];
  const slateDark = [30, 41, 59] as [number, number, number];
  const slateMuted = [100, 116, 139] as [number, number, number];

  // Helper for adding institutional page header (adapts dynamically to Portrait 210mm or Landscape 297mm)
  const addHeader = (isCover = false) => {
    const currentPw = doc.internal.pageSize.getWidth();

    // Top colored bar
    doc.setFillColor(navyColor[0], navyColor[1], navyColor[2]);
    doc.rect(0, 0, currentPw, isCover ? 22 : 14, 'F');

    // Accent line
    doc.setFillColor(goldColor[0], goldColor[1], goldColor[2]);
    doc.rect(0, isCover ? 22 : 14, currentPw, 1.2, 'F');

    // Header text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isCover ? 11 : 9);
    doc.text('UNIVERSIDAD PRIVADA BOLIVIANA (UPB)', margin, isCover ? 10 : 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isCover ? 8 : 7.5);
    doc.setTextColor(254, 243, 199);
    doc.text('Formación Continua La Paz · Inteligencia Competitiva', margin, isCover ? 16 : 12);

    // Right tag
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('DICTAMEN ACADÉMICO', currentPw - margin, isCover ? 13 : 9.5, { align: 'right' });
  };

  // Helper for adding footer to all pages (adapts dynamically to Portrait or Landscape)
  const addFooter = (currentPage: number, totalPages: number) => {
    const currentPw = doc.internal.pageSize.getWidth();
    const currentPh = doc.internal.pageSize.getHeight();
    const footerY = currentPh - 10;

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, footerY - 2, currentPw - margin, footerY - 2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
    doc.text(
      'UPB · Formación Continua La Paz — Luz Vivian Machicado Alcoreza (Coordinadora de Admisiones)',
      margin,
      footerY + 2
    );

    doc.text(`Página ${currentPage} de ${totalPages}`, currentPw - margin, footerY + 2, {
      align: 'right',
    });
  };

  // Check page overflow
  const ensureSpace = (neededHeight: number) => {
    const currentPh = doc.internal.pageSize.getHeight();
    if (cursorY + neededHeight > currentPh - 18) {
      doc.addPage('a4', 'portrait');
      addHeader(false);
      cursorY = 22;
    }
  };

  // --- PAGE 1: COVER & PROGRAM PROFILE (PORTRAIT) ---
  addHeader(true);
  cursorY = 30;

  const initialPw = doc.internal.pageSize.getWidth();

  // Title Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, cursorY, initialPw - margin * 2, 26, 3, 3, 'FD');

  doc.setTextColor(goldColor[0], goldColor[1], goldColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('INFORME TÉCNICO DE BENCHMARKING DE POSTGRADO', margin + 4, cursorY + 6);

  doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const titleLines = doc.splitTextToSize(programName, initialPw - margin * 2 - 8);
  doc.text(titleLines.slice(0, 2), margin + 4, cursorY + 14);

  cursorY += 32;

  // Metadata ribbon
  const today = new Date().toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(slateMuted[0], slateMuted[1], slateMuted[2]);
  doc.text(`Fecha: ${today}  |  Ámbito: Universidades Privadas y Públicas de Bolivia`, margin, cursorY);
  cursorY += 7;

  // SECTION 1: RADIOGRAFÍA DEL PROGRAMA UPB
  const rad = parsed?.radiografiaData;
  if (rad) {
    doc.setFillColor(navyColor[0], navyColor[1], navyColor[2]);
    doc.roundedRect(margin, cursorY, 6, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('01', margin + 1.5, cursorY + 4.3);

    doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Radiografía del Programa UPB (Datos de Cartilla Oficial)', margin + 9, cursorY + 4.8);
    cursorY += 9;

    // 4 Key metrics table
    const metricsData = [
      [
        { content: 'Modalidad:', styles: { fontStyle: 'bold' as const } },
        rad.modalidad || 'No especifica',
        { content: 'Carga Horaria:', styles: { fontStyle: 'bold' as const } },
        rad.cargaHoraria || 'No especifica',
      ],
      [
        { content: 'Duración:', styles: { fontStyle: 'bold' as const } },
        rad.duracion || 'No especifica',
        { content: 'Enfoque Principal:', styles: { fontStyle: 'bold' as const } },
        rad.enfoque ? rad.enfoque.substring(0, 120) + (rad.enfoque.length > 120 ? '...' : '') : 'No especifica',
      ],
    ];

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      body: metricsData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.2, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 26, fillColor: [241, 245, 249] },
        1: { cellWidth: 55 },
        2: { cellWidth: 28, fillColor: [241, 245, 249] },
        3: { cellWidth: 'auto' },
      },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 6;

    // Modulos / Plan de estudios
    if (rad.modulos && rad.modulos.length > 0) {
      ensureSpace(24);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
      doc.text(`Estructura Curricular (${rad.modulos.length} Módulos extraídos):`, margin, cursorY);
      cursorY += 4.5;

      const modRows = rad.modulos.map((m, idx) => [`M${idx + 1}`, m]);
      autoTable(doc, {
        startY: cursorY,
        margin: { left: margin, right: margin },
        body: modRows,
        theme: 'plain',
        styles: { fontSize: 7.5, cellPadding: 1.6, textColor: [51, 65, 85] },
        columnStyles: {
          0: { cellWidth: 10, fontStyle: 'bold', textColor: [217, 119, 6] },
          1: { cellWidth: 'auto' },
        },
      });

      cursorY = (doc as any).lastAutoTable.finalY + 7;
    }
  }

  // SECTION 2: COMPETIDORES IDENTIFICADOS
  const hallazgos = parsed?.hallazgosList;
  if (hallazgos && hallazgos.length > 0) {
    ensureSpace(26);

    doc.setFillColor(navyColor[0], navyColor[1], navyColor[2]);
    doc.roundedRect(margin, cursorY, 6, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('02', margin + 1.5, cursorY + 4.3);

    doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Competidores Identificados en el Mercado Nacional', margin + 9, cursorY + 4.8);
    cursorY += 9;

    const compBody = hallazgos.map((h, i) => [
      `C${i + 1}`,
      h.universidad || 'Universidad Boliviana',
      h.nombre || 'Programa Equivalente',
      h.descripcion ? h.descripcion.substring(0, 110) + '...' : 'Equivalente curricular verificado',
    ]);

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      head: [['Ref', 'Universidad', 'Programa Competidor', 'Descripción / Enfoque']],
      body: compBody,
      theme: 'striped',
      headStyles: { fillColor: navyColor, fontSize: 8, fontStyle: 'bold' },
      styles: { fontSize: 7.5, cellPadding: 2, textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 10, fontStyle: 'bold', textColor: goldColor },
        1: { cellWidth: 35, fontStyle: 'bold' },
        2: { cellWidth: 60 },
        3: { cellWidth: 'auto' },
      },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 8;
  }

  // =========================================================================
  // SECTION 3: TABLA COMPARATIVA OBLIGATORIA (EN FORMATO LANDSCAPE / APAISADO)
  // Generada en página horizontal A4 (297mm de ancho) para que TODAS las
  // universidades aparezcan completamente visibles sin cortes ni barras.
  // =========================================================================
  const tableData = parsed?.tableData;
  if (tableData && tableData.rows.length > 0) {
    onProgress?.('Renderizando Tabla Comparativa de todas las universidades en página apaisada...');

    // Open dedicated Landscape page for the comparative table
    doc.addPage('a4', 'landscape');
    addHeader(false);
    cursorY = 22;

    const landscapePw = doc.internal.pageSize.getWidth(); // 297mm
    const availableWidth = landscapePw - margin * 2; // 269mm

    doc.setFillColor(navyColor[0], navyColor[1], navyColor[2]);
    doc.roundedRect(margin, cursorY, 6, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('03', margin + 1.5, cursorY + 4.3);

    doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text('Tabla Comparativa de Programas Académicos (Visualización Completa de Todas las Universidades)', margin + 9, cursorY + 4.8);
    cursorY += 8.5;

    const tableHeaders = tableData.headers;
    const numCols = tableHeaders.length;

    const tableBody = tableData.rows.map((row) => {
      const rowArr = [row.variable, row.upb];
      if (row.competitors && row.competitors.length > 0) {
        rowArr.push(...row.competitors);
      } else {
        if (row.competitor1) rowArr.push(row.competitor1);
        if (row.competitor2) rowArr.push(row.competitor2);
        if (row.competitor3) rowArr.push(row.competitor3);
        if (row.competitor4) rowArr.push(row.competitor4);
      }
      return rowArr;
    });

    // Calculate dynamic column widths across the 269mm landscape width
    // Variable column gets 38mm, the rest of available width is divided equally
    const varColWidth = Math.min(40, Math.max(32, availableWidth * 0.14));
    const eachUniWidth = (availableWidth - varColWidth) / Math.max(1, numCols - 1);

    const columnStylesObj: Record<number, any> = {
      0: {
        cellWidth: varColWidth,
        fontStyle: 'bold',
        fillColor: [248, 250, 252],
        textColor: navyColor,
      },
      1: {
        cellWidth: eachUniWidth,
        fillColor: [240, 249, 255],
        textColor: [11, 37, 69],
        fontStyle: 'bold',
      },
    };

    for (let c = 2; c < numCols; c++) {
      columnStylesObj[c] = {
        cellWidth: eachUniWidth,
        textColor: [30, 41, 59],
      };
    }

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      head: [tableHeaders],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: navyColor,
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: 2.8,
        halign: 'left',
      },
      styles: {
        fontSize: 7.2,
        cellPadding: 2.2,
        textColor: [30, 41, 59],
        overflow: 'linebreak',
        lineColor: [203, 213, 225],
        lineWidth: 0.1,
      },
      columnStyles: columnStylesObj,
      alternateRowStyles: {
        fillColor: [253, 253, 255],
      },
    });

    // Switch back to portrait for remaining executive sections
    doc.addPage('a4', 'portrait');
    addHeader(false);
    cursorY = 22;
  }

  // --- SECTION 4: DICTAMEN ESTRATÉGICO & ANÁLISIS DE BRECHAS (PORTRAIT) ---
  const conclusiones = parsed?.conclusionesData;
  if (conclusiones) {
    ensureSpace(35);

    doc.setFillColor(navyColor[0], navyColor[1], navyColor[2]);
    doc.roundedRect(margin, cursorY, 6, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('04', margin + 1.5, cursorY + 4.3);

    doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Dictamen Estratégico & Análisis de Brechas', margin + 9, cursorY + 4.8);
    cursorY += 9;

    const portraitPw = doc.internal.pageSize.getWidth();

    // Ventajas
    if (conclusiones.ventajaCompetitiva && conclusiones.ventajaCompetitiva.length > 5) {
      doc.setFillColor(236, 253, 245);
      doc.roundedRect(margin, cursorY, portraitPw - margin * 2, 6, 1.5, 1.5, 'F');
      doc.setTextColor(6, 95, 70);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('VENTAJAS COMPETITIVAS UPB:', margin + 3, cursorY + 4.2);
      cursorY += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      const lines = doc.splitTextToSize(conclusiones.ventajaCompetitiva, portraitPw - margin * 2 - 4);
      doc.text(lines, margin + 2, cursorY);
      cursorY += lines.length * 3.6 + 3;
    }

    // Brechas / Oportunidades
    if (conclusiones.puntoAlerta && conclusiones.puntoAlerta.length > 5) {
      ensureSpace(15);
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(margin, cursorY, portraitPw - margin * 2, 6, 1.5, 1.5, 'F');
      doc.setTextColor(146, 64, 14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('OPORTUNIDADES Y DIFERENCIADORES DE LA COMPETENCIA:', margin + 3, cursorY + 4.2);
      cursorY += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      const lines = doc.splitTextToSize(conclusiones.puntoAlerta, portraitPw - margin * 2 - 4);
      doc.text(lines, margin + 2, cursorY);
      cursorY += lines.length * 3.6 + 3;
    }

    // Texto completo si no estaban segregadas
    if (!conclusiones.ventajaCompetitiva && !conclusiones.puntoAlerta && conclusiones.fullText) {
      ensureSpace(15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      const resLines = doc.splitTextToSize(conclusiones.fullText, portraitPw - margin * 2);
      doc.text(resLines, margin, cursorY);
      cursorY += resLines.length * 3.6 + 5;
    }
  }

  // --- SECTION 5: FUENTES Y PORTALES CONSULTADOS ---
  const fuentes = parsed?.fuentesList;
  if (fuentes && fuentes.length > 0) {
    ensureSpace(24);

    doc.setFillColor(navyColor[0], navyColor[1], navyColor[2]);
    doc.roundedRect(margin, cursorY, 6, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('05', margin + 1.5, cursorY + 4.3);

    doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Fuentes y Portales Universitarios Consultados (.bo)', margin + 9, cursorY + 4.8);
    cursorY += 9;

    const fuentesRows = fuentes.slice(0, 10).map((f) => [f.nombre || 'Portal Universitario', f.url]);
    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      head: [['Institución Académica', 'Enlace Oficial Verificado']],
      body: fuentesRows,
      theme: 'plain',
      headStyles: { fillColor: [241, 245, 249], textColor: navyColor, fontSize: 7.5, fontStyle: 'bold' },
      styles: { fontSize: 7, cellPadding: 1.8, textColor: [71, 85, 105] },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 'auto', textColor: [29, 78, 216] },
      },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 8;
  }

  // --- INSTITUTIONAL SIGN-OFF AT THE END ---
  ensureSpace(22);
  const currentPw = doc.internal.pageSize.getWidth();
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, cursorY, currentPw - margin * 2, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(navyColor[0], navyColor[1], navyColor[2]);
  doc.text('UNIVERSIDAD PRIVADA BOLIVIANA (UPB)', margin + 4, cursorY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(goldColor[0], goldColor[1], goldColor[2]);
  doc.text('Formación Continua La Paz · Vicerrectorado de Postgrado', margin + 4, cursorY + 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(slateDark[0], slateDark[1], slateDark[2]);
  doc.text(
    'Luz Vivian Machicado Alcoreza — Coordinadora de Admisiones y Reclutamiento',
    currentPw - margin - 4,
    cursorY + 9,
    { align: 'right' }
  );

  // Apply footers and headers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    if (i > 1) {
      addHeader(false);
    }
    addFooter(i, totalPages);
  }

  onProgress?.('Descargando archivo PDF...');
  const cleanTitle = programName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 45);

  const filename = `UPB_Benchmarking_${cleanTitle || 'Programa'}.pdf`;
  triggerPdfDownload(doc, filename);
}

/**
 * Main export function: Prioritizes the multi-page vector PDF report with Landscape
 * comparative matrix so that ALL universities are 100% visible with zero horizontal clipping.
 */
export async function exportDashboardToPDF(options: ExportPDFOptions): Promise<void> {
  const { programName = 'Diplomado_UPB', parsed, onProgress } = options;

  // Always use generateExecutiveVectorPDF when parsed data exists because it
  // guarantees Section 03 (Tabla Comparativa) renders in Landscape A4 (297mm width)
  // displaying every single university column without any horizontal scrollbar cut-off!
  generateExecutiveVectorPDF({
    programName,
    parsed,
    groundingSources: options.groundingSources,
    onProgress,
  });
}
