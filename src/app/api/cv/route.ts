import { NextResponse } from "next/server";
import mammoth from "mammoth";
import OpenAI from "openai";
import { PDFParse } from "pdf-parse";

const rolePatterns: Array<[RegExp, string]> = [
  [/data analyst|business intelligence|bi analyst/i, "Data Analyst"],
  [/data engineer|analytics engineer/i, "Data Engineer"],
  [/qa automation|automation qa|sdet|test automation|automation tester|automation engineer/i, "QA Automation"],
  [/quality assurance|qa analyst|qa engineer|manual qa|software tester|tester/i, "QA Analyst"],
  [/frontend|front end|react|ui developer/i, "Frontend Developer"],
  [/backend|back end|node|api developer/i, "Backend Developer"],
  [/full stack|fullstack|software engineer|software developer/i, "Full Stack Developer"],
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
  [/\b(trainee|intern|practicante)\b/i, "Trainee"],
  [/\b(junior|jr\.?)\b/i, "Junior"],
  [/\b(semi senior|semi-senior|ssr\.?)\b/i, "Semi Senior"],
  [/\b(senior|sr\.?)\b/i, "Senior"],
  [/\b(lead|principal|staff)\b/i, "Lead"],
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
  "API Testing",
  "Postman",
  "Jenkins",
  "CI/CD",
  "Microservices",
  "Unix",
  "Linux",
  "Manual Testing",
  "Regression Testing",
  "Test Automation",
  "REST API",
  "Agile",
  "APIs",
  "Pytest",
  "GitLab",
  "Kanban",
];

type CvExperience = {
  title: string;
  company: string;
  period: string;
  description: string;
};

type CvSkillGroups = {
  technical: string[];
  tools: string[];
  testing: string[];
  languages: string[];
  methodologies: string[];
};

