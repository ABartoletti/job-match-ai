import { NextResponse } from "next/server";
import OpenAI from "openai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Access-Control-Allow-Headers": "Content-Type",
};

type ProfilePayload = {
  role?: string;
  location?: string;
  workMode?: string;
  seniority?: string;
  skills?: string;
  language?: string;
  headline?: string;
  summary?: string;
  totalYears?: number | null;
  currentRole?: string;
  targetRole?: string;
  experiences?: CvExperiencePayload[];
  skillGroups?: CvSkillGroupsPayload;
  education?: string[];
  certifications?: string[];
  industries?: string[];
  evidence?: string[];
  rawCvText?: string;
};

type CvExperiencePayload = {
  title?: string;
  company?: string;
  period?: string;
  description?: string;
};

type CvSkillGroupsPayload = {
  technical?: string[];
  tools?: string[];
  testing?: string[];
  languages?: string[];
  methodologies?: string[];
};

type JobPayload = {
  title?: string;
  company?: string;
  location?: string;
  description?: string;
  requirements?: string;
  responsibilities?: string;
  benefits?: string;
  visibleSummary?: string;
  workplaceInsights?: string[];
  criteria?: string[];
  debug?: {
    description?: TextDebug;
    analysisText?: TextDebug;
  };
  sourceUrl?: string;
};

type TextDebug = {
  characters?: number;
  words?: number;
  first500?: string;
  last500?: string;
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
  matchedSkills?: string[];
  detectedRequirements?: RequirementMatch[];
  missingRequirements?: RequirementMatch[];
  requirementsByCriticality?: RequirementsByCriticality;
  scoreBreakdown?: ScoreBreakdown;
  debug?: MatchDebug;
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
  skills: number;
  experience: number;
  family: number;
  seniority: number;
};

type RequirementCriticality = "required" | "important" | "nice-to-have";

type RequirementDefinition = {
  name: string;
  aliases: string[];
};

type RequirementMatch = {
  name: string;
  criticality: RequirementCriticality;
  matched: boolean;
  weight: number;
  evidence: string;
};

type RequirementsByCriticality = {
  required: RequirementMatch[];
  important: RequirementMatch[];
  niceToHave: RequirementMatch[];
};

type SeniorityLevel = "trainee" | "junior" | "semi senior" | "senior" | "lead" | "principal" | "architect";

type SeniorityDetection = {
  title: SeniorityLevel | "";
  description: SeniorityLevel | "";
  years: number | null;
  inferredFromYears: SeniorityLevel | "";
  final: SeniorityLevel | "";
  rule: string;
};

type MatchDebug = {
  seniority: SeniorityDetection;
  family: {
    profile: string | null;
    title: string | null;
    detected: string[];
    conflict: string | null;
    finalRule: string;
  };
  scoreBreakdown: ScoreBreakdown;
  rulesFired: string[];
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
  "api testing": ["api testing", "api tests", "testing api", "testing apis", "api test", "api tests", "rest api", "apis", "postman", "soapui"],
  postman: ["postman", "api client"],
  apis: ["api", "apis", "rest", "restful", "web services", "services integration"],
  testing: ["testing", "test cases", "test plan", "test execution", "quality assurance", "qa"],
  "testing automation": ["testing automation", "test automation", "automation testing", "automated testing", "automated tests"],
  automation: ["automation", "automated tests", "test automation", "automation testing"],
  sql: ["sql", "postgresql", "mysql", "sql server", "queries"],
  python: ["python", "pytest"],
  jenkins: ["jenkins", "ci/cd", "ci cd", "continuous integration"],
  jira: ["jira", "atlassian"],
  scrum: ["scrum", "agile", "kanban"],
  github: ["github", "git", "gitlab", "version control"],
  selenium: ["selenium", "webdriver"],
  integrations: ["integration", "integrations", "testing integrations", "microservices", "services integration"],
  microservices: ["microservices", "micro services", "distributed services"],
  unix: ["unix", "linux", "shell", "bash"],
  cypress: ["cypress"],
  playwright: ["playwright"],
  javascript: ["javascript", "js"],
  typescript: ["typescript", "ts"],
  react: ["react", "react.js"],
  "node.js": ["node.js", "nodejs", "node"],
  mongodb: ["mongodb", "mongo"],
  arduino: ["arduino"],
  microbit: ["microbit", "micro:bit"],
  "performance testing": ["performance testing", "load testing", "stress testing", "jmeter"],
};

