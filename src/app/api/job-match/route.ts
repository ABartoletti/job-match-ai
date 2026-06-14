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

function parseSkills(skills = "") {
  return skills
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function includesTerm(text: string, term: string) {
  return text.toLowerCase().includes(term.toLowerCase());
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
  const jobText = [title, job.company, job.location, description].filter(Boolean).join("\n");
  const skills = parseSkills(profile.skills);
  const matchedSkills = skills.filter((skill) => includesTerm(jobText, skill));
  const missingSkills = skills.filter((skill) => !includesTerm(jobText, skill)).slice(0, 6);
  const reasons: string[] = [];
  const risks: string[] = [];
  let score = 30;

  if (profile.role && includesTerm(title, profile.role)) {
    score += 30;
    reasons.push(`El título del puesto coincide con el rol objetivo: ${profile.role}.`);
  } else if (profile.role && includesTerm(jobText, profile.role)) {
    score += 18;
    reasons.push(`El aviso menciona el rol objetivo: ${profile.role}.`);
  } else if (profile.role) {
    risks.push(`El título no parece alineado directamente con el rol objetivo: ${profile.role}.`);
  }

  if (matchedSkills.length > 0) {
    score += Math.min(25, matchedSkills.length * 5);
    reasons.push(`Coinciden skills: ${matchedSkills.slice(0, 6).join(", ")}.`);
  } else if (skills.length > 0) {
    risks.push("No se detectaron coincidencias claras con las skills priorizadas.");
  }

  if (profile.seniority && includesTerm(jobText, profile.seniority)) {
    score += 8;
    reasons.push(`El aviso menciona seniority compatible: ${profile.seniority}.`);
  }

  if (profile.location && job.location && includesTerm(job.location, profile.location)) {
    score += 8;
    reasons.push(`La ubicación visible coincide con ${profile.location}.`);
  }

  if (profile.workMode && profile.workMode !== "Cualquiera" && includesTerm(jobText, profile.workMode)) {
    score += 6;
    reasons.push(`La modalidad visible coincide con ${profile.workMode}.`);
  }

  const languageRisk = detectEnglishRisk(profile, jobText);

  if (languageRisk) {
    score -= 12;
    risks.push(languageRisk);
  }

  if (/sales|ventas|comercial|account executive|ejecutivo de ventas/i.test(jobText) && !/sales|ventas|comercial/i.test(profile.role || "")) {
    score -= 12;
    risks.push("El aviso parece orientado a ventas/comercial y puede desviarse del rol objetivo.");
  }

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
        ? "Abrilo como prioridad y revisá requisitos finos antes de postular."
        : priority === "Media"
          ? "Vale la pena leer el aviso completo y ajustar el CV si el rol encaja."
          : priority === "Revisar"
            ? "Revisalo solo si el rol o la empresa te interesan especialmente."
            : "Baja prioridad con la información visible.",
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
          "Si hay idioma requerido o implícito, marca riesgo si el perfil no alcanza.",
          'Devuelve JSON con: {"priority":"Alta|Media|Baja|Revisar","score":0-100,"reasons":[""],"risks":[""],"missingSkills":[""],"recommendation":""}.',
          "Perfil:",
          JSON.stringify(profile),
          "Puesto:",
          JSON.stringify({
            ...job,
            description: clampText(job.description || "", 9000),
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
