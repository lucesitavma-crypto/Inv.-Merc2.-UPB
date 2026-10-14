import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function sanitizeMarkdown(content: string): string {
  if (!content) return '';
  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && /\|\s*Similitud(?:\s+de\s+m[oó]dulos)?\s*\|/i.test(trimmed)) {
        const parts = line.split('|');
        // parts[0] is "", parts[1] is variable ("Similitud de Módulos"), parts[2] is UPB column
        if (parts.length >= 4) {
          parts[2] = ' ';
          return parts.join('|');
        }
      }
      return line;
    })
    .join('\n');
}

export function renderMarkdown(content: string): string {
  if (!content) return '';
  return marked.parse(sanitizeMarkdown(content)) as string;
}

export interface ExtractedRadiografia {
  nombre: string;
  modulos: string[];
  modalidad: string;
  cargaHoraria: string;
  duracion: string;
  enfoque: string;
}

export interface ExtractedCompetitorFinding {
  nombre: string;
  universidad: string;
  descripcion: string;
  url?: string;
}

export interface ParsedTableData {
  headers: string[];
  rows: Array<{
    variable: string;
    upb: string;
    competitors: string[];
    competitor1: string;
    competitor2: string;
    competitor3?: string;
    competitor4?: string;
    [key: string]: any;
  }>;
}

export interface ExtractedFuente {
  nombre: string;
  url: string;
  descripcion?: string;
  dominio?: string;
}

export interface ParsedAnalysisSections {
  radiografiaRaw: string;
  hallazgosRaw: string;
  tablaComparativaRaw: string;
  conclusionesRaw: string;
  fuentesRaw: string;
  radiografiaData: ExtractedRadiografia;
  hallazgosList: ExtractedCompetitorFinding[];
  tableData: ParsedTableData | null;
  conclusionesData: {
    ventajaCompetitiva: string;
    puntoAlerta: string;
    fullText: string;
  };
  fuentesList: ExtractedFuente[];
}

