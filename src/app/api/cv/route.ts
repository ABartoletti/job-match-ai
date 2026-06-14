import { NextResponse } from "next/server";
import mammoth from "mammoth";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";

const rolePatterns: Array<[RegExp, string]> = [
  [/data analyst|business intelligence|bi analyst/i, "Data Analyst"],
  [/data engineer|analytics engineer/i, "Data Engineer"],
  [/qa automation|automation qa|sdet/i, "QA Automation"],
  [/quality assurance|qa analyst|tester/i, "QA Analyst"],
  [/frontend|front end|react/i, "Frontend Developer"],
  [/backend|back end|node/i, "Backend Developer"],
  [/full stack|fullstack/i, "Full Stack Developer"],
  [/product manager|product owner/i, "Product Manager"],
  [/project manager|scrum master/i, "Project Manager"],
  [/ux designer|ui designer|product designer/i, "UX/UI Designer"],
  [/devops|site reliability|sre/i, "DevOps Engineer"],
  [/data scientist|machine learning|ml engineer/i, "Data Scientist"],
];

const locationPatterns: Array<[RegExp, string]> = [
  [/buenos aires|caba/i, "Buenos Aires, Argentina"],
  [/argentina/i, "Argentina"],
  [/latam|latinoamérica|latin america/i, "LatAm"],
  [/mexico|cdmx/i, "México"],
  [/chile/i, "Chile"],
  [/colombia/i, "Colombia"],
  [/remote|remoto/i, "Remoto"],
];

const seniorityPatterns: Array<[RegExp, string]> = [
  [/trainee|intern|practicante/i, "Trainee"],
  [/junior|jr\.?/i, "Junior"],
  [/semi senior|semi-senior|ssr\.?/i, "Semi Senior"],
  [/senior|sr\.?/i, "Senior"],
  [/lead|principal|staff/i, "Lead"],
];

const workModePatterns: Array<[RegExp, string]> = [
  [/remote|remoto/i, "Remoto"],
  [/hybrid|hibrido|híbrido/i, "Hibrido"],
  [/onsite|presencial/i, "Presencial"],
];

const languagePatterns: Array<[RegExp, string]> = [
  [/(english|ingl[eé]s)[^.;,\n]{0,40}(advanced|avanzado|c1|c2|bilingual|biling[uü]e)|(advanced|avanzado|c1|c2|bilingual|biling[uü]e)[^.;,\n]{0,40}(english|ingl[eé]s)/i, "Inglés avanzado"],
  [/(english|ingl[eé]s)[^.;,\n]{0,40}(intermediate|intermedio|b1|b2)|(intermediate|intermedio|b1|b2)[^.;,\n]{0,40}(english|ingl[eé]s)/i, "Inglés intermedio"],
  [/(english|ingl[eé]s)[^.;,\n]{0,40}(basic|b[aá]sico|a1|a2)|(basic|b[aá]sico|a1|a2)[^.;,\n]{0,40}(english|ingl[eé]s)/i, "Inglés básico"],
  [/(portuguese|portugu[eé]s)[^.;,\n]{0,40}(advanced|avanzado|c1|c2|bilingual|biling[uü]e)|(advanced|avanzado|c1|c2|bilingual|biling[uü]e)[^.;,\n]{0,40}(portuguese|portugu[eé]s)/i, "Portugués avanzado"],
  [/(portuguese|portugu[eé]s)[^.;,\n]{0,40}(intermediate|intermedio|b1|b2)|(intermediate|intermedio|b1|b2)[^.;,\n]{0,40}(portuguese|portugu[eé]s)/i, "Portugués intermedio"],
  [/(portuguese|portugu[eé]s)[^.;,\n]{0,40}(basic|b[aá]sico|a1|a2)|(basic|b[aá]sico|a1|a2)[^.;,\n]{0,40}(portuguese|portugu[eé]s)/i, "Portugués básico"],
];

const skillDictionary = [
  "SQL",
  "Power BI",
  "Excel",
  "Python",
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Docker",
  "AWS",
  "Figma",
  "Tableau",
  "Looker",
  "Selenium",
  "Cypress",
  "Playwright",
  "Jira",
  "Scrum",
  "Git",
  "GitHub",
  "REST",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Azure",
  "GCP",
  "Kubernetes",
  "HTML",
  "CSS",
  "Tailwind",
  "Next.js",
];

type CvProfile = {
  role: string;
  location: string;
  workMode: string;
  seniority: string;
  skills: string;
  language: string;
};

type CvAnalysisResult = {
  profile: CvProfile;
  source: "openai" | "heuristic";
};

function extractValue(patterns: Array<[RegExp, string]>, text: string, fallback: string) {
  const match = patterns.find(([pattern]) => pattern.test(text));
  return match ? match[1] : fallback;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSkills(text: string) {
  const matches = skillDictionary.filter((skill) => {
    const pattern = new RegExp(`\\b${escapeRegExp(skill)}\\b`, "i");
    return pattern.test(text);
  });

  if (matches.length > 0) {
    return matches.join(", ");
  }

  return "";
}

function parseCvText(text: string): CvProfile {
  const normalizedText = text.replace(/\s+/g, " ");

  return {
    role: extractValue(rolePatterns, normalizedText, ""),
    location: extractValue(locationPatterns, normalizedText, ""),
    workMode: extractValue(workModePatterns, normalizedText, "Cualquiera"),
    seniority: extractValue(seniorityPatterns, normalizedText, ""),
    skills: extractSkills(normalizedText),
    language: extractValue(languagePatterns, normalizedText, "No especificado"),
  };
}

function clampText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength);
}