type CvProfile = {
  role: string;
  location: string;
  workMode: string;
  seniority: string;
  skills: string;
  language: string;
  headline?: string;
  summary?: string;
  totalYears?: number | null;
  currentRole?: string;
  targetRole?: string;
  experiences?: CvExperience[];
  skillGroups?: CvSkillGroups;
  education?: string[];
  certifications?: string[];
  industries?: string[];
  evidence?: string[];
  rawCvText?: string;
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

function parseSkills(skills: string) {
  return skills
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const clean = value.trim();
    const key = clean.toLowerCase();

    if (!clean || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractSection(lines: string[], headings: RegExp[]) {
  const startIndex = lines.findIndex((line) => headings.some((heading) => heading.test(line)));

  if (startIndex === -1) {
    return [];
  }

  const nextHeadingIndex = lines.findIndex((line, index) => {
    return (
      index > startIndex &&
      /^(experiencia|experience|educaci[oó]n|education|skills|habilidades|certificaciones|certifications|proyectos|projects|idiomas|languages)\b/i.test(line)
    );
  });

  return lines.slice(startIndex + 1, nextHeadingIndex === -1 ? startIndex + 9 : nextHeadingIndex).slice(0, 12);
}

function extractExperience(lines: string[]): CvExperience[] {
  const experienceLines = extractSection(lines, [/^experiencia/i, /^experience/i, /^work experience/i]);
  const sourceLines = experienceLines.length ? experienceLines : lines;
  const roleLinePattern = /(qa|quality assurance|sdet|tester|developer|engineer|analyst|manager|consultant|automation)/i;
  const periodPattern = /(\b(19|20)\d{2}\b|present|actualidad|current|ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|feb|mar|apr|aug|dec)/i;

  return sourceLines
    .filter((line) => roleLinePattern.test(line))
    .slice(0, 5)
    .map((line, index) => {
      const [titlePart, companyPart = ""] = line.split(/\s[-|@]\s/);

      return {
        title: titlePart.trim(),
        company: companyPart.trim(),
        period: periodPattern.test(line) ? line.match(periodPattern)?.[0] || "" : "",
        description: sourceLines.slice(index + 1, index + 4).join(" "),
      };
    });
}

function extractListSection(lines: string[], headings: RegExp[]) {
  return extractSection(lines, headings)
    .flatMap((line) => line.split(/[,;|•]/))
    .map((item) => item.trim())
    .filter((item) => item.length > 1)
    .slice(0, 12);
}

function categorizeSkills(skills: string[]): CvSkillGroups {
  const testing = ["Selenium", "Cypress", "Playwright", "API Testing", "Manual Testing", "Regression Testing", "Test Automation", "Postman"];
  const tools = ["Jira", "Git", "GitHub", "Jenkins", "Docker", "Kubernetes", "AWS", "Azure", "GCP", "Figma"];
  const languages = ["Python", "JavaScript", "TypeScript", "SQL", "HTML", "CSS"];
  const methodologies = ["Scrum", "Agile", "Kanban", "CI/CD"];

  return {
    technical: skills.filter((skill) => ![...testing, ...tools, ...languages, ...methodologies].includes(skill)),
    tools: skills.filter((skill) => tools.includes(skill)),
    testing: skills.filter((skill) => testing.includes(skill)),
    languages: skills.filter((skill) => languages.includes(skill)),
    methodologies: skills.filter((skill) => methodologies.includes(skill)),
  };
}

function detectTotalYears(text: string) {
  const matches = Array.from(text.matchAll(/(\d+)\+?\s*(?:years|años|anos|yrs)/gi));
  const values = matches.map((match) => Number.parseInt(match[1], 10)).filter((value) => Number.isFinite(value));
  return values.length ? Math.max(...values) : null;
}

function inferRoleFromSignals(text: string, skills: string[]) {
  const normalizedSkills = skills.map((skill) => skill.toLowerCase());

  if (
    /qa|quality assurance|sdet|tester|testing/i.test(text) ||
    normalizedSkills.some((skill) => ["selenium", "cypress", "playwright", "postman", "api testing", "test automation", "manual testing"].includes(skill))
  ) {
    return normalizedSkills.some((skill) => ["selenium", "cypress", "playwright", "test automation"].includes(skill))
      ? "QA Automation"
      : "QA Analyst";
  }

  if (
    /data|business intelligence|analytics|reporting/i.test(text) ||
    normalizedSkills.some((skill) => ["sql", "power bi", "tableau", "looker", "excel"].includes(skill))
  ) {
    return "Data Analyst";
  }

  if (normalizedSkills.some((skill) => ["react", "next.js", "html", "css", "tailwind"].includes(skill))) {
    return "Frontend Developer";
  }

  if (normalizedSkills.some((skill) => ["node.js", "postgresql", "mysql", "mongodb", "docker"].includes(skill))) {
    return "Backend Developer";
  }

  return "";
}

function parseCvText(text: string): CvProfile {
  const normalizedText = text.replace(/\s+/g, " ");
  const lines = getLines(text);
  const skills = uniqueValues(parseSkills(extractSkills(normalizedText)));
  const experiences = extractExperience(lines);
  const education = extractListSection(lines, [/^educaci[oó]n/i, /^education/i]);
  const certifications = extractListSection(lines, [/^certificaciones/i, /^certifications/i, /^certificates/i]);
  const headline = lines.find((line) => line.length > 8 && line.length < 120) || "";
  const detectedRole = extractValue(rolePatterns, normalizedText, "") || inferRoleFromSignals(normalizedText, skills);

  return {
    role: detectedRole,
    location: extractValue(locationPatterns, normalizedText, ""),
    workMode: extractValue(workModePatterns, normalizedText, "Cualquiera"),
    seniority: extractValue(seniorityPatterns, normalizedText, ""),
    skills: skills.join(", "),
    language: extractValue(languagePatterns, normalizedText, "No especificado"),
    headline,
    summary: lines.slice(0, 5).join(" ").slice(0, 700),
    totalYears: detectTotalYears(normalizedText),
    currentRole: experiences[0]?.title || "",
    targetRole: detectedRole,
    experiences,
    skillGroups: categorizeSkills(skills),
    education,
    certifications,
    industries: [],
    evidence: lines.slice(0, 20),
    rawCvText: clampText(text, 20000),
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
    "- AdemÃ¡s de los campos base, extrae headline, summary, totalYears, currentRole, targetRole, experiences, skillGroups, education, certifications, industries y evidence si aparecen.",
    "- experiences debe usar solo experiencias reales presentes en el CV. No inventes empresas, skills ni fechas.",
    "- evidence debe incluir frases breves del CV que justifiquen rol, seniority, skills, herramientas o idiomas.",
    "CV:",
    cvText,
  ].join("\n");
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueValues(
    value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean),
  ).slice(0, 20);
}

function normalizeExperiences(value: unknown): CvExperience[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const entry = item as Partial<CvExperience>;

      return {
        title: typeof entry.title === "string" ? entry.title.trim() : "",
        company: typeof entry.company === "string" ? entry.company.trim() : "",
        period: typeof entry.period === "string" ? entry.period.trim() : "",
        description: typeof entry.description === "string" ? entry.description.trim() : "",
      };
    })
    .filter((item): item is CvExperience => Boolean(item && (item.title || item.company || item.description)))
    .slice(0, 6);
}

