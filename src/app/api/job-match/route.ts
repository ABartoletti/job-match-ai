import { NextResponse } from "next/server";
import OpenAI from "openai";

type ProfilePayload = {
  role?: string;
  location?: string;
  workMode?: string;
  seniority?: string;
  skills?: string;
  language?: string;
};

type JobPayload = {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  visibleSummary?: string;
  workplaceInsights?: string[];
  criteria?: string[];
  sourceUrl?: string;
};

type MatchRequest = {
  profile?: ProfilePayload;
  job?: JobPayload;
};

type MatchResult = {
  priority: "Alta" | "Media" | "Baja" | "Revisar";
  score: number;
  reasons: string[];
  risks: string[];
  missingSkills: string[];
  recommendation: string;
  source: "openai" | "heuristic";
};

type RoleFamily = {
  id: string;
  label: string;
  terms: string[];
  negativeTerms?: string[];
};

type ScoreBreakdown = {
  role: number;
  skills: number;
  seniority: number;
};

const roleFamilies: RoleFamily[] = [
  {
    id: "qa",
    label: "QA / Testing",
    terms: [
      "qa",
      "quality assurance",
      "qa analyst",
      "qa engineer",
      "qa automation",
      "automation tester",
      "software test engineer",
      "test automation",
      "test automation engineer",
      "quality assurance engineer",
      "sdet",
      "testing",
      "tester",
    ],
    negativeTerms: ["sales", "ventas", "comercial", "account executive", "welder", "construction", "accountant"],
  },
  {
    id: "data",
    label: "Data / BI",
    terms: ["data analyst", "bi analyst", "business intelligence", "business intelligence analyst", "reporting analyst", "analytics"],
    negativeTerms: ["sales", "ventas", "welder", "construction"],
  },
  {
    id: "backend",
    label: "Backend / Software",
    terms: ["backend", "back end", "backend developer", "backend engineer", "software engineer backend", "node.js developer", "api developer"],
    negativeTerms: ["sales", "ventas", "welder", "construction"],
  },
  {
    id: "frontend",
    label: "Frontend",
    terms: ["frontend", "front end", "frontend developer", "frontend engineer", "react developer", "ui developer"],
    negativeTerms: ["sales", "ventas", "welder", "construction"],
  },
  {
    id: "sales",
    label: "Ventas / Comercial",
    terms: ["sales", "ventas", "comercial", "account executive", "sales representative", "business development"],
  },
  {
    id: "operations",
    label: "Operaciones / Oficios",
    terms: ["welder", "soldador", "construction", "construction worker", "operario", "warehouse"],
  },
  {
    id: "finance",
    label: "Finanzas / Contabilidad",
    terms: ["accountant", "contador", "accounting", "finance analyst", "payroll"],
  },
];

const skillAliases: Record<string, string[]> = {
  "api testing": ["api testing", "api tests", "testing api", "testing apis", "rest api", "apis", "postman", "soapui"],
  testing: ["testing", "test cases", "test plan", "test execution", "quality assurance", "qa"],
  automation: ["automation", "automated tests", "test automation", "automation testing"],
  sql: ["sql", "postgresql", "mysql", "sql server", "queries"],
  python: ["python", "pytest"],
  jira: ["jira", "atlassian"],
  scrum: ["scrum", "agile", "kanban"],
  github: ["github", "git", "gitlab", "version control"],
  selenium: ["selenium", "webdriver"],
  cypress: ["cypress"],
  playwright: ["playwright"],
  javascript: ["javascript", "js"],
  typescript: ["typescript", "ts"],
  react: ["react", "react.js"],
  "node.js": ["node.js", "nodejs", "node"],
};

const seniorityAliases: Record<string, string[]> = {
  trainee: ["trainee", "intern", "practicante"],
  junior: ["junior", "jr", "entry level", "entry-level"],
  "semi senior": ["semi senior", "semi-senior", "ssr", "mid", "mid-level", "mid level"],
  senior: ["senior", "sr", "sr.", "sênior"],
  lead: ["lead", "principal", "staff"],
};