export function parseAnalysisSections(markdown: string): ParsedAnalysisSections {
  const result: ParsedAnalysisSections = {
    radiografiaRaw: '',
    hallazgosRaw: '',
    tablaComparativaRaw: '',
    conclusionesRaw: '',
    fuentesRaw: '',
    radiografiaData: {
      nombre: '',
      modulos: [],
      modalidad: '',
      cargaHoraria: '',
      duracion: '',
      enfoque: '',
    },
    hallazgosList: [],
    tableData: null,
    conclusionesData: {
      ventajaCompetitiva: '',
      puntoAlerta: '',
      fullText: '',
    },
    fuentesList: [],
  };

  if (!markdown) return result;
  const cleanMarkdown = sanitizeMarkdown(markdown);

  // Split by primary section headers (Markdown ### 1., **1., etc.)
  const sec1Match = cleanMarkdown.match(/(?:###|\*\*)\s*1\.\s*Radiografía del Programa UPB[\s\S]*?(?=(?:###|\*\*)\s*2\.|$)/i);
  const sec2Match = cleanMarkdown.match(/(?:###|\*\*)\s*2\.\s*Hallazgos en el Mercado Boliviano[\s\S]*?(?=(?:###|\*\*)\s*3\.|$)/i);
  const sec3Match = cleanMarkdown.match(/(?:###|\*\*)\s*3\.\s*Tabla Comparativa[\s\S]*?(?=(?:###|\*\*)\s*4\.|$)/i);
  const sec4Match = cleanMarkdown.match(/(?:###|\*\*)\s*4\.\s*Conclusiones Estratégicas[\s\S]*?(?=(?:###|\*\*)\s*5\.|$)/i);
  const sec5Match = cleanMarkdown.match(/(?:###|\*\*)\s*5\.\s*Fuentes[\s\S]*/i);

  result.radiografiaRaw = sec1Match ? sec1Match[0].trim() : '';
  result.hallazgosRaw = sec2Match ? sec2Match[0].trim() : '';
  result.tablaComparativaRaw = sec3Match ? sec3Match[0].trim() : '';
  result.conclusionesRaw = sec4Match ? sec4Match[0].trim() : '';
  result.fuentesRaw = sec5Match ? sec5Match[0].trim() : '';

  // 1. Parse Radiografía Data
  if (result.radiografiaRaw) {
    const lines = result.radiografiaRaw.split('\n');
    let currentField = '';
    const modulesList: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Skip section headers like "### 1. Radiografía del Programa UPB"
      if (/^#{1,6}\s+/i.test(line) || /radiograf[ií]a/i.test(line)) {
        continue;
      }

      const nameMatch = line.match(/(?:(?:nombre(?:\s+oficial)?(?:\s+del)?(?:\s+programa|\s+diplomado)?)|(?:programa(?:\s+upb)?))[:*#\s-]+\s*(.*)/i);
      if (nameMatch && !result.radiografiaData.nombre) {
        let candidate = nameMatch[1].replace(/[*_#]/g, '').trim();
        candidate = candidate.replace(/^[\["'«“]+|[\]"'»”]+$/g, '').trim();
        const candLower = candidate.toLowerCase();
        if (
          candidate &&
          candLower !== 'upb' &&
          candLower !== 'upb postgrado' &&
          candLower !== 'programa de postgrado upb' &&
          candLower !== 'cartilla upb' &&
          candLower !== 'no especifica' &&
          !candLower.startsWith('plan') &&
          !candLower.startsWith('módulo') &&
          !candLower.startsWith('[') &&
          candidate.length > 3
        ) {
          result.radiografiaData.nombre = candidate;
          currentField = 'nombre';
          continue;
        }
      }

      const modMatch = line.match(/(?:Plan de estudios|Módulos|Materias)[:*]+\s*(.*)/i);
      if (modMatch) {
        currentField = 'modulos';
        if (modMatch[1] && !modMatch[1].toLowerCase().includes('plan')) {
          modulesList.push(modMatch[1].replace(/[*_]/g, '').trim());
        }
        continue;
      }

      if (currentField === 'modulos' && (line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line))) {
        const cleanedMod = line.replace(/^[-*•\d.]+\s*/, '').replace(/[*_]/g, '').trim();
        if (cleanedMod && !cleanedMod.toLowerCase().startsWith('modalidad') && !cleanedMod.toLowerCase().startsWith('carga')) {
          modulesList.push(cleanedMod);
          continue;
        }
      }

      const modalityMatch = line.match(/(?:Modalidad)[:*]+\s*(.*)/i);
      if (modalityMatch) {
        result.radiografiaData.modalidad = modalityMatch[1].replace(/[*_]/g, '').trim();
        currentField = 'modalidad';
        continue;
      }

      const hoursMatch = line.match(/(?:Carga horaria|Horas)[:*]+\s*(.*)/i);
      if (hoursMatch) {
        result.radiografiaData.cargaHoraria = hoursMatch[1].replace(/[*_]/g, '').trim();
        currentField = 'cargaHoraria';
        continue;
      }

      const durationMatch = line.match(/(?:Duración)[:*]+\s*(.*)/i);
      if (durationMatch) {
        result.radiografiaData.duracion = durationMatch[1].replace(/[*_]/g, '').trim();
        currentField = 'duracion';
        continue;
      }

      const focusMatch = line.match(/(?:Enfoque principal|Enfoque|Propuesta de valor)[:*]+\s*(.*)/i);
      if (focusMatch) {
        result.radiografiaData.enfoque = focusMatch[1].replace(/[*_]/g, '').trim();
        currentField = 'enfoque';
        continue;
      }

      if (currentField === 'enfoque' && line && !line.startsWith('#') && !line.startsWith('**2.')) {
        result.radiografiaData.enfoque += ' ' + line.replace(/[*_]/g, '').trim();
      }
    }

    result.radiografiaData.modulos = modulesList;
  }

  // 2. Parse Hallazgos
  if (result.hallazgosRaw) {
    const rawParagraphs = result.hallazgosRaw.split('\n').filter((l) => l.trim().length > 0);
    for (const p of rawParagraphs) {
      if (p.includes('###') || p.includes('Hallazgos en el Mercado')) continue;
      // Look for bullet items or numbered items
      if (p.startsWith('-') || p.startsWith('*') || /^\d+\./.test(p)) {
        const cleanLine = p.replace(/^[-*•\d.]+\s*/, '').trim();
        // Check if university or competitor name is separated by colon, em-dash, or parentheses
        let compName = cleanLine;
        let uni = 'Universidad en Bolivia';
        let desc = cleanLine;

        const urlMatch = cleanLine.match(/https?:\/\/[^\s)]+/);
        const url = urlMatch ? urlMatch[0] : undefined;

        if (cleanLine.includes('—') || cleanLine.includes(' - ')) {
          const parts = cleanLine.split(/[—\-]/);
          compName = parts[0].replace(/[*_]/g, '').trim();
          desc = parts.slice(1).join(' - ').replace(/[*_]/g, '').trim();
        } else if (cleanLine.includes(':')) {
          const parts = cleanLine.split(':');
          compName = parts[0].replace(/[*_]/g, '').trim();
          desc = parts.slice(1).join(':').replace(/[*_]/g, '').trim();
        }

        // Try to identify university name from description or compName
        const knownUnis = ['UCB', 'UPSA', 'UNIVALLE', 'UMSA', 'EMI', 'UNIFRANZ', 'NUR', 'UTEPSA', 'Católica', 'Mayor de San Andrés', 'del Valle', 'Militar de Ingeniería'];
        for (const u of knownUnis) {
          if (cleanLine.toUpperCase().includes(u.toUpperCase())) {
            uni = u.length <= 8 ? u : u.substring(0, 20);
            break;
          }
        }

        result.hallazgosList.push({
          nombre: compName,
          universidad: uni,
          descripcion: desc,
          url,
        });
      }
    }
  }

  // 3. Parse Table
  if (result.tablaComparativaRaw) {
    const tableLines = result.tablaComparativaRaw
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('|') && (l.match(/\|/g) || []).length >= 2);

    if (tableLines.length >= 3) {
      const headerParts = tableLines[0].split('|').map((h) => h.replace(/[*_]/g, '').trim());
      if (headerParts.length > 0 && headerParts[0] === '') headerParts.shift();
      if (headerParts.length > 0 && headerParts[headerParts.length - 1] === '') headerParts.pop();
      const rawHeaders = headerParts.filter(Boolean);

      const rows: ParsedTableData['rows'] = [];

      for (let i = 2; i < tableLines.length; i++) {
        const parts = tableLines[i].split('|').map((c) => c.replace(/[*_]/g, '').trim());
        if (parts.length > 0 && parts[0] === '') parts.shift();
        if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
        const rawCols = parts;

        if (rawCols.length >= 2) {
          const compCols = rawCols.slice(2);
          const isSimilarityRow = rawCols[0].toLowerCase().includes('similitud');
          const rowObj: any = {
            variable: rawCols[0] || '',
            upb: isSimilarityRow ? '' : (rawCols[1] || ''),
            competitors: compCols.map((c) => c || 'No especifica'),
            competitor1: compCols[0] || 'No especifica',
            competitor2: compCols[1] || 'No especifica',
            competitor3: compCols[2] || 'No especifica',
            competitor4: compCols[3] || 'No especifica',
          };
          rows.push(rowObj);
        }
      }

      result.tableData = {
        headers: rawHeaders,
        rows,
      };
    }
  }

  // Helper to validate whether a candidate name is a genuine program title
  const isInvalidProgramName = (name?: string): boolean => {
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

  // Fallback 1: Extract from table row "Nombre del Programa"
  if (isInvalidProgramName(result.radiografiaData.nombre)) {
    if (result.tableData) {
      const nameRow = result.tableData.rows.find((r) =>
        r.variable.toLowerCase().includes('nombre')
      );
      if (nameRow && !isInvalidProgramName(nameRow.upb)) {
        result.radiografiaData.nombre = nameRow.upb.replace(/[*_#\[\]]/g, '').trim();
      }
    }
  }

  // Fallback 2: Scan markdown for "Nombre del programa:" while avoiding headers
  if (isInvalidProgramName(result.radiografiaData.nombre)) {
    const allLines = cleanMarkdown.split('\n');
    for (const l of allLines) {
      const trimmed = l.trim();
      if (/radiograf[ií]a/i.test(trimmed) || /^#{1,6}\s+/i.test(trimmed)) continue;
      const match = trimmed.match(/(?:nombre(?:\s+oficial)?(?:\s+del)?(?:\s+programa|\s+diplomado)?)[:*#\s-]+\s*([^\n\r*#]+)/i);
      if (match) {
        const candidate = match[1].replace(/[*_#\[\]]/g, '').trim();
        if (!isInvalidProgramName(candidate)) {
          result.radiografiaData.nombre = candidate;
          break;
        }
      }
    }
  }

  // Fallback 3: Search for "Diplomado en [Nombre]" in the text
  if (isInvalidProgramName(result.radiografiaData.nombre)) {
    const matchDip = cleanMarkdown.match(/Diplomado en [^\n\r*|#.,;]{8,80}/i);
    if (matchDip && !isInvalidProgramName(matchDip[0])) {
      result.radiografiaData.nombre = matchDip[0].trim();
    }
  }

  // 4. Parse Conclusiones Estratégicas
  if (result.conclusionesRaw) {
    const cleanText = result.conclusionesRaw
      .replace(/(?:###|\*\*)\s*4\.\s*Conclusiones Estratégicas/i, '')
      .trim();

    result.conclusionesData.fullText = cleanText;

    // Detect Ventaja Competitiva vs Alerta
    const ventajaMatch = cleanText.match(/(?:ventaja competitiva|fortaleza|diferenciador)[^.:;]*[:—]?\s*([^.]+)/i);
    const alertaMatch = cleanText.match(/(?:alerta|mejora|punto de mejora|desafío|vigilar)[^.:;]*[:—]?\s*([^.]+)/i);

    if (ventajaMatch) {
      result.conclusionesData.ventajaCompetitiva = ventajaMatch[0].trim();
    }
    if (alertaMatch) {
      result.conclusionesData.puntoAlerta = alertaMatch[0].trim();
    }
  }

  // 5. Parse Fuentes o Portales Universitarios Consultados
  const defaultFuentes: ExtractedFuente[] = [
    {
      nombre: 'Universidad Católica Boliviana "San Pablo" (UCB Postgrado)',
      url: 'https://postgrado.ucb.edu.bo/',
      descripcion: 'Portal oficial de programas de postgrado, maestrías y diplomados',
      dominio: 'postgrado.ucb.edu.bo',
    },
    {
      nombre: 'Universidad Privada de Santa Cruz de la Sierra (UPSA - DIP)',
      url: 'https://www.upsa.edu.bo/index.php/es/postgrado',
      descripcion: 'Dirección de Investigación y Postgrado UPSA',
      dominio: 'upsa.edu.bo',
    },
    {
      nombre: 'Universidad del Valle (UNIVALLE Postgrado)',
      url: 'https://www.univalle.edu/postgrado/',
      descripcion: 'Vicerrectorado de Postgrado e Investigación en Bolivia',
      dominio: 'univalle.edu',
    },
    {
      nombre: 'Universidad Mayor de San Andrés (UMSA Postgrado)',
      url: 'https://postgrado.umsa.bo/',
      descripcion: 'Centro de Estudios y Postgrado Universitario UMSA',
      dominio: 'postgrado.umsa.bo',
    },
    {
      nombre: 'Escuela Militar de Ingeniería (EMI Postgrado)',
      url: 'https://postgrado.emi.edu.bo/',
      descripcion: 'Unidad Académica de Postgrado "Mcal. Antonio José de Sucre"',
      dominio: 'postgrado.emi.edu.bo',
    },
    {
      nombre: 'Universidad Franz Tamayo (UNIFRANZ Postgrado)',
      url: 'https://postgrado.unifranz.edu.bo/',
      descripcion: 'Escuela de Postgrado UNIFRANZ Bolivia',
      dominio: 'postgrado.unifranz.edu.bo',
    },
    {
      nombre: 'Universidad Autónoma Gabriel René Moreno (UAGRM Postgrado)',
      url: 'https://postgradouagrm.edu.bo/',
      descripcion: 'Dirección Universitaria de Postgrado / Unidades CIFTT',
      dominio: 'postgradouagrm.edu.bo',
    },
    {
      nombre: 'Universidad Tecnológica Privada de Santa Cruz (UTEPSA Postgrado)',
      url: 'https://www.utepsa.edu/postgrado/',
      descripcion: 'Centro de Postgrado y Educación Continua',
      dominio: 'utepsa.edu',
    },
    {
      nombre: 'Universidad Privada Domingo Savio (UPDS Postgrado)',
      url: 'https://postgrado.upds.edu.bo/',
      descripcion: 'Escuela de Postgrado Nacional UPDS',
      dominio: 'postgrado.upds.edu.bo',
    },
    {
      nombre: 'Universidad NUR (NUR Postgrado)',
      url: 'https://nur.edu/postgrado/',
      descripcion: 'Dirección de Postgrado y Educación Contínua',
      dominio: 'nur.edu',
    },
  ];

  if (result.fuentesRaw) {
    const rawLines = result.fuentesRaw.split('\n');
    const parsedFuentes: ExtractedFuente[] = [];

    for (const rawLine of rawLines) {
      const line = rawLine.trim();
      if (!line || /^#{1,6}\s+/i.test(line) || (/fuentes/i.test(line) && line.length < 50)) continue;

      // Extract markdown links [Title](URL) or plain URL
      const linkMatch = line.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
      const urlMatch = line.match(/(https?:\/\/[^\s)]+)/);

      if (linkMatch) {
        const nombre = linkMatch[1].replace(/[*_#]/g, '').trim();
        const url = linkMatch[2].trim();
        let descripcion = '';

        const after = line.split(linkMatch[0])[1]?.replace(/^[\s—–:-]+/, '').trim();
        if (after) descripcion = after;

        let dominio = '';
        try {
          dominio = new URL(url).hostname;
        } catch {}

        parsedFuentes.push({ nombre, url, descripcion, dominio });
      } else if (urlMatch) {
        const url = urlMatch[1].trim();
        const before = line
          .split(url)[0]
          .replace(/^[-*•\s]+/, '')
          .replace(/[*_#]/g, '')
          .replace(/[:—–\s]+$/, '')
          .trim();
        const after = line.split(url)[1]?.replace(/^[\s—–:-]+/, '').trim() || '';

        let dominio = '';
        try {
          dominio = new URL(url).hostname;
        } catch {}

        parsedFuentes.push({
          nombre: before || dominio || 'Portal Universitario',
          url,
          descripcion: after,
          dominio,
        });
      }
    }

    result.fuentesList = parsedFuentes.length > 0 ? parsedFuentes : defaultFuentes;
  } else {
    result.fuentesList = defaultFuentes;
  }

  return result;
}