const requirementDefinitions: RequirementDefinition[] = [
  { name: "Cypress", aliases: ["cypress"] },
  { name: "Playwright", aliases: ["playwright"] },
  { name: "TypeScript", aliases: ["typescript", "ts"] },
  { name: "JavaScript", aliases: ["javascript", "js"] },
  { name: "Python", aliases: ["python", "pytest"] },
  { name: "Selenium", aliases: ["selenium", "webdriver"] },
  { name: "SQL", aliases: ["sql", "postgresql", "mysql", "sql server", "queries"] },
  { name: "Jira", aliases: ["jira", "atlassian"] },
  { name: "Scrum", aliases: ["scrum", "agile", "kanban"] },
  { name: "Postman", aliases: ["postman"] },
  { name: "API Testing", aliases: ["api testing", "api tests", "apis", "rest api", "postman", "testing integrations"] },
  { name: "Jenkins", aliases: ["jenkins", "ci/cd", "continuous integration"] },
  { name: "Microservices", aliases: ["microservices", "micro services"] },
  { name: "Unix/Linux", aliases: ["unix", "linux", "bash", "shell"] },
  { name: "MongoDB", aliases: ["mongodb", "mongo"] },
  { name: "Arduino", aliases: ["arduino"] },
  { name: "Microbit", aliases: ["microbit", "micro:bit"] },
  { name: "Performance Testing", aliases: ["performance testing", "load testing", "stress testing", "jmeter"] },
];

const seniorityOrder: SeniorityLevel[] = ["trainee", "junior", "semi senior", "senior", "lead", "principal", "architect"];

const seniorityAliases: Record<SeniorityLevel, RegExp[]> = {
  trainee: [/\btrainee\b/i, /\bintern\b/i, /\bpracticante\b/i],
  junior: [/\bjunior\b/i, /\bjr\.?\b/i, /\bentry[-\s]?level\b/i],
  "semi senior": [/\bsemi[-\s]?senior\b/i, /\bssr\.?\b/i, /\bmid[-\s]?level\b/i, /\bmid\b/i],
  senior: [/\bsenior\b/i, /\bsr\.?\b/i, /\bsênior\b/i],
  lead: [/\blead\b/i, /\bstaff\b/i],
  principal: [/\bprincipal\b/i],
  architect: [/\barchitect\b/i, /\barquitect[oa]\b/i],
};