function decodePdfString(value: string) {
  return value
    .replace(/\\\\/g, "\\")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\r/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\\([0-7]{1,3})/g, (_, octal: string) => String.fromCharCode(Number.parseInt(octal, 8)));
}

function decodePdfHex(value: string) {
  if (value.length % 2 !== 0) {
    return "";
  }

  try {
    return Buffer.from(value, "hex").toString("latin1");
  } catch {
    return "";
  }
}

function extractTextFromRawPdf(buffer: Buffer) {
  const rawText = buffer.toString("latin1");
  const fragments = new Set<string>();

  const parenPattern = /\/(?:T|E|ActualText|Title|Author)\s*\(((?:\\.|[^\\()]){2,300})\)/g;
  const hexPattern = /\/(?:T|E|ActualText|Title|Author)\s*<([0-9A-Fa-f]{4,})>/g;

  for (const match of rawText.matchAll(parenPattern)) {
    const decoded = decodePdfString(match[1]).replace(/\s+/g, " ").trim();
    if (decoded) {
      fragments.add(decoded);
    }
  }

  for (const match of rawText.matchAll(hexPattern)) {
    const decoded = decodePdfHex(match[1]).replace(/\s+/g, " ").trim();
    if (decoded) {
      fragments.add(decoded);
    }
  }

  return Array.from(fragments).join("\n").trim();
}

async function extractTextWithPdfJs(buffer: Buffer) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (text) {
      pageTexts.push(text);
    }

    page.cleanup();
  }

  await loadingTask.destroy();

  return pageTexts.join("\n\n").trim();
}

function buildAnalysisPrompt(cvText: string) {
  return [
    "Analiza el CV y devuelve solo JSON válido con estas claves exactas:",
    '{"role":"","location":"","workMode":"Remoto|Hibrido|Presencial|Cualquiera","seniority":"Trainee|Junior|Semi Senior|Senior|Lead","skills":"skill1, skill2, skill3","language":"No especificado|Inglés básico|Inglés intermedio|Inglés avanzado|Portugués básico|Portugués intermedio|Portugués avanzado"}',
    "Reglas:",
    "- Si no puedes inferir role, location, seniority o skills con confianza, devuelve string vacío en ese campo.",
    "- No agregues explicaciones ni texto fuera del JSON.",
    "- Mantén skills como lista separada por comas.",
    "- Si el CV sugiere un rol dominante, usa ese rol.",
    "- Si la ubicación no aparece clara, deja location vacío.",
    "- Si el idioma no aparece claro, usa No especificado.",
    "CV:",
    cvText,
  ].join("\n");
}

function normalizeOpenAiProfile(value: Partial<CvProfile> | null | undefined): CvProfile | null {
  if (!value) {
    return null;
  }

  const profile: CvProfile = {
    role: typeof value.role === "string" && value.role.trim() ? value.role.trim() : "",
    location:
      typeof value.location === "string" && value.location.trim() ? value.location.trim() : "",
    workMode:
      typeof value.workMode === "string" && value.workMode.trim() ? value.workMode.trim() : "",
    seniority:
      typeof value.seniority === "string" && value.seniority.trim() ? value.seniority.trim() : "",
    skills: typeof value.skills === "string" && value.skills.trim() ? value.skills.trim() : "",
    language:
      typeof value.language === "string" && value.language.trim()
        ? value.language.trim()
        : "No especificado",
  };

  if (!profile.role && !profile.location && !profile.seniority && !profile.skills && profile.language === "No especificado") {
    return null;
  }

  return profile;
}

async function analyzeCvWithOpenAI(cvText: string): Promise<CvProfile | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Eres un analizador de CVs. Extraes datos estructurados para un formulario de búsqueda laboral.",
      },
      {
        role: "user",
        content: buildAnalysisPrompt(clampText(cvText, 12000)),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as Partial<CvProfile>;
    return normalizeOpenAiProfile(parsed);
  } catch {
    return null;
  }
}

async function extractTextFromBuffer(fileName: string, buffer: Buffer) {
  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith(".pdf")) {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const text = result.text.replace(/\s+/g, " ").trim();

      await parser.destroy();

      if (text) {
        return result.text;
      }
    } catch {
      // Fall through to the alternate PDF extractor below.
    }

    try {
      const fallbackText = await extractTextWithPdfJs(buffer);

      if (fallbackText) {
        return fallbackText;
      }
    } catch {
      // Fall through to the raw-PDF text extractor below.
    }

    const rawPdfText = extractTextFromRawPdf(buffer);

    if (rawPdfText) {
      return rawPdfText;
    }

    return buffer.toString("utf8");
  }

  if (lowerName.endsWith(".docx")) {
    return mammoth.extractRawText({ buffer }).then(({ value }) => value);
  }

  return Promise.resolve(buffer.toString("utf8"));
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió un archivo de CV." }, { status: 400 });
  }

  const fileName = file.name || "cv.txt";
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await extractTextFromBuffer(fileName, buffer);
  const openAiProfile = await analyzeCvWithOpenAI(text);
  const result: CvAnalysisResult = openAiProfile
    ? { profile: openAiProfile, source: "openai" }
    : { profile: parseCvText(text), source: "heuristic" };

  return NextResponse.json({
    fileName,
    text,
    profile: result.profile,
    source: result.source,
  });
}