function normalizeSkillGroups(value: unknown, fallbackSkills: string[]): CvSkillGroups {
  if (!value || typeof value !== "object") {
    return categorizeSkills(fallbackSkills);
  }

  const groups = value as Partial<Record<keyof CvSkillGroups, unknown>>;

  return {
    technical: normalizeStringArray(groups.technical),
    tools: normalizeStringArray(groups.tools),
    testing: normalizeStringArray(groups.testing),
    languages: normalizeStringArray(groups.languages),
    methodologies: normalizeStringArray(groups.methodologies),
  };
}

function normalizeOpenAiProfile(value: Partial<CvProfile> | null | undefined): CvProfile | null {
  if (!value) {
    return null;
  }

  const skills = uniqueValues(parseSkills(typeof value.skills === "string" ? value.skills : ""));

  const profile: CvProfile = {
    role: typeof value.role === "string" && value.role.trim() ? value.role.trim() : "",
    location:
      typeof value.location === "string" && value.location.trim() ? value.location.trim() : "",
    workMode:
      typeof value.workMode === "string" && value.workMode.trim() ? value.workMode.trim() : "",
    seniority:
      typeof value.seniority === "string" && value.seniority.trim() ? value.seniority.trim() : "",
    skills: skills.join(", "),
    language:
      typeof value.language === "string" && value.language.trim()
        ? value.language.trim()
        : "No especificado",
    headline: typeof value.headline === "string" ? value.headline.trim() : "",
    summary: typeof value.summary === "string" ? value.summary.trim().slice(0, 900) : "",
    totalYears: typeof value.totalYears === "number" && Number.isFinite(value.totalYears) ? value.totalYears : null,
    currentRole: typeof value.currentRole === "string" ? value.currentRole.trim() : "",
    targetRole: typeof value.targetRole === "string" ? value.targetRole.trim() : "",
    experiences: normalizeExperiences(value.experiences),
    skillGroups: normalizeSkillGroups(value.skillGroups, skills),
    education: normalizeStringArray(value.education),
    certifications: normalizeStringArray(value.certifications),
    industries: normalizeStringArray(value.industries),
    evidence: normalizeStringArray(value.evidence),
  };

  if (!profile.role && !profile.location && !profile.seniority && !profile.skills && profile.language === "No especificado") {
    return null;
  }

  return profile;
}

function mergeProfiles(primary: CvProfile, fallback: CvProfile): CvProfile {
  return {
    ...fallback,
    ...primary,
    role: primary.role || fallback.role,
    location: primary.location || fallback.location,
    workMode: primary.workMode || fallback.workMode,
    seniority: primary.seniority || fallback.seniority,
    skills: primary.skills || fallback.skills,
    language: primary.language !== "No especificado" ? primary.language : fallback.language,
    headline: primary.headline || fallback.headline,
    summary: primary.summary || fallback.summary,
    totalYears: primary.totalYears ?? fallback.totalYears ?? null,
    currentRole: primary.currentRole || fallback.currentRole,
    targetRole: primary.targetRole || fallback.targetRole,
    experiences: primary.experiences?.length ? primary.experiences : fallback.experiences,
    skillGroups: primary.skillGroups || fallback.skillGroups,
    education: primary.education?.length ? primary.education : fallback.education,
    certifications: primary.certifications?.length ? primary.certifications : fallback.certifications,
    industries: primary.industries?.length ? primary.industries : fallback.industries,
    evidence: primary.evidence?.length ? primary.evidence : fallback.evidence,
    rawCvText: fallback.rawCvText,
  };
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
  const heuristicProfile = parseCvText(text);
  const openAiProfile = await analyzeCvWithOpenAI(text);
  const result: CvAnalysisResult = openAiProfile
    ? { profile: mergeProfiles(openAiProfile, heuristicProfile), source: "openai" }
    : { profile: heuristicProfile, source: "heuristic" };

  return NextResponse.json({
    fileName,
    text,
    profile: result.profile,
    source: result.source,
  });
}
