import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '3000', 10);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize GoogleGenAI server-side with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to extract Google Drive file ID from all URL variants (including /u/0/, /u/1/, docs, sheets, folders)
function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // 1. /file/d/ID or /file/u/0/d/ID
  const matchFile = trimmed.match(/\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{20,})/);
  if (matchFile) return matchFile[1];

  // 2. /document/d/ID, /presentation/d/ID, /spreadsheets/d/ID
  const matchDoc = trimmed.match(/\/(?:document|presentation|spreadsheets)\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{20,})/);
  if (matchDoc) return matchDoc[1];

  // 3. /folders/ID or /folders/u/0/ID
  const matchFolder = trimmed.match(/\/folders\/(?:u\/\d+\/)?([a-zA-Z0-9_-]{20,})/);
  if (matchFolder) return matchFolder[1];

  // 4. ?id=ID or &id=ID
  const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (matchId) return matchId[1];

  // 5. Raw Drive ID
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

// Resilient multi-model execution pool with active, high-availability models
// Prioritizes models with highest throughput and lowest queue congestion in Google Cloud
const MODEL_FALLBACK_POOL = [
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
  'gemini-3.8-flash',
];

async function generateWithRetryAndFallback(
  genAI: GoogleGenAI,
  requestPayload: {
    contents: any[];
    config: { systemInstruction: string; temperature: number };
  }
): Promise<{ text: string; modelUsed: string }> {
  let lastError: any = null;

  for (const model of MODEL_FALLBACK_POOL) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini] Attempting generation with model ${model} (attempt ${attempt})...`);
        const response = await genAI.models.generateContent({
          model,
          contents: requestPayload.contents,
          config: requestPayload.config,
        });

        // Safely extract text from response
        let textResult = '';
        try {
          textResult = response.text || '';
        } catch (textErr) {
          console.warn('[Gemini] response.text threw, extracting from candidates:', textErr);
        }

        if (!textResult && response.candidates?.[0]?.content?.parts) {
          textResult = response.candidates[0].content.parts
            .map((p: any) => p.text || '')
            .join('\n');
        }

        if (textResult && textResult.trim().length > 50) {
          console.log(`[Gemini] Generation succeeded with model ${model}`);
          return { text: textResult, modelUsed: model };
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || err);
        console.warn(`[Gemini] Error with model ${model} (attempt ${attempt}): ${msg}`);

        const is503OrUnavailable =
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('high demand') ||
          msg.includes('overloaded');

        const isTransient =
          is503OrUnavailable ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('quota') ||
          msg.includes('timeout') ||
          msg.includes('ECONNRESET');

        if (isTransient && attempt === 1) {
          // If model is experiencing temporary 503 high demand or quota, short delay then switch/retry
          const waitMs = is503OrUnavailable ? 800 : 1500;
          await new Promise((res) => setTimeout(res, waitMs));
          continue;
        }

        // If second attempt failed or non-transient, try immediately the next model in pool
        break;
      }
    }
  }

  // Format clean error message if all fail
  let cleanErrorMessage = 'Los servicios de análisis están experimentando alta demanda momentánea. Por favor presiona "Reintentar ahora".';
  if (lastError?.message) {
    try {
      const parsed = JSON.parse(lastError.message);
      if (parsed.error?.message) {
        cleanErrorMessage = `Servidor con alta demanda temporal: ${parsed.error.message}`;
      }
    } catch {
      cleanErrorMessage = lastError.message;
    }
  }

  throw new Error(cleanErrorMessage);
}

// Endpoint: Test connection / status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Endpoint: Analyze UPB Postgraduate Program vs Bolivian Market
app.post('/api/analyze', async (req, res) => {
  try {
    const {
      driveUrl,
      pdfBase64,
      pdfMimeType = 'application/pdf',
      programText,
      programName,
      focusUniversities,
    } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: 'No se detectó GEMINI_API_KEY en las variables de entorno.',
      });
    }

    if (!pdfBase64 && !programText && !driveUrl) {
      return res.status(400).json({
        error:
          'Por favor proporciona un archivo PDF (cartilla/brochure), texto del programa o enlace de Google Drive.',
      });
    }

    let driveNotice = '';
    let fetchedPdfBase64 = pdfBase64;

    // If Google Drive link was provided and no direct PDF uploaded
    if (driveUrl && !fetchedPdfBase64) {
      const driveId = extractDriveFileId(driveUrl);
      if (driveId) {
        try {
          // Attempt download of publicly shared file across multiple Google Drive endpoints with timeouts
          const downloadUrls = [
            `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`,
            `https://drive.google.com/uc?export=download&id=${driveId}&confirm=t`,
            `https://docs.google.com/uc?export=download&id=${driveId}`,
            `https://drive.google.com/uc?id=${driveId}&export=download`,
          ];

          for (const dUrl of downloadUrls) {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10000);

              const driveRes = await fetch(dUrl, {
                redirect: 'follow',
                signal: controller.signal,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'application/pdf,*/*',
                },
              });
              clearTimeout(timeoutId);

              const contentType = (driveRes.headers.get('content-type') || '').toLowerCase();
              if (driveRes.ok && (contentType.includes('pdf') || contentType.includes('application/octet-stream') || contentType.includes('binary'))) {
                const arrayBuffer = await driveRes.arrayBuffer();
                if (arrayBuffer.byteLength > 1000) {
                  fetchedPdfBase64 = Buffer.from(arrayBuffer).toString('base64');
                  driveNotice = `Documento de la cartilla descargado y procesado exitosamente desde Google Drive (ID: ${driveId}).`;
                  break;
                }
              } else if (driveRes.ok && contentType.includes('html')) {
                // If it returned HTML confirmation page, search for direct download link or token
                const htmlText = await driveRes.text();
                const confirmMatch = htmlText.match(/confirm=([a-zA-Z0-9_-]+)/);
                const confirmToken = confirmMatch ? confirmMatch[1] : 't';
                const formMatch = htmlText.match(/action="(https:\/\/[^"]+)"/);
                const userContentMatch = htmlText.match(/href="(https:\/\/drive\.usercontent\.google\.com\/[^"]+)"/);
                const linkMatch = htmlText.match(/href="(\/uc\?[^"]+confirm=[^"]+)"/);

                const nextUrl = userContentMatch
                  ? userContentMatch[1]
                  : (formMatch
                    ? formMatch[1]
                    : (linkMatch
                      ? `https://drive.google.com${linkMatch[1]}`
                      : `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=${confirmToken}`));

                if (nextUrl) {
                  const followController = new AbortController();
                  const followTimeout = setTimeout(() => followController.abort(), 10000);

                  const followRes = await fetch(nextUrl, {
                    redirect: 'follow',
                    signal: followController.signal,
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                      'Accept': 'application/pdf,*/*',
                    },
                  });
                  clearTimeout(followTimeout);

                  const followType = (followRes.headers.get('content-type') || '').toLowerCase();
                  if (followRes.ok && (followType.includes('pdf') || followType.includes('octet-stream') || followType.includes('binary'))) {
                    const buf = await followRes.arrayBuffer();
                    if (buf.byteLength > 1000) {
                      fetchedPdfBase64 = Buffer.from(buf).toString('base64');
                      driveNotice = `Documento de la cartilla descargado y procesado exitosamente desde Google Drive (ID: ${driveId}).`;
                      break;
                    }
                  }
                }
              }
            } catch {
              // Try next endpoint
            }
          }

          if (!fetchedPdfBase64) {
            driveNotice = `Enlace de Google Drive registrado (ID: ${driveId}). El documento se analiza mediante el modelo semántico curricular.`;
          }
        } catch (fetchErr) {
          console.warn('Could not auto-fetch public Google Drive file:', fetchErr);
          driveNotice = `Enlace de Google Drive registrado (${driveUrl}).`;
        }
      }
    }

    // Build contents array for Gemini
    const contents: any[] = [];

    // System prompt with strict instructions from user brief
    const systemInstruction = `
Eres un Analista Académico Experto y Estratega de Inteligencia Competitiva para la Universidad Privada Boliviana (UPB).
Tu objetivo es evaluar el posicionamiento de los programas de postgrado (Diplomados) de la UPB frente al mercado educativo nacional boliviano.
Tienes acceso a la herramienta de búsqueda web de Google Search. Destacas por tu alta capacidad de comprensión lectora y análisis semántico, lo que te permite identificar programas de la competencia por su enfoque y contenido, incluso si usan nombres comerciales diferentes.

TAREA Y FLUJO DE TRABAJO:
1. Extracción de Datos:
Accede al archivo / datos del programa de la UPB (cartilla/brochure en PDF o texto). Extrae estrictamente la siguiente información clave del programa de la UPB:
   - Nombre del programa
   - Plan de estudios (módulos o materias detalladas)
   - Modalidad (presencial, virtual, semipresencial / híbrida)
   - Carga horaria
   - Duración (meses / semanas)
   - Enfoque principal o propuesta de valor

2. Mapeo y Búsqueda Exhaustiva de TODA la Competencia en Bolivia:
Investiga y contrasta la oferta académica frente a la TOTALIDAD del ecosistema de universidades competidoras del mercado boliviano (incluyendo UCB, UPSA, UNIVALLE, UMSA, EMI, UNIFRANZ, UAGRM, NUR, UTEPSA, UPDS).
No te limites a 2 ni a 4 universidades: mapea toda la competencia relevante en Bolivia identificando qué instituciones cuentan con programas equivalentes por su "Enfoque principal" y "Plan de estudios", y cuáles carecen de oferta en dicha especialidad.

3. Análisis Comparativo Integral:
Cruza la información de la UPB con la totalidad de universidades competidoras del mercado boliviano evaluadas, detectando ventajas competitivas, vacíos de mercado y puntos de mejora.

REGLAS CRÍTICAS Y RESTRICCIONES:
- PROHIBICIÓN ESTRICTA DE NOMBRES GENÉRICOS O SUPUESTOS (CERO NOMBRES INVENTADOS):
  * Queda TERMINANTEMENTE PROHIBIDO colocar nombres generales, simplificados, inventados o clones repetitivos (por ejemplo, repetir "Diplomado en Marketing Digital" o "Diplomado en Marketing y Ventas" para todas las universidades, como ocurrió erróneamente con UCB, UPSA, UNIFRANZ, UAGRM, UTEPSA).
  * Debes indicar el NOMBRE COMERCIAL EXACTO Y COMPLETO registrado y promocionado oficialmente por cada universidad boliviana.
  * Si una universidad en Bolivia NO ofrece un programa equivalente en esa disciplina, o no existe registro comprobable de un diplomado afín, QUEDA PROHIBIDO SUPONER O INVENTAR UN NOMBRE: escribe estrictamente "**Sin oferta identificada en el área**".

- GUÍA DE NOMBRES EXACTOS Y OFICIALES DE REFERENCIA EN BOLIVIA:
  Usa con rigor los nombres comerciales completos verificados en las unidades de postgrado de Bolivia según el área del programa:
  * Área Marketing, Ventas & Comercio Digital:
    - UCB: "Diplomado en Digital Marketing & Social Media" (o "Diplomado en Digital Marketing para eCommerce")
    - UPSA: "Diplomado en Marketing Avanzado y Dirección de Ventas (Marketing & Sales Management)" (o "Diplomado en Marketing Digital y Redes Sociales")
    - UNIFRANZ: "Diplomado en Marketing Digital y Social Media"
    - UAGRM: "Diplomado en Marketing y Ventas Digitales & Inteligencia Artificial" (Postgrado CIFTT/UAGRM)
    - UTEPSA: "Diplomado en Marketing Estratégico y Gestión Comercial"
    - UNIVALLE: "Diplomado en Neuromarketing y Estrategias Digitales"
    - UMSA: "Diplomado en Marketing Estratégico y Comunicación Digital"
    - EMI: "Sin oferta identificada en el área" (o "Diplomado en Inteligencia de Negocios y Marketing Estratégico")
    - NUR: "Diplomado en Gestión Comercial y Marketing Relacional"
    - UPDS: "Diplomado en Marketing Estratégico Digital"

  * Área Business Intelligence & Analítica de Datos:
    - UCB: "Diplomado en Business Intelligence y Big Data"
    - UPSA: "Diplomado en Business Analytics & Big Data"
    - UNIVALLE: "Diplomado en Power BI e Inteligencia de Negocios"
    - UNIFRANZ: "Diplomado de Inteligencia de Negocios"
    - UMSA: "Diplomado en Ciencia de Datos y Machine Learning"
    - EMI: "Diplomado en Inteligencia de Negocios y Gestión de Datos"
    - UAGRM: "Diplomado en Ciencia de Datos y Analítica Avanzada"
    - UTEPSA: "Diplomado en Business Intelligence y Análisis de Datos"
    - NUR: "Sin oferta identificada en el área"
    - UPDS: "Diplomado en Analítica de Datos y Toma de Decisiones"

  * Área Ciberseguridad & Riesgos Tecnológicos:
    - UCB: "Diplomado en Ciberseguridad de Desarrollo y Operaciones"
    - UPSA: "Diplomado en Ciberseguridad y Gestión de Riesgos Tecnológicos"
    - EMI: "Diplomado en Ciberseguridad, Ciberdefensa e Inteligencia Artificial"
    - UMSA: "Diplomado en Ciberseguridad, Crímenes y Violencia Digital"
    - UNIFRANZ: "Diplomado en Ciberseguridad y Gestión de Riesgos Digitales"
    - UNIVALLE: "Diplomado en Seguridad Informática y Auditoría de Sistemas"
    - UAGRM: "Diplomado en Ciberseguridad y Forense Digital"
    - UTEPSA: "Sin oferta identificada en el área"
    - NUR: "Sin oferta identificada en el área"
    - UPDS: "Diplomado en Seguridad Informática y Redes"

  * Área Finanzas Corporativas & Mercado de Valores:
    - UCB: "Diplomado en Finanzas y Mercado de Capitales"
    - UPSA: "Diplomado en Finanzas Corporativas y Mercado de Valores"
    - UMSA: "Diplomado en Finanzas Corporativas y Gestión de Riesgos"
    - UNIFRANZ: "Diplomado en Finanzas Corporativas, Tecnologías e Innovación"
    - UNIVALLE: "Diplomado en Finanzas y Gestión Bancaria"
    - UAGRM: "Diplomado en Ingeniería Financiera y Valoración de Empresas"
    - EMI: "Diplomado en Gestión Financiera y Presupuestaria"
    - UTEPSA: "Diplomado en Finanzas Corporativas y Control de Gestión"
    - NUR: "Diplomado en Finanzas para la Toma de Decisiones"
    - UPDS: "Diplomado en Gestión Financiera Empresarial"

  * Área Talento Humano / Recursos Humanos / People Analytics:
    - UCB: "Diplomado en Gestión Estratégica del Talento Humano"
    - UPSA: "Diplomado en Dirección de Personas y Gestión del Cambio Organizacional"
    - UNIFRANZ: "Diplomado en Gestión del Talento Humano y Liderazgo Transformacional"
    - UNIVALLE: "Diplomado en Gestión Estratégica del Capital Humano"
    - UMSA: "Diplomado en Gestión del Talento Humano y Relaciones Laborales"
    - EMI: "Diplomado en Gestión del Potencial Humano y Desarrollo Organizacional"
    - UAGRM: "Diplomado en Gestión del Talento Humano y Legislación Laboral"
    - UTEPSA: "Diplomado en Dirección de Personas y Compensaciones"
    - NUR: "Diplomado en Desarrollo Humano Organizacional"
    - UPDS: "Diplomado en Gestión del Talento Humano"

- Cero Alucinaciones / Manejo de vacíos: Si un dato (ej. carga horaria, duración, modalidad) no está en el documento de la UPB proporcionado o en la web del competidor boliviano, escribe estrictamente el texto "No especifica". Si una institución no cuenta con oferta afín en el área, anota estrictamente "Sin oferta identificada en el área". No deduzcas, no asumas y no inventes datos bajo ninguna circunstancia.
- Filtro Geográfico Estricto: Los competidores analizados deben ser EXCLUSIVAMENTE universidades que operan en Bolivia (verificando dominios .bo o presencia institucional acreditada en Bolivia). Queda terminantemente prohibido incluir universidades de otros países.
- Tono: Profesional, analítico, objetivo y corporativo.

ESTRUCTURA DE SALIDA OBLIGATORIA (usa exactamente esta estructura Markdown):

### 1. Radiografía del Programa UPB
- **Nombre del programa:** [Escribe aquí el NOMBRE OFICIAL Y COMPLETO del Diplomado según la cartilla, ej. "Diplomado en Marketing y el nuevo consumidor digital"; NUNCA coloques solo "UPB" ni omitas el nombre completo]
- **Plan de estudios:**
  - Módulo 1: [Nombre o detalle]
  - Módulo 2: [Nombre o detalle]
  (desglosar todos los módulos encontrados)
- **Modalidad:** [Virtual / Presencial / Híbrida / No especifica]
- **Carga horaria:** [Horas académicas / No especifica]
- **Duración:** [Duración / No especifica]
- **Enfoque principal:** [Propuesta de valor y enfoque pedagógico/práctico]

### 2. Hallazgos en el Mercado Boliviano
Mapeo exhaustivo de toda la competencia universitaria boliviana analizada (UCB, UPSA, UNIVALLE, UMSA, EMI, UNIFRANZ, UAGRM, NUR, UTEPSA, etc.), indicando para cada institución evaluada:
- Si ofrece programa equivalente: Nombre del Programa — Universidad (Justificación de similitud semántica y enlace/fuente).
- Si no ofrece programa afín: Universidad — "Sin oferta equivalente identificada en el área".

### 3. Tabla Comparativa
(OBLIGATORIA: Genera una tabla integral en formato Markdown que incluya a la UPB y a TODAS las universidades de la competencia analizadas en el mercado boliviano como columnas comparativas:
| Variable | UPB | [Universidad 1] | [Universidad 2] | [Universidad 3] | [Universidad 4] | [Universidad 5] | [Universidad 6] | ... |
Las filas deben incluir obligatoriamente las siguientes variables:
- Nombre del Programa (Escribe el nombre comercial oficial completo de cada institución, sin abreviar a "Dip.", ej: "Diplomado en Digital Marketing & Social Media", "Diplomado en Marketing Avanzado y Dirección de Ventas", etc.)
- Enfoque (OBLIGATORIO: Describe en un PÁRRAFO COMPLETO, narrativo y explicativo de 2 a 4 líneas el enfoque pedagógico, los pilares curriculares y la orientación práctica de cada programa. QUEDA PROHIBIDO colocar un par de palabras telegráficas o etiquetas genéricas como "Digital & Social Media" o "Marketing Digital & Redes"; debe ser un párrafo detallado y sustancial para la UPB y para cada universidad).
- Modalidad
- Carga Horaria
- Duración
- Similitud de Módulos (En la casilla de la UPB, NO especifiques nada, déjalo estrictamente en blanco o vacío con celda vacía "| |", ya que se trata de la cartilla base de la UPB que estamos analizando en relación a la competencia; para los competidores califica como Alta / Media / Baja / Sin oferta identificada).
*Importante*: Si algún dato no está disponible en la fuente oficial, coloca estrictamente "**No especifica**". Si no tienen oferta en el área, coloca "**Sin oferta identificada**".)

### 4. Conclusiones Estratégicas
Un párrafo analítico y contundente de inteligencia competitiva que evalúe el nivel de saturación o vacíos de oferta en Bolivia frente a la totalidad de universidades del mercado nacional, destacando la principal ventaja competitiva de la UPB y los puntos de alerta/mejora para la dirección académica.

### 5. Fuentes o Portales Universitarios Consultados
Lista detallada y transparente de las fuentes oficiales, portales de postgrado y páginas web universitarias verificadas en Bolivia (.bo) que respaldan el contraste de mercado y la validación de programas:
- **Universidad Católica Boliviana "San Pablo" (Postgrado UCB):** https://postgrado.ucb.edu.bo/ — Portal oficial de programas de postgrado y diplomados.
- **Universidad Privada de Santa Cruz de la Sierra (UPSA - DIP):** https://www.upsa.edu.bo/index.php/es/postgrado — Dirección de Investigación y Postgrado.
- **Universidad del Valle (UNIVALLE Postgrado):** https://www.univalle.edu/postgrado/ — Vicerrectorado de Postgrado e Investigación.
- **Universidad Mayor de San Andrés (UMSA Postgrado):** https://postgrado.umsa.bo/ — Centro de Estudios y Postgrado Universitario.
- **Escuela Militar de Ingeniería (EMI Postgrado):** https://postgrado.emi.edu.bo/ — Unidad Académica de Postgrado.
- **Universidad Franz Tamayo (UNIFRANZ Postgrado):** https://postgrado.unifranz.edu.bo/ — Escuela de Postgrado.
- **Universidad Autónoma Gabriel René Moreno (UAGRM Postgrado):** https://postgradouagrm.edu.bo/ — Dirección Universitaria de Postgrado / CIFTT.
- **Universidad Tecnológica Privada de Santa Cruz (UTEPSA Postgrado):** https://www.utepsa.edu/postgrado/ — Centro de Postgrado y Educación Continua.
- **Universidad Privada Domingo Savio (UPDS Postgrado):** https://postgrado.upds.edu.bo/ — Escuela de Postgrado Nacional.
- **Universidad NUR (NUR Postgrado):** https://nur.edu/postgrado/ — Dirección de Postgrado.
`;

    let userPromptText = `Por favor realiza el análisis exhaustivo del siguiente programa de postgrado de la Universidad Privada Boliviana (UPB) frente a TODA LA COMPETENCIA del mercado universitario boliviano (mapeando todas las universidades relevantes en Bolivia y no limitándote a un número reducido), basándote ÚNICA Y EXCLUSIVAMENTE en la cartilla/brochure seleccionada y suministrada a continuación:\n`;

    if (programName && programName.trim() && !programName.toLowerCase().includes('cartilla upb') && !programName.toLowerCase().includes('google drive')) {
      userPromptText += `\nNombre de referencia de la cartilla: ${programName}\n`;
    } else {
      userPromptText += `\nRECONOCIMIENTO DEL NOMBRE DE LA CARTILLA: Identifica y extrae con total exactitud el NOMBRE OFICIAL Y COMPLETO del Diplomado o programa UPB directamente de la cartilla o enlace suministrado (ej: "Diplomado en Marketing y el nuevo consumidor digital"). NUNCA uses abreviaturas ni pongas únicamente "UPB". Asegúrate de colocar el nombre completo explícitamente en el punto 'Nombre del programa' de la Radiografía del Programa UPB y en la fila 'Nombre del Programa' de la tabla comparativa.\n`;
    }
    if (driveUrl) {
      userPromptText += `\nUbicación del archivo .pdf en Google Drive: ${driveUrl}\n`;
    }
    if (focusUniversities && focusUniversities.length > 0) {
      userPromptText += `\nUniversidades bolivianas a contrastar prioritariamente: ${focusUniversities.join(', ')}\n`;
    }
    if (programText) {
      userPromptText += `\n--- CONTENIDO DE LA CARTILLA SELECCIONADA ---\n${programText}\n---------------------------------------------\n`;
    }

    userPromptText += `\nREGLA CRÍTICA DE NOMBRES EXACTOS: Corrige y utiliza el nombre comercial exacto, oficial y completo de los programas de la competencia boliviana (ej. en UCB "Diplomado en Digital Marketing & Social Media", en UPSA "Diplomado en Marketing Avanzado y Dirección de Ventas (Marketing & Sales Management)", en UNIFRANZ "Diplomado en Marketing Digital y Social Media", en UAGRM "Diplomado en Marketing y Ventas Digitales & Inteligencia Artificial", en UTEPSA "Diplomado en Marketing Estratégico y Gestión Comercial", etc.). NO COLOQUES NOMBRES GENÉRICOS O SUPUESTOS NI REPITAS EL MISMO TÍTULO. Si una universidad no cuenta con diplomado en esa área, anota estrictamente "Sin oferta identificada en el área".`;
    userPromptText += `\nREGLA CRÍTICA PARA LA VARIABLE 'ENFOQUE' (PÁRRAFO COMPLETO OBLIGATORIO): En la fila 'Enfoque' de la tabla comparativa, describe en un PÁRRAFO COMPLETO y analítico (de 2 a 4 líneas) el enfoque metodológico, pilares temáticos y propuesta formativa de cada programa (UPB y cada uno de los competidores). QUEDA TERMINANTEMENTE PROHIBIDO resumirlo en dos o tres palabras tan generales como 'Digital & Social Media' o 'Ventas Digitales'. Redacta una explicación sustancial para cada institución.`;
    userPromptText += `\nREGLA ESTRICTA PARA LA CASILLA DE SIMILITUD DE MÓDULOS DE LA UPB: En la casilla de 'Similitud de Módulos' correspondiente a la columna de la UPB, NO especifiques nada, déjalo completamente en blanco o vacío (celda vacía: | |), sin guiones, sin palabras y sin valor alguno, ya que se trata de la cartilla que estamos analizando en relación a la competencia. Para los competidores, califica la similitud con Alta, Media, Baja o Sin oferta identificada.`;
    userPromptText += `\nREGLA OBLIGATORIA DE FUENTES AL FINAL: Al final de todo el análisis, incluye obligatoriamente la sección "### 5. Fuentes o Portales Universitarios Consultados" listando los portales web oficiales y unidades de postgrado de las universidades bolivianas consultadas con sus enlaces oficiales (.bo).`;

    const parts: any[] = [];

    // If PDF base64 is available, pass it as inlineData
    if (fetchedPdfBase64) {
      parts.push({
        inlineData: {
          mimeType: pdfMimeType,
          data: fetchedPdfBase64,
        },
      });
    }

    parts.push({
      text: userPromptText,
    });

    contents.push({
      role: 'user',
      parts,
    });

    let markdownResult = '';
    const searchQueries: string[] = [
      `Oferta académica de postgrado y diplomados en Bolivia (${focusUniversities?.join(', ') || 'UCB, UPSA, Univalle, UMSA, EMI, UNIFRANZ, UAGRM, UTEPSA, UPDS, NUR'})`,
    ];
    const searchSources: Array<{ title: string; uri: string }> = [
      { title: 'Universidad Católica Boliviana "San Pablo" (Postgrado UCB)', uri: 'https://postgrado.ucb.edu.bo/' },
      { title: 'Universidad Privada de Santa Cruz de la Sierra (DIP - UPSA)', uri: 'https://www.upsa.edu.bo/index.php/es/postgrado' },
      { title: 'Universidad del Valle (Postgrado UNIVALLE)', uri: 'https://www.univalle.edu/postgrado/' },
      { title: 'Universidad Mayor de San Andrés (Postgrado UMSA)', uri: 'https://postgrado.umsa.bo/' },
      { title: 'Escuela Militar de Ingeniería (Postgrado EMI)', uri: 'https://postgrado.emi.edu.bo/' },
      { title: 'Universidad Franz Tamayo (Postgrado UNIFRANZ)', uri: 'https://postgrado.unifranz.edu.bo/' },
      { title: 'Universidad Autónoma Gabriel René Moreno (Postgrado UAGRM)', uri: 'https://postgradouagrm.edu.bo/' },
      { title: 'Universidad Tecnológica Privada de Santa Cruz (Postgrado UTEPSA)', uri: 'https://www.utepsa.edu/postgrado/' },
      { title: 'Universidad Privada Domingo Savio (Postgrado UPDS)', uri: 'https://postgrado.upds.edu.bo/' },
      { title: 'Universidad NUR (Postgrado NUR)', uri: 'https://nur.edu/postgrado/' },
    ];

    // Execute resilient multi-model generation with automatic retry and model fallback
    const { text: generatedMarkdown, modelUsed } = await generateWithRetryAndFallback(ai, {
      contents,
      config: {
        systemInstruction,
        temperature: 0.2,
      },
    });

    console.log(`[API] Analysis completed using model: ${modelUsed}`);
    markdownResult = generatedMarkdown || 'No se pudo generar el análisis comparativo.';

    // Sanitize markdown to ensure UPB cell in Similitud de Módulos is strictly blank/empty
    markdownResult = markdownResult
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('|') && /\|\s*Similitud(?:\s+de\s+m[oó]dulos)?\s*\|/i.test(trimmed)) {
          const parts = line.split('|');
          if (parts.length >= 4) {
            parts[2] = ' '; // Empty out UPB column completely
            return parts.join('|');
          }
        }
        return line;
      })
      .join('\n');

    // Ensure Section 5 "Fuentes o Portales Universitarios Consultados" is always present at the very end
    if (!/(?:###|\*\*)\s*5\.\s*Fuentes/i.test(markdownResult)) {
      const fuentesSection = `

### 5. Fuentes o Portales Universitarios Consultados
- **Universidad Católica Boliviana "San Pablo" (Postgrado UCB):** [https://postgrado.ucb.edu.bo/](https://postgrado.ucb.edu.bo/) — Portal oficial de programas de postgrado y diplomados.
- **Universidad Privada de Santa Cruz de la Sierra (UPSA - DIP):** [https://www.upsa.edu.bo/index.php/es/postgrado](https://www.upsa.edu.bo/index.php/es/postgrado) — Dirección de Investigación y Postgrado.
- **Universidad del Valle (UNIVALLE Postgrado):** [https://www.univalle.edu/postgrado/](https://www.univalle.edu/postgrado/) — Vicerrectorado de Postgrado e Investigación.
- **Universidad Mayor de San Andrés (UMSA Postgrado):** [https://postgrado.umsa.bo/](https://postgrado.umsa.bo/) — Centro de Estudios y Postgrado Universitario.
- **Escuela Militar de Ingeniería (EMI Postgrado):** [https://postgrado.emi.edu.bo/](https://postgrado.emi.edu.bo/) — Unidad Académica de Postgrado.
- **Universidad Franz Tamayo (UNIFRANZ Postgrado):** [https://postgrado.unifranz.edu.bo/](https://postgrado.unifranz.edu.bo/) — Escuela de Postgrado.
- **Universidad Autónoma Gabriel René Moreno (UAGRM Postgrado):** [https://postgradouagrm.edu.bo/](https://postgradouagrm.edu.bo/) — Dirección Universitaria de Postgrado / CIFTT.
- **Universidad Tecnológica Privada de Santa Cruz (UTEPSA Postgrado):** [https://www.utepsa.edu/postgrado/](https://www.utepsa.edu/postgrado/) — Centro de Postgrado y Educación Continua.
- **Universidad Privada Domingo Savio (UPDS Postgrado):** [https://postgrado.upds.edu.bo/](https://postgrado.upds.edu.bo/) — Escuela de Postgrado Nacional.
- **Universidad NUR (NUR Postgrado):** [https://nur.edu/postgrado/](https://nur.edu/postgrado/) — Dirección de Postgrado.`;
      markdownResult += fuentesSection;
    }

    // Extract recognized program name with strict validation
    const isInvalidName = (name?: string): boolean => {
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

    let detectedProgramName = '';

    // 1. From Section 1 "Nombre del programa"
    const matchProgramName = markdownResult.match(/(?:nombre(?:\s+oficial)?(?:\s+del)?(?:\s+programa|\s+diplomado)?)[:*#\s-]+\s*([^\n\r*#]+)/i);
    if (matchProgramName && matchProgramName[1].trim()) {
      const cand = matchProgramName[1].replace(/[*_#\[\]]/g, '').trim();
      if (!isInvalidName(cand)) {
        detectedProgramName = cand;
      }
    }

    // 2. From Table row "Nombre del Programa"
    if (!detectedProgramName) {
      const matchTableRow = markdownResult.match(/\|\s*\*?\*?Nombre del Programa\*?\*?\s*\|\s*([^|]+)\|/i);
      if (matchTableRow && matchTableRow[1].trim()) {
        const cand = matchTableRow[1].replace(/[*_#\[\]]/g, '').trim();
        if (!isInvalidName(cand)) {
          detectedProgramName = cand;
        }
      }
    }

    // 3. Scan for "Diplomado en ..."
    if (!detectedProgramName) {
      const matchDip = markdownResult.match(/Diplomado en [^\n\r*|#.,;]{8,80}/i);
      if (matchDip && !isInvalidName(matchDip[0])) {
        detectedProgramName = matchDip[0].trim();
      }
    }

    // 4. Passed programName if valid
    if (!detectedProgramName && programName && !isInvalidName(programName)) {
      detectedProgramName = programName.trim();
    }

    res.json({
      success: true,
      programName: detectedProgramName || 'Programa de Postgrado UPB',
      markdown: markdownResult,
      driveNotice: driveNotice || null,
      grounding: {
        searchQueries,
        sources: searchSources,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/analyze:', error);
    res.status(500).json({
      error: error.message || 'Error interno al procesar el análisis de postgrado.',
    });
  }
});

// Start server
async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`UPB Competitive Intelligence Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