function parseSkills(skills = "") {
  return skills
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function includesTerm(text: string, term: string) {
  return text.toLowerCase().includes(term.toLowerCase());
}

function normalizeText(value = "") {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAnyTerm(text: string, terms: string[]) {
  const normalized = normalizeText(text);
  return terms.some((term) => normalized.includes(normalizeText(term)));
}

function detectRoleFamily(value = "") {
  const normalized = normalizeText(value);
  return roleFamilies.find((family) => family.terms.some((term) => normalized.includes(normalizeText(term)))) || null;
}

function detectJobFamilies(jobText: string) {
  return roleFamilies.filter((family) => hasAnyTerm(jobText, family.terms));
}

function canonicalSkill(skill: string) {
  const normalized = normalizeText(skill);
  const aliasEntry = Object.entries(skillAliases).find(([canonical, aliases]) => {
    return normalized === normalizeText(canonical) || aliases.some((alias) => normalized === normalizeText(alias));
  });

  return aliasEntry ? aliasEntry[0] : normalized;
}

function skillMatches(jobText: string, skill: string) {
  const canonical = canonicalSkill(skill);
  const aliases = skillAliases[canonical] || [skill];
  return hasAnyTerm(jobText, [canonical, ...aliases]);
}

function normalizeSeniority(value = "") {
  const normalized = normalizeText(value);
  const match = Object.entries(seniorityAliases).find(([, aliases]) => aliases.some((alias) => normalized.includes(normalizeText(alias))));
  return match ? match[0] : "";
}

function detectJobSeniority(jobText: string) {
  return Object.keys(seniorityAliases).find((level) => hasAnyTerm(jobText, seniorityAliases[level])) || "";
}

function clampText(text: string, maxLength: number) {
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function getPriority(score: number): MatchResult["priority"] {
  if (score >= 78) return "Alta";
  if (score >= 58) return "Media";
  if (score >= 38) return "Revisar";
  return "Baja";
}

function detectEnglishRisk(profile: ProfilePayload, jobText: string) {
  const lowerText = jobText.toLowerCase();
  const mentionsEnglish = /english|ingl[eé]s|bilingual|biling[uü]e|c1|c2|b2|advanced english|fluent/i.test(jobText);
  const userLanguage = profile.language || "No especificado";

  if (!mentionsEnglish) {
    return null;
  }

  if (userLanguage === "Inglés avanzado") {
    return null;
  }

  if (userLanguage === "Inglés intermedio" && !/(bilingual|biling[uü]e|c1|c2|advanced|fluent)/i.test(lowerText)) {
    return "El aviso menciona inglés. Revisá si el nivel intermedio alcanza para el puesto.";
  }

  return "El aviso menciona inglés y puede requerir un nivel mayor al indicado por el usuario.";
}

function heuristicMatch(profile: ProfilePayload, job: JobPayload): MatchResult {
  const title = job.title || "";
  const description = job.description || "";
  const jobText = [
    title,
    job.company,
    job.location,
    description,
    job.visibleSummary,
    ...(job.workplaceInsights || []),
    ...(job.criteria || []),
  ]
    .filter(Boolean)
    .join("\n");
  const skills = parseSkills(profile.skills);
  const matchedSkills = skills.filter((skill) => skillMatches(jobText, skill));
  const missingSkills = skills.filter((skill) => !skillMatches(jobText, skill)).slice(0, 6);
  const profileFamily = detectRoleFamily(profile.role);
  const jobFamilies = detectJobFamilies([title, description].join("\n"));
  const titleFamily = detectRoleFamily(title);
  const hasSameFamily = Boolean(profileFamily && jobFamilies.some((family) => family.id === profileFamily.id));
  const hasTitleFamilyMatch = Boolean(profileFamily && titleFamily?.id === profileFamily.id);
  const hasDifferentKnownFamily = Boolean(profileFamily && jobFamilies.length > 0 && !hasSameFamily);
  const profileSeniority = normalizeSeniority(profile.seniority);
  const jobSeniority = detectJobSeniority(jobText);
  const scoreBreakdown: ScoreBreakdown = {
    role: 0,
    skills: 0,
    seniority: 0,
  };
  const reasons: string[] = [];
  const risks: string[] = [];

  if (profile.role && hasTitleFamilyMatch) {
    scoreBreakdown.role = 40;
    reasons.push(
      profileFamily
        ? `El puesto pertenece a la misma familia profesional ${profileFamily.label}, aunque use una denominación específica distinta.`
        : `El título se alinea con el rol objetivo: ${profile.role}.`,
    );
  } else if (profile.role && hasSameFamily) {
    scoreBreakdown.role = 32;
    reasons.push(`El aviso comparte la familia profesional ${profileFamily?.label} con tu rol objetivo.`);
  } else if (profile.role && includesTerm(jobText, profile.role)) {
    scoreBreakdown.role = 28;
    reasons.push(`El aviso menciona el rol objetivo: ${profile.role}.`);
  } else if (profile.role && hasDifferentKnownFamily) {
    scoreBreakdown.role = 6;
    risks.push(`El aviso parece pertenecer a otra familia profesional: ${jobFamilies.map((family) => family.label).join(", ")}.`);
  } else if (profile.role) {
    scoreBreakdown.role = 14;
    risks.push(`No hay señales suficientes para confirmar que el rol pertenece a la misma familia que ${profile.role}.`);
  } else {
    risks.push("No hay rol objetivo cargado para comparar la familia profesional.");
  }

  if (matchedSkills.length > 0) {
    const skillRatio = skills.length > 0 ? matchedSkills.length / skills.length : 0;
    scoreBreakdown.skills = Math.min(40, Math.round(16 + skillRatio * 24 + Math.min(matchedSkills.length, 4) * 2));
    reasons.push(`El puesto comparte competencias clave con tu perfil: ${matchedSkills.slice(0, 6).join(", ")}.`);
  } else if (skills.length > 0) {
    scoreBreakdown.skills = 6;
    risks.push("No se detectaron coincidencias claras con las skills priorizadas o detectadas del CV.");
  } else {
    scoreBreakdown.skills = 10;
    risks.push("No hay skills cargadas para comparar contra el aviso.");
  }

  if (profileSeniority && jobSeniority && profileSeniority === jobSeniority) {
    scoreBreakdown.seniority = 20;
    reasons.push(`El seniority visible parece compatible: ${profile.seniority}.`);
  } else if (profileSeniority && jobSeniority) {
    const levels = Object.keys(seniorityAliases);
    const distance = Math.abs(levels.indexOf(profileSeniority) - levels.indexOf(jobSeniority));
    scoreBreakdown.seniority = distance === 1 ? 12 : 4;
    risks.push(`El seniority visible parece ${jobSeniority}, distinto de ${profile.seniority}.`);
  } else if (profileSeniority && !jobSeniority) {
    scoreBreakdown.seniority = 12;
    risks.push("El aviso no deja claro el seniority; conviene revisarlo en la descripción.");
  } else {
    scoreBreakdown.seniority = 10;
  }

  if (profile.location && job.location && includesTerm(job.location, profile.location)) {
    reasons.push(`La ubicación visible coincide con ${profile.location}.`);
  }

  if (profile.workMode && profile.workMode !== "Cualquiera" && includesTerm(jobText, profile.workMode)) {
    reasons.push(`La modalidad visible coincide con ${profile.workMode}.`);
  }

  const languageRisk = detectEnglishRisk(profile, jobText);

  if (languageRisk) {
    risks.push(languageRisk);
  }

  const negativeRoleSignals = profileFamily?.negativeTerms && hasAnyTerm(jobText, profileFamily.negativeTerms);
  let penalty = 0;

  if (languageRisk) {
    penalty += 8;
  }

  if (negativeRoleSignals) {
    penalty += 18;
    risks.push("El aviso contiene señales de una familia laboral distinta al rol objetivo.");
  }

  const score = scoreBreakdown.role + scoreBreakdown.skills + scoreBreakdown.seniority - penalty;
  const normalizedScore = Math.max(0, Math.min(100, score));
  const priority = getPriority(normalizedScore);

  return {
    priority,
    score: normalizedScore,
    reasons: reasons.length ? reasons : ["Hay datos suficientes para una revisión inicial, pero faltan señales fuertes de encaje."],
    risks: risks.length ? risks : ["No se detectaron riesgos fuertes con la información visible."],
    missingSkills,
    recommendation:
      priority === "Alta"
        ? "Buen candidato para revisar primero. Confirmá requisitos finos de idioma, seniority y modalidad antes de postular."
        : priority === "Media"
          ? "Vale la pena leerlo completo. Puede requerir ajuste de CV o validación de requisitos."
          : priority === "Revisar"
            ? "Revisalo si el rol, empresa o stack te interesan; el encaje no es concluyente."
            : "Baja prioridad con la información visible; parece alejarse del foco o faltan señales clave.",
    source: "heuristic",
  };
}

async function openAiMatch(profile: ProfilePayload, job: JobPayload): Promise<MatchResult | null> {
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
          "Evalúas puestos laborales para job seekers. No prometas contratación. Devuelve solo JSON válido.",
      },
      {
        role: "user",
        content: [
          "Compara el perfil del usuario contra el puesto visible.",
          "Prioriza el rol objetivo y la última intención del usuario por encima de experiencia histórica no alineada.",
          "Evalúa similitud profesional por familias de roles, no igualdad textual exacta.",
          "Ejemplos: QA Automation, QA Analyst, Test Automation Engineer, Quality Assurance Engineer y SDET pertenecen a la familia QA.",
          "Usa ponderación aproximada: rol/familia 40%, skills 40%, seniority 20%.",
          "Si hay idioma requerido o implícito, marca riesgo si el perfil no alcanza.",
          'Devuelve JSON con: {"priority":"Alta|Media|Baja|Revisar","score":0-100,"reasons":[""],"risks":[""],"missingSkills":[""],"recommendation":""}.',
          "Perfil:",
          JSON.stringify(profile),
          "Puesto:",
          JSON.stringify({
            ...job,
            description: clampText(job.description || "", 9000),
            visibleSummary: clampText(job.visibleSummary || "", 2000),
          }),
        ].join("\n"),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    return null;
  }

  try {
    const parsed = JSON.parse(content) as Partial<MatchResult>;

    if (!parsed.priority || typeof parsed.score !== "number") {
      return null;
    }

    return {
      priority: parsed.priority,
      score: Math.max(0, Math.min(100, parsed.score)),
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.slice(0, 5) : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5) : [],
      missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills.slice(0, 8) : [],
      recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation : "",
      source: "openai",
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as MatchRequest;
  const profile = body.profile || {};
  const job = body.job || {};

  if (!job.title && !job.description) {
    return NextResponse.json({ error: "No se recibió un puesto visible para analizar." }, { status: 400 });
  }

  const aiResult = await openAiMatch(profile, job);
  const result = aiResult || heuristicMatch(profile, job);

  return NextResponse.json(result);
}