function parseSkills(skills = "") {
  return skills
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function uniqueValues(values: string[]) {
  const seen = new Set<string>();

  return values.filter((value) => {
    const clean = value.trim();
    const key = normalizeText(clean);

    if (!clean || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function collectProfileSkills(profile: ProfilePayload) {
  const groupedSkills = profile.skillGroups
    ? [
        ...(profile.skillGroups.technical || []),
        ...(profile.skillGroups.tools || []),
        ...(profile.skillGroups.testing || []),
        ...(profile.skillGroups.languages || []),
        ...(profile.skillGroups.methodologies || []),
      ]
    : [];

  return uniqueValues([...parseSkills(profile.skills), ...groupedSkills]);
}

function collectProfileEvidenceText(profile: ProfilePayload, skills: string[]) {
  return [
    profile.role,
    profile.targetRole,
    profile.currentRole,
    profile.headline,
    profile.summary,
    profile.seniority,
    profile.language,
    skills.join(", "),
    ...(profile.education || []),
    ...(profile.certifications || []),
    ...(profile.industries || []),
    ...(profile.evidence || []),
    ...(profile.experiences || []).flatMap((experience) => [
      experience.title,
      experience.company,
      experience.period,
      experience.description,
    ]),
    profile.rawCvText,
  ]
    .filter(Boolean)
    .join("\n");
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

function detectSeniorityInText(value = ""): SeniorityLevel | "" {
  const matches = seniorityOrder.filter((level) => seniorityAliases[level].some((pattern) => pattern.test(value)));
  return matches.at(-1) || "";
}

function normalizeSeniority(value = "") {
  return detectSeniorityInText(value);
}

function inferSeniorityFromYears(years: number | null): SeniorityLevel | "" {
  if (years === null) return "";
  if (years <= 1) return "junior";
  if (years <= 4) return "semi senior";
  if (years <= 8) return "senior";
  return "lead";
}

function detectJobSeniority(title: string, description: string): SeniorityDetection {
  const years = detectYearsOfExperience([title, description].join("\n"));
  const titleSeniority = detectSeniorityInText(title);
  const descriptionSeniority = detectSeniorityInText(description);
  const inferredFromYears = inferSeniorityFromYears(years);

  if (titleSeniority) {
    return {
      title: titleSeniority,
      description: descriptionSeniority,
      years,
      inferredFromYears,
      final: titleSeniority,
      rule: "title",
    };
  }

  if (descriptionSeniority) {
    return {
      title: titleSeniority,
      description: descriptionSeniority,
      years,
      inferredFromYears,
      final: descriptionSeniority,
      rule: "description",
    };
  }

  return {
    title: titleSeniority,
    description: descriptionSeniority,
    years,
    inferredFromYears,
    final: inferredFromYears,
    rule: inferredFromYears ? "years" : "none",
  };
}

function detectYearsOfExperience(text: string) {
  const normalized = normalizeText(text);
  const matches = Array.from(normalized.matchAll(/(\d+)\s*\+?\s*(?:years|year|anos|ano|yrs)/g));
  const numbers = matches.map((match) => Number.parseInt(match[1], 10)).filter((value) => Number.isFinite(value));
  return numbers.length ? Math.max(...numbers) : null;
}

function inferProfileYears(profile: ProfilePayload) {
  if (typeof profile.totalYears === "number" && Number.isFinite(profile.totalYears)) {
    return profile.totalYears;
  }

  const seniority = normalizeSeniority(profile.seniority);

  if (seniority === "trainee") return 0;
  if (seniority === "junior") return 1;
  if (seniority === "semi senior") return 3;
  if (seniority === "senior") return 5;
  if (seniority === "lead") return 7;
  if (seniority === "principal") return 9;
  if (seniority === "architect") return 10;

  return null;
}

function getRequirementEvidence(text: string, aliases: string[]) {
  const normalized = normalizeText(text);
  const sentences = text
    .split(/(?<=[.!?])\s+|\n|•|-/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const sentenceMatch = sentences.find((sentence) => hasAnyTerm(sentence, aliases));

  if (sentenceMatch) {
    return sentenceMatch.slice(0, 240);
  }

  const alias = aliases.find((item) => normalized.includes(normalizeText(item)));

  if (!alias) {
    return "";
  }

  const index = normalized.indexOf(normalizeText(alias));
  const start = Math.max(0, index - 80);
  const end = Math.min(text.length, index + alias.length + 120);

  return text.slice(start, end).trim();
}

function classifyCriticality(evidence: string): RequirementCriticality {
  if (/(excluyente|must have|required|mandatory|essential|obligatorio|imprescindible|exclusivo)/i.test(evidence)) {
    return "required";
  }

  if (/(deseable|nice to have|nice-to-have|plus|preferred|preferido|valorado|bonus|ser[aá] un plus)/i.test(evidence)) {
    return "nice-to-have";
  }

  return "important";
}

function requirementWeight(criticality: RequirementCriticality) {
  if (criticality === "required") return 12;
  if (criticality === "important") return 5;
  return 2;
}

function profileCoversRequirement(profileSkillsText: string, requirement: RequirementDefinition) {
  return hasAnyTerm(profileSkillsText, requirement.aliases) || requirement.aliases.some((alias) => skillMatches(profileSkillsText, alias));
}

function detectRequirements(jobText: string, profileSkillsText: string): RequirementMatch[] {
  return requirementDefinitions
    .map((definition) => {
      const evidence = getRequirementEvidence(jobText, definition.aliases);

      if (!evidence) {
        return null;
      }

      const criticality = classifyCriticality(evidence);

      return {
        name: definition.name,
        criticality,
        matched: profileCoversRequirement(profileSkillsText, definition),
        weight: requirementWeight(criticality),
        evidence,
      };
    })
    .filter((requirement): requirement is RequirementMatch => Boolean(requirement));
}

function groupRequirements(requirements: RequirementMatch[]): RequirementsByCriticality {
  return {
    required: requirements.filter((requirement) => requirement.criticality === "required"),
    important: requirements.filter((requirement) => requirement.criticality === "important"),
    niceToHave: requirements.filter((requirement) => requirement.criticality === "nice-to-have"),
  };
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
    job.requirements,
    job.responsibilities,
    job.benefits,
    job.visibleSummary,
    ...(job.workplaceInsights || []),
    ...(job.criteria || []),
  ]
    .filter(Boolean)
    .join("\n");
  const skills = collectProfileSkills(profile);
  const profileText = collectProfileEvidenceText(profile, skills);
  const profileRole = profile.targetRole || profile.role || profile.currentRole || "";
  const matchedSkills = skills.filter((skill) => skillMatches(jobText, skill));
  const missingSkills = skills.filter((skill) => !skillMatches(jobText, skill)).slice(0, 6);
  const profileFamily = detectRoleFamily(profileRole);
  const jobFamilies = detectJobFamilies([title, description].join("\n"));
  const titleFamily = detectRoleFamily(title);
  const hasSameFamily = Boolean(profileFamily && jobFamilies.some((family) => family.id === profileFamily.id));
  const hasTitleFamilyMatch = Boolean(profileFamily && titleFamily?.id === profileFamily.id);
  const hasDifferentKnownFamily = Boolean(profileFamily && jobFamilies.length > 0 && !hasSameFamily);
  const profileSeniority = normalizeSeniority(profile.seniority);
  const jobSeniorityDetection = detectJobSeniority(title, jobText);
  const jobSeniority = jobSeniorityDetection.final;
  const requiredYears = detectYearsOfExperience(jobText);
  const profileYears = inferProfileYears(profile);
  const detectedRequirements = detectRequirements(jobText, profileText);
  const missingRequirements = detectedRequirements.filter((requirement) => !requirement.matched);
  const requirementsByCriticality = groupRequirements(detectedRequirements);
  const totalRequirementWeight = detectedRequirements.reduce((total, requirement) => total + requirement.weight, 0);
  const coveredRequirementWeight = detectedRequirements
    .filter((requirement) => requirement.matched)
    .reduce((total, requirement) => total + requirement.weight, 0);
  const missingRequiredRequirements = missingRequirements.filter((requirement) => requirement.criticality === "required");
  const scoreBreakdown: ScoreBreakdown = {
    skills: 0,
    experience: 0,
    family: 0,
    seniority: 0,
  };
  const reasons: string[] = [];
  const risks: string[] = [];
  const rulesFired: string[] = [];
  const familyConflict =
    profileFamily && hasSameFamily
      ? null
      : profileFamily && jobFamilies.length > 0
        ? `Perfil ${profileFamily.label} vs aviso ${jobFamilies.map((family) => family.label).join(", ")}`
        : null;

  if (totalRequirementWeight > 0) {
    const coverageRatio = coveredRequirementWeight / totalRequirementWeight;
    scoreBreakdown.skills = Math.round(coverageRatio * 40);
    const coveredNames = detectedRequirements.filter((requirement) => requirement.matched).map((requirement) => requirement.name);

    if (coveredNames.length > 0) {
      reasons.push(`Requisitos cubiertos según criticidad: ${coveredNames.slice(0, 8).join(", ")}.`);
      rulesFired.push("skills.weighted-requirements");
    }

    if (missingRequiredRequirements.length > 0) {
      risks.push(
        `Faltan requisitos excluyentes: ${missingRequiredRequirements.map((requirement) => requirement.name).join(", ")}.`,
      );
    }
  } else if (matchedSkills.length > 0) {
    const skillRatio = skills.length > 0 ? matchedSkills.length / skills.length : 0;
    scoreBreakdown.skills = Math.min(40, Math.round(18 + skillRatio * 18 + Math.min(matchedSkills.length, 5)));
    reasons.push(`Coinciden skills/herramientas: ${matchedSkills.slice(0, 8).join(", ")}.`);
  } else if (skills.length > 0) {
    scoreBreakdown.skills = 6;
    risks.push("No se detectaron coincidencias claras con las skills priorizadas o detectadas del CV.");
  } else {
    scoreBreakdown.skills = 8;
    risks.push("No hay skills cargadas para comparar contra el aviso.");
  }

  if (requiredYears !== null && profileYears !== null && profileYears >= requiredYears) {
    scoreBreakdown.experience = 30;
    reasons.push(`La experiencia requerida detectada (${requiredYears}+ años) parece compatible con el seniority/perfil cargado.`);
    rulesFired.push("experience.years-compatible");
  } else if (requiredYears !== null && profileYears !== null && profileYears + 1 >= requiredYears) {
    scoreBreakdown.experience = 22;
    risks.push(`La experiencia requerida (${requiredYears}+ años) queda cerca del nivel estimado del perfil.`);
  } else if (requiredYears !== null && profileYears !== null) {
    scoreBreakdown.experience = 8;
    risks.push(`El aviso pide ${requiredYears}+ años y el seniority cargado podría quedar corto.`);
  } else if (requiredYears !== null) {
    scoreBreakdown.experience = 18;
    reasons.push(`El aviso explicita experiencia requerida (${requiredYears}+ años); validalo contra el CV.`);
  } else if (hasSameFamily || matchedSkills.length >= 2) {
    scoreBreakdown.experience = 20;
    risks.push("No se detectó una cantidad clara de años requeridos; se usa el resto de señales del aviso.");
  } else {
    scoreBreakdown.experience = 10;
    risks.push("No se detectaron señales fuertes de experiencia requerida.");
  }

  if (profileRole && hasTitleFamilyMatch) {
    scoreBreakdown.family = 20;
    reasons.push(`El puesto pertenece a la misma familia profesional ${profileFamily?.label}.`);
    rulesFired.push("family.title-match");
  } else if (profileRole && hasSameFamily) {
    scoreBreakdown.family = 16;
    reasons.push(`El aviso comparte la familia profesional ${profileFamily?.label} con tu rol objetivo.`);
    rulesFired.push("family.same-family");
  } else if (profileRole && includesTerm(jobText, profileRole)) {
    scoreBreakdown.family = 14;
    reasons.push(`El aviso menciona el rol objetivo: ${profileRole}.`);
  } else if (profileRole && hasDifferentKnownFamily) {
    scoreBreakdown.family = 3;
    risks.push(`El aviso parece pertenecer a otra familia profesional: ${jobFamilies.map((family) => family.label).join(", ")}.`);
  } else if (profileRole) {
    scoreBreakdown.family = matchedSkills.length >= 3 ? 12 : 7;
    if (matchedSkills.length >= 3) {
      reasons.push("Aunque el título no sea idéntico, las competencias detectadas sostienen afinidad profesional.");
    } else {
      risks.push(`No hay señales suficientes para confirmar que el rol pertenece a la misma familia que ${profileRole}.`);
    }
  } else {
    risks.push("No hay rol objetivo cargado para comparar la familia profesional.");
  }

  if (profileSeniority && jobSeniority && profileSeniority === jobSeniority) {
    scoreBreakdown.seniority = 10;
    reasons.push(`El seniority visible parece compatible: ${profile.seniority}.`);
    rulesFired.push(`seniority.${jobSeniorityDetection.rule}`);
  } else if (profileSeniority && jobSeniority) {
    const levels = seniorityOrder;
    const distance = Math.abs(levels.indexOf(profileSeniority) - levels.indexOf(jobSeniority));
    scoreBreakdown.seniority = distance === 1 ? 6 : 2;
    risks.push(`El seniority visible parece ${jobSeniority}, distinto de ${profile.seniority}.`);
    rulesFired.push(`seniority.mismatch-${jobSeniorityDetection.rule}`);
  } else if (profileSeniority && !jobSeniority) {
    scoreBreakdown.seniority = 6;
    risks.push("El aviso no deja claro el seniority; conviene revisarlo en la descripción.");
  } else {
    scoreBreakdown.seniority = 5;
  }

  if (detectedRequirements.length > 0) {
    reasons.push(
      `Requisitos detectados: ${detectedRequirements
        .slice(0, 8)
        .map((requirement) => `${requirement.name} (${requirement.criticality})`)
        .join(", ")}.`,
    );
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

  const negativeRoleSignals = !hasSameFamily && profileFamily?.negativeTerms && hasAnyTerm(jobText, profileFamily.negativeTerms);
  let penalty = 0;

  if (languageRisk) {
    penalty += 8;
  }

  if (missingRequiredRequirements.length > 0) {
    penalty += Math.min(24, missingRequiredRequirements.length * 10);
  }

  if (negativeRoleSignals) {
    penalty += 18;
    risks.push("El aviso contiene señales de una familia laboral distinta al rol objetivo.");
  }

  const score = scoreBreakdown.skills + scoreBreakdown.experience + scoreBreakdown.family + scoreBreakdown.seniority - penalty;
  const normalizedScore = Math.max(0, Math.min(100, score));
  const priority = getPriority(normalizedScore);

  return {
    priority,
    score: normalizedScore,
    reasons: reasons.length ? reasons : ["Hay datos suficientes para una revisión inicial, pero faltan señales fuertes de encaje."],
    risks: risks.length ? risks : ["No se detectaron riesgos fuertes con la información visible."],
    missingSkills,
    matchedSkills,
    detectedRequirements,
    missingRequirements,
    requirementsByCriticality,
    scoreBreakdown,
    debug: {
      seniority: jobSeniorityDetection,
      family: {
        profile: profileFamily?.label || null,
        title: titleFamily?.label || null,
        detected: jobFamilies.map((family) => family.label),
        conflict: familyConflict,
        finalRule: hasSameFamily ? "same-family-wins" : hasDifferentKnownFamily ? "different-family" : "insufficient-family-signal",
      },
      scoreBreakdown,
      rulesFired,
    },
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
          "Usa ponderación aproximada: skills/herramientas 40%, experiencia requerida 30%, familia profesional 20%, seniority 10%.",
          "Clasifica requisitos por criticidad: required si dice Excluyente/Must Have/Required/Mandatory/Essential; important si es herramienta principal; nice-to-have si dice Deseable/Nice to Have/Plus/Preferred.",
          "Faltar requisitos required debe impactar mucho más que faltar requisitos nice-to-have.",
          "Explica skills coincidentes, requisitos detectados y riesgos reales. No digas que el rol no está alineado si hay fuerte coincidencia de skills y familia QA.",
          "Si hay idioma requerido o implícito, marca riesgo si el perfil no alcanza.",
          'Devuelve JSON con: {"priority":"Alta|Media|Baja|Revisar","score":0-100,"reasons":[""],"risks":[""],"missingSkills":[""],"recommendation":""}.',
          "Perfil:",
          JSON.stringify(profile),
          "Puesto:",
          JSON.stringify({
            ...job,
            description: clampText(job.description || "", 9000),
            requirements: clampText(job.requirements || "", 2500),
            responsibilities: clampText(job.responsibilities || "", 2500),
            benefits: clampText(job.benefits || "", 1500),
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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
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

  return NextResponse.json(result, { headers: corsHeaders });
}
