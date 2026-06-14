"use client";

import { useMemo, useState } from "react";

type SearchFilters = {
  role: string;
  location: string;
  workMode: string;
  seniority: string;
  skills: string;
  language: string;
};

type SearchSuggestion = {
  title: string;
  query: string;
  url: string;
  match: string;
  score: number;
  note: string;
  group: string;
};

type CvProfile = {
  role: string;
  location: string;
  workMode: string;
  seniority: string;
  skills: string;
  language: string;
};

type CvVersion = {
  id: string;
  fileName: string;
  fingerprint: string;
  source: "openai" | "heuristic" | "text";
  createdAt: string;
  profile: CvProfile;
};

type CvBuilderState = {
  fullName: string;
  headline: string;
  summary: string;
  experience: string;
  education: string;
  achievements: string;
};

const initialFilters: SearchFilters = {
  role: "",
  location: "",
  workMode: "Cualquiera",
  seniority: "",
  skills: "",
  language: "No especificado",
};

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
  [/\b(trainee|intern|practicante)\b/i, "Trainee"],
  [/\b(junior|jr\.?)\b/i, "Junior"],
  [/\b(semi senior|semi-senior|ssr\.?)\b/i, "Semi Senior"],
  [/\b(senior|sr\.?)\b/i, "Senior"],
  [/\b(lead|principal|staff)\b/i, "Lead"],
];

const languagePatterns: Array<[RegExp, string]> = [
  [/(english|ingl[eé]s)[^.;,\n]{0,40}(advanced|avanzado|c1|c2|bilingual|biling[uü]e)|(advanced|avanzado|c1|c2|bilingual|biling[uü]e)[^.;,\n]{0,40}(english|ingl[eé]s)/i, "Inglés avanzado"],
  [/(english|ingl[eé]s)[^.;,\n]{0,40}(intermediate|intermedio|b1|b2)|(intermediate|intermedio|b1|b2)[^.;,\n]{0,40}(english|ingl[eé]s)/i, "Inglés intermedio"],
  [/(english|ingl[eé]s)[^.;,\n]{0,40}(basic|b[aá]sico|a1|a2)|(basic|b[aá]sico|a1|a2)[^.;,\n]{0,40}(english|ingl[eé]s)/i, "Inglés básico"],
  [/(portuguese|portugu[eé]s)[^.;,\n]{0,40}(advanced|avanzado|c1|c2|bilingual|biling[uü]e)|(advanced|avanzado|c1|c2|bilingual|biling[uü]e)[^.;,\n]{0,40}(portuguese|portugu[eé]s)/i, "Portugués avanzado"],
  [/(portuguese|portugu[eé]s)[^.;,\n]{0,40}(intermediate|intermedio|b1|b2)|(intermediate|intermedio|b1|b2)[^.;,\n]{0,40}(portuguese|portugu[eé]s)/i, "Portugués intermedio"],
  [/(portuguese|portugu[eé]s)[^.;,\n]{0,40}(basic|b[aá]sico|a1|a2)|(basic|b[aá]sico|a1|a2)[^.;,\n]{0,40}(portuguese|portugu[eé]s)/i, "Portugués básico"],
];

const workModeOptions = ["Cualquiera", "Remoto", "Hibrido", "Presencial"];
const seniorityOptions = ["", "Trainee", "Junior", "Semi Senior", "Senior", "Lead"];
const languageOptions = [
  "No especificado",
  "Inglés básico",
  "Inglés intermedio",
  "Inglés avanzado",
  "Portugués básico",
  "Portugués intermedio",
  "Portugués avanzado",
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

function parseSkills(skills: string) {
  return skills
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function mergeSkills(...skillSources: string[]) {
  const seen = new Set<string>();

  return skillSources.flatMap(parseSkills).filter((skill) => {
    const key = skill.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function linkedinSearchUrl(query: string) {
  return `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(query)}`;
}

function createFingerprint(text: string) {
  let hash = 5381;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33) ^ text.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}

function createVersionId() {
  return `cv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProfile(profile: Partial<CvProfile> | null | undefined): CvProfile {
  return {
    role: profile?.role || initialFilters.role,
    location: profile?.location || initialFilters.location,
    workMode: profile?.workMode || initialFilters.workMode,
    seniority: profile?.seniority || initialFilters.seniority,
    skills: profile?.skills || initialFilters.skills,
    language: profile?.language || initialFilters.language,
  };
}

function extractValue(patterns: Array<[RegExp, string]>, text: string, fallback: string) {
  const match = patterns.find(([pattern]) => pattern.test(text));
  return match ? match[1] : fallback;
}

function extractSkills(text: string) {
  const matches = skillDictionary.filter((skill) => {
    const pattern = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\./g, "\\.")}\\b`, "i");
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
    role: extractValue(rolePatterns, normalizedText, initialFilters.role),
    location: extractValue(locationPatterns, normalizedText, initialFilters.location),
    workMode: normalizedText.match(/remote|remoto/i)
      ? "Remoto"
      : normalizedText.match(/hybrid|hibrido|híbrido/i)
        ? "Hibrido"
        : normalizedText.match(/onsite|presencial/i)
          ? "Presencial"
          : initialFilters.workMode,
    seniority: extractValue(seniorityPatterns, normalizedText, initialFilters.seniority),
    skills: extractSkills(normalizedText) || initialFilters.skills,
    language: extractValue(languagePatterns, normalizedText, initialFilters.language),
  };
}

function profileHasData(profile: CvProfile) {
  return Boolean(profile.role || profile.location || profile.seniority || profile.skills || profile.language !== "No especificado");
}

function buildCvDraft(builder: CvBuilderState, profile: CvProfile) {
  const headlineFallback = [profile.role, profile.seniority].filter(Boolean).join(" | ") || "Título profesional";
  const focusSkills = parseSkills(profile.skills).slice(0, 3).join(", ");

  const lines = [
    builder.fullName ? builder.fullName : "Nombre completo",
    builder.headline ? builder.headline : headlineFallback,
    "",
    "Perfil profesional",
    builder.summary ||
      (profile.role
        ? `Perfil orientado a ${profile.role}${focusSkills ? ` con foco en ${focusSkills}` : ""}.`
        : "Agrega un resumen profesional breve y verificable."),
    "",
    "Experiencia",
    builder.experience || "Agrega aquí tu experiencia más relevante, logros y alcance.",
    "",
    "Educación",
    builder.education || "Agrega tu formación académica o certificaciones.",
    "",
    "Skills",
    builder.achievements || profile.skills || "Agrega skills verificables del CV.",
    "",
    "Ubicación",
    profile.location || "No especificada",
    "Modalidad preferida",
    profile.workMode,
    "Seniority",
    profile.seniority || "No especificado",
    "Idiomas",
    profile.language,
  ];

  return lines.join("\n");
}

function getMatchLabel(score: number) {
  if (score >= 82) return "Postulate ahora";
  if (score >= 68) return "Buena oportunidad";
  if (score >= 52) return "Posible";
  return "Baja prioridad";
}

function displayValue(value: string, fallback = "Pendiente") {
  return value.trim() ? value : fallback;
}

function languageTermsForSearch(language: string) {
  if (language === "Inglés avanzado") return ["inglés avanzado"];
  if (language === "Inglés intermedio") return ["inglés intermedio"];
  if (language === "Portugués avanzado") return ["portugués avanzado"];
  if (language === "Portugués intermedio") return ["portugués intermedio"];

  return [];
}

function relatedRolesForSkills(role: string, skills: string[]) {
  const normalizedRole = role.toLowerCase();
  const normalizedSkills = skills.map((skill) => skill.toLowerCase());
  const relatedRoles = new Set<string>();

  if (normalizedRole.includes("data") || normalizedSkills.some((skill) => ["sql", "power bi", "tableau", "looker", "python", "excel"].includes(skill))) {
    relatedRoles.add("Business Intelligence Analyst");
    relatedRoles.add("Reporting Analyst");
    relatedRoles.add("Analytics Specialist");
  }

  if (normalizedRole.includes("frontend") || normalizedSkills.some((skill) => ["react", "typescript", "javascript", "next.js", "html", "css"].includes(skill))) {
    relatedRoles.add("React Developer");
    relatedRoles.add("Frontend Engineer");
  }

  if (normalizedRole.includes("backend") || normalizedSkills.some((skill) => ["node.js", "rest", "postgresql", "mysql", "mongodb"].includes(skill))) {
    relatedRoles.add("Node.js Developer");
    relatedRoles.add("Backend Engineer");
  }

  if (normalizedRole.includes("qa") || normalizedSkills.some((skill) => ["selenium", "cypress", "playwright"].includes(skill))) {
    relatedRoles.add("QA Analyst");
    relatedRoles.add("QA Automation Engineer");
  }

  relatedRoles.delete(role);
  return Array.from(relatedRoles).slice(0, 5);
}

function buildSuggestions(filters: SearchFilters): SearchSuggestion[] {
  const skills = parseSkills(filters.skills);
  const cleanRole = filters.role.trim();

  if (!cleanRole) {
    return [];
  }

  const primarySkills = skills.slice(0, 4);
  const secondarySkills = skills.slice(0, 3);
  const languageTerms = languageTermsForSearch(filters.language);
  const seniorityTerms = filters.seniority ? [filters.seniority] : [];
  const workModeTerms = filters.workMode === "Cualquiera" ? [] : [filters.workMode];
  const relatedRoles = relatedRolesForSkills(cleanRole, skills);
  const baseTerms = [cleanRole, ...seniorityTerms, filters.location, ...workModeTerms, ...languageTerms].filter(Boolean);
  const roleOnlyTerms = [cleanRole, filters.location, ...workModeTerms, ...languageTerms].filter(Boolean);
  const skillsFirstTerms = [cleanRole, filters.location, ...workModeTerms, ...secondarySkills, ...languageTerms].filter(Boolean);
  const wideTerms = [cleanRole, filters.location].filter(Boolean);
  const conservativeTerms = [cleanRole, ...seniorityTerms, filters.location, ...languageTerms, ...skills.slice(0, 1)].filter(Boolean);

  const suggestions = [
    {
      title: "Vacantes exactas",
      group: "Prioridad",
      terms: [...baseTerms, ...primarySkills],
      note: "Búsqueda principal. Revisá la descripción: LinkedIn no siempre explicita el nivel real de idioma requerido.",
    },
    {
      title: "Skills primero",
      group: "Prioridad",
      terms: skillsFirstTerms,
      note: "Útil cuando el título del puesto varía, pero conviene validar idioma y seniority antes de postular.",
    },
    {
      title: "Rol puro",
      group: "Volumen",
      terms: roleOnlyTerms,
      note: "Trae más resultados. Puede incluir puestos en inglés o con requisitos implícitos no filtrables desde la URL.",
    },
    {
      title: "Exploración amplia",
      group: "Volumen",
      terms: wideTerms,
      note: "Sirve para mapear mercado, no para decidir encaje sin leer requisitos.",
    },
    {
      title: "Encaje conservador",
      group: "Filtro fino",
      terms: conservativeTerms,
      note: "Reduce ruido usando rol, seniority, ubicación, idioma y skill principal cuando están definidos.",
    },
    ...skills.slice(0, 6).map((skill) => ({
      title: `${skill} + ${cleanRole}`,
      group: "Por skill",
      terms: [cleanRole, skill, filters.location, ...workModeTerms, ...languageTerms].filter(Boolean),
      note: "Busca variantes donde una skill concreta puede pesar más que el título exacto del puesto.",
    })),
    ...relatedRoles.map((relatedRole) => ({
      title: relatedRole,
      group: "Roles cercanos",
      terms: [relatedRole, filters.location, ...workModeTerms, ...skills.slice(0, 2), ...languageTerms].filter(Boolean),
      note: "Rol alternativo sugerido por skills. Usalo para ampliar opciones sin irse del foco principal.",
    })),
  ];

  return suggestions.map((suggestion, index) => {
    const query = suggestion.terms.filter(Boolean).join(" ");
    const score = Math.max(
      42,
      Math.min(96, 78 + primarySkills.length * 4 - index * 5 + (filters.workMode === "Cualquiera" ? -4 : 0)),
    );

    return {
      title: suggestion.title,
      query,
      url: linkedinSearchUrl(query),
      match: getMatchLabel(score),
      score,
      note: suggestion.note,
      group: suggestion.group,
    };
  }).filter((suggestion, index, allSuggestions) => {
    return allSuggestions.findIndex((item) => item.query.toLowerCase() === suggestion.query.toLowerCase()) === index;
  });
}

export default function Home() {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [cvText, setCvText] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [cvStatus, setCvStatus] = useState("Subí o pegá tu CV para detectar datos. Después completá los criterios y buscá en LinkedIn.");
  const [isParsingCv, setIsParsingCv] = useState(false);
  const [cvVersions, setCvVersions] = useState<CvVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [detectedProfile, setDetectedProfile] = useState<CvProfile>(initialFilters);
  const [searchedSuggestions, setSearchedSuggestions] = useState<SearchSuggestion[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [cvBuilder, setCvBuilder] = useState<CvBuilderState>({
    fullName: "",
    headline: "",
    summary: "",
    experience: "",
    education: "",
    achievements: "",
  });
  const suggestions = searchedSuggestions;
  const detectedSkillList = useMemo(() => parseSkills(detectedProfile.skills), [detectedProfile.skills]);
  const manualSkillList = useMemo(() => parseSkills(filters.skills), [filters.skills]);
  const skillList = useMemo(() => mergeSkills(detectedProfile.skills, filters.skills), [detectedProfile.skills, filters.skills]);
  const confirmedProfile = useMemo(
    () =>
      normalizeProfile({
        ...detectedProfile,
        ...filters,
        role: filters.role || detectedProfile.role,
        location: filters.location || detectedProfile.location,
        workMode: filters.workMode === "Cualquiera" ? detectedProfile.workMode || filters.workMode : filters.workMode,
        seniority: filters.seniority || detectedProfile.seniority,
        skills: skillList.join(", "),
        language: filters.language !== "No especificado" ? filters.language : detectedProfile.language,
      }),
    [detectedProfile, filters, skillList],
  );
  const selectedVersion = cvVersions.find((version) => version.id === selectedVersionId) ?? cvVersions[0];
  const currentCvDraft = useMemo(() => buildCvDraft(cvBuilder, confirmedProfile), [cvBuilder, confirmedProfile]);
  const canSearch = Boolean(confirmedProfile.role.trim());

  function applyProfile(profile: CvProfile) {
    const normalizedProfile = normalizeProfile(profile);

    setDetectedProfile(normalizedProfile);
    setFilters((current) => ({
      ...current,
      role: current.role || normalizedProfile.role,
      location: current.location || normalizedProfile.location,
      workMode: current.workMode === "Cualquiera" ? normalizedProfile.workMode || current.workMode : current.workMode,
      seniority: current.seniority || normalizedProfile.seniority,
      language: current.language !== "No especificado" ? current.language : normalizedProfile.language,
    }));
    setSearchedSuggestions([]);
    setHasSearched(false);
  }

  function updateFilters(nextFilters: Partial<SearchFilters>) {
    setFilters((current) => ({
      ...current,
      ...nextFilters,
    }));
    setSearchedSuggestions([]);
    setHasSearched(false);
  }

  function addVersion(fileName: string, text: string, profile: CvProfile, source: CvVersion["source"]) {
    const fingerprint = createFingerprint(text);

    setCvVersions((current) => {
      const existing = current[0];

      if (existing && existing.fingerprint === fingerprint) {
        return current;
      }

      const nextVersion: CvVersion = {
        id: createVersionId(),
        fileName,
        fingerprint,
        source,
        createdAt: new Date().toISOString(),
        profile,
      };

      setSelectedVersionId(nextVersion.id);

      return [nextVersion, ...current].slice(0, 6);
    });
  }

  function loadVersion(version: CvVersion) {
    setSelectedVersionId(version.id);
    setCvFileName(version.fileName);
    applyProfile(version.profile);
    setCvStatus(`Se cargó la versión ${version.fileName} (${version.source}).`);
  }

  function handleSearch() {
    const normalizedFilters = normalizeProfile(confirmedProfile);
    const nextSuggestions = buildSuggestions(normalizedFilters);

    setHasSearched(true);
    setSearchedSuggestions(nextSuggestions);

    if (nextSuggestions.length === 0) {
      setCvStatus("Completá al menos el rol objetivo para buscar en LinkedIn.");
      return;
    }

    setCvStatus("Búsquedas generadas. Elegí una opción para abrir LinkedIn en una pestaña nueva.");
  }

  async function copyExtensionProfile() {
    const payload = {
      role: confirmedProfile.role,
      location: confirmedProfile.location,
      workMode: confirmedProfile.workMode,
      seniority: confirmedProfile.seniority,
      skills: confirmedProfile.skills,
      language: confirmedProfile.language,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCvStatus("Perfil copiado. Pegalo en la extensión para analizar puestos visibles en LinkedIn.");
    } catch {
      setCvStatus("No se pudo copiar el perfil. Revisá permisos del navegador e intentá de nuevo.");
    }
  }

  const insightCards = [
    {
      label: "Rol detectado",
      value: displayValue(confirmedProfile.role),
      helper: "Se usa como eje de la búsqueda y del CV base.",
    },
    {
      label: "Seniority",
      value: displayValue(confirmedProfile.seniority),
      helper: "Ayuda a definir el tono y el nivel de las búsquedas.",
    },
    {
      label: "Ubicación",
      value: displayValue(confirmedProfile.location),
      helper: "Se prioriza en los filtros y en el encabezado del CV.",
    },
    {
      label: "Idioma",
      value: confirmedProfile.language,
      helper: "Se puede completar manualmente si el CV no lo especifica.",
    },
    {
      label: "Skills clave",
      value: skillList.length ? `${skillList.length} combinadas` : "Sin skills",
      helper: "Combina skills del CV con skills agregadas o priorizadas.",
    },
  ];

  const coreBenefits = [
    "Cargá tu CV",
    "Completá criterios faltantes",
    "Buscá cuando esté validado",
    "Revisá idioma y requisitos",
  ];

  async function handleCvFile(file: File) {
    setCvFileName(file.name);
    setIsParsingCv(true);
    setCvStatus(`Procesando ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/cv", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("No se pudo procesar el CV");
      }

      const result: { fileName: string; text: string; profile: CvProfile; source: "openai" | "heuristic" } = await response.json();
      setCvText(result.text);
      applyProfile(result.profile);
      addVersion(result.fileName, result.text, result.profile, result.source);
      setCvStatus(
        profileHasData(result.profile)
          ? result.source === "openai"
            ? `CV cargado desde ${result.fileName}. Se usó IA para extraer el perfil. Revisá y completá los criterios antes de buscar.`
            : `CV cargado desde ${result.fileName}. Se usaron heurísticas locales; revisá los campos detectados antes de buscar.`
          : `CV cargado desde ${result.fileName}, pero no se pudieron detectar datos suficientes. Completá los criterios manualmente.`,
      );
    } catch {
      try {
        const isPlainText = file.type.startsWith("text/") || /\.(txt|md|csv|json|log)$/i.test(file.name);

        if (!isPlainText) {
          setCvStatus(`No se pudo procesar ${file.name}. Pega el texto del CV para completar el perfil.`);
          return;
        }

        const fallbackText = await file.text();
        setCvText(fallbackText);
        const fallbackProfile = parseCvText(fallbackText);
        applyProfile(fallbackProfile);
        addVersion(file.name, fallbackText, fallbackProfile, "text");
        setCvStatus(
          profileHasData(fallbackProfile)
            ? `No se pudo usar el parser del archivo. Se leyó como texto plano desde ${file.name}; revisá los criterios antes de buscar.`
            : `Se leyó ${file.name} como texto plano, pero no se detectaron datos suficientes. Completá los criterios manualmente.`,
        );
      } catch {
        setCvStatus("No se pudo leer el archivo. Pega el texto del CV para completar el perfil.");
      }
    } finally {
      setIsParsingCv(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050816] text-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.20),_transparent_28%),linear-gradient(180deg,_rgba(5,8,22,0.98)_0%,_rgba(10,14,30,1)_45%,_rgba(7,10,20,1)_100%)]" />
      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-8 lg:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <span className="inline-flex items-center rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Match Laboral
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Buscá trabajo con tu CV.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Cargá tu CV, completá los datos que falten y recién después abrí búsquedas en LinkedIn con criterios revisables.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[28rem]">
              {coreBenefits.map((benefit) => (
                <div
                  key={benefit}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200 shadow-inner shadow-black/10"
                >
                  {benefit}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-5">
            {[
              ["Rol detectado", displayValue(confirmedProfile.role)],
              ["Ubicación", displayValue(confirmedProfile.location)],
              ["Modalidad", displayValue(confirmedProfile.workMode)],
              ["Idioma", confirmedProfile.language],
              ["Skills", skillList.length ? `${skillList.length} detectadas` : "Sin skills"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
                <p className="mt-2 text-sm font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        </header>

        <section id="workspace" className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <form
            onSubmit={(event) => event.preventDefault()}
            className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                  Núcleo del producto
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  Analizador de CV con entrada por archivo o texto
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  La carga de CV sigue siendo la experiencia principal. El motor lee el documento, interpreta el perfil y deja todo listo para buscar o redactar.
                </p>
              </div>
              <span className="inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
                IA + fallback seguro
              </span>
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-5 shadow-inner shadow-black/20">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Entrada del CV
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Sube un PDF, DOCX o pega texto. La UI prioriza esta función porque es donde el usuario percibe el valor real.
                  </p>
                </div>
                <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-medium text-slate-200 ring-1 ring-white/10">
                  {cvFileName || "Sin archivo"}
                </span>
              </div>

              <div className="mt-4 grid gap-4">
                <label className="grid gap-2 text-sm font-medium text-slate-200">
                  Cargar documento CV
                  <input
                    type="file"
                    accept=".txt,.md,.pdf,.doc,.docx"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleCvFile(file);
                      }
                    }}
                    className="block w-full cursor-pointer rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-200 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-400/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-cyan-100"
                  />
                </label>

                {isParsingCv ? (
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-3 text-sm font-medium text-cyan-100">
                    Analizando CV y extrayendo perfil...
                  </div>
                ) : null}

                <label className="grid gap-2 text-sm font-medium text-slate-200">
                  Pegar CV en texto
                  <textarea
                    value={cvText}
                    onChange={(event) => {
                      const nextText = event.target.value;
                      setCvText(nextText);
                      const nextProfile = parseCvText(nextText);
                      applyProfile(nextProfile);
                      setCvStatus(
                        nextText.trim()
                          ? profileHasData(nextProfile)
                            ? "CV detectado desde texto pegado. Revisá y completá los criterios antes de buscar."
                            : "Texto cargado, pero no se detectaron datos suficientes. Completá los criterios manualmente."
                          : "Subí o pegá tu CV para detectar datos. Después completá los criterios y buscá en LinkedIn.",
                      );
                    }}
                    rows={8}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40 focus:bg-slate-950"
                    placeholder="Pega aquí el contenido del CV para que la app detecte rol, seniority, ubicación y skills..."
                  />
                </label>

                <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm text-slate-300">
                  <span>{cvStatus}</span>
                  <span className="text-xs text-slate-400">
                    El análisis del CV solo prepara datos. La búsqueda real se dispara con el botón de LinkedIn.
                  </span>
                  {hasSearched ? (
                    <a
                      href="#linkedin-searches"
                      className="inline-flex w-fit items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
                    >
                      Ver búsquedas generadas
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-cyan-400/15 bg-cyan-400/10 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                    Criterios confirmados
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-white">Ajustes para filtrar mejor</h3>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
                    Si el CV infiere un rol que ya no querés priorizar, corregilo acá. El rol objetivo y los criterios manuales tienen prioridad sobre lo detectado.
                  </p>
                </div>
                <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                  Editable
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-200">
                  Rol objetivo
                  <input
                    value={filters.role}
                    onChange={(event) => updateFilters({ role: event.target.value })}
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                    placeholder="Data Analyst"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-200">
                  Ubicación
                  <input
                    value={filters.location}
                    onChange={(event) => updateFilters({ location: event.target.value })}
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                    placeholder="Buenos Aires, Argentina"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-200">
                  Modalidad
                  <select
                    value={filters.workMode}
                    onChange={(event) => updateFilters({ workMode: event.target.value })}
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                  >
                    {workModeOptions.map((option) => (
                      <option key={option} value={option} className="bg-slate-950">
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-200">
                  Seniority
                  <select
                    value={filters.seniority}
                    onChange={(event) => updateFilters({ seniority: event.target.value })}
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                  >
                    {seniorityOptions.map((option) => (
                      <option key={option} value={option} className="bg-slate-950">
                        {option || "No especificado"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-200">
                  Nivel de idioma
                  <select
                    value={filters.language}
                    onChange={(event) => updateFilters({ language: event.target.value })}
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                  >
                    {languageOptions.map((option) => (
                      <option key={option} value={option} className="bg-slate-950">
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-200">
                  Skills adicionales o prioritarias
                  <input
                    value={filters.skills}
                    onChange={(event) => updateFilters({ skills: event.target.value })}
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                    placeholder="Agregá skills que quieras priorizar"
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Skills detectadas del CV
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detectedSkillList.length ? (
                      detectedSkillList.map((skill) => (
                        <span key={skill} className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">Todavía no se detectaron skills del CV.</span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Skills usadas para buscar
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {skillList.length ? (
                      skillList.map((skill) => (
                        <span key={skill} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">Se usarán cuando el CV o el formulario tengan skills.</span>
                    )}
                  </div>
                  {manualSkillList.length ? (
                    <p className="mt-3 text-xs text-slate-400">Incluye {manualSkillList.length} skill{manualSkillList.length === 1 ? "" : "s"} agregada{manualSkillList.length === 1 ? "" : "s"} manualmente.</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={!canSearch}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-cyan-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  Generar búsquedas
                </button>
                <span className="text-sm text-slate-400">
                  {canSearch
                    ? "No abre LinkedIn todavía; solo prepara opciones para elegir."
                    : "Completá el rol objetivo para habilitar la búsqueda."}
                </span>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Extensión de LinkedIn
                    </p>
                    <p className="mt-1 text-sm text-slate-300">
                      Copiá este perfil validado y pegalo en la extensión para evaluar el puesto visible.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyExtensionProfile}
                    disabled={!profileHasData(confirmedProfile)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-4 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
                  >
                    Copiar perfil
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-5">
              {insightCards.map((card) => (
                <article key={card.label} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{card.label}</p>
                  <p className="mt-2 text-base font-semibold text-white">{card.value}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{card.helper}</p>
                </article>
              ))}
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    CVs cargados en esta sesión
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Se muestran solo durante esta sesión para comparar cargas sin traer datos viejos al iniciar.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold text-white">
                  {cvVersions.length} guardadas
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                {cvVersions.length ? (
                  cvVersions.map((version) => (
                    <button
                      key={version.id}
                      type="button"
                      onClick={() => loadVersion(version)}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        selectedVersion?.id === version.id
                          ? "border-cyan-300/40 bg-cyan-400/10"
                          : "border-white/10 bg-white/5 hover:bg-white/8"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">{version.fileName}</span>
                        <span className="text-xs font-medium text-slate-400">
                          {version.source} · {new Date(version.createdAt).toLocaleDateString("es-AR")}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-300">
                        {version.profile.role} · {version.profile.seniority} · {version.profile.location}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">Todavía no hay versiones guardadas.</p>
                )}
              </div>
            </div>

            <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    CV base editable
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    La app usa los datos del usuario para armar una versión inicial del CV, con tono profesional y estructura clara.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const draft = buildCvDraft(cvBuilder, confirmedProfile);
                    setCvText(draft);
                    const profile = parseCvText(draft);
                    applyProfile(profile);
                    addVersion("cv-borrador.txt", draft, profile, "text");
                    setCvStatus("Se generó un borrador de CV a partir de los datos actuales.");
                  }}
                  className="inline-flex h-10 items-center justify-center rounded-2xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Generar borrador
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-200 md:col-span-2">
                  Nombre completo
                  <input
                    value={cvBuilder.fullName}
                    onChange={(event) =>
                      setCvBuilder((current) => ({ ...current, fullName: event.target.value }))
                    }
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                    placeholder="Tu nombre y apellido"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-200 md:col-span-2">
                  Título profesional
                  <input
                    value={cvBuilder.headline}
                    onChange={(event) =>
                      setCvBuilder((current) => ({ ...current, headline: event.target.value }))
                    }
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                    placeholder="Data Analyst | SQL | Power BI"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-200 md:col-span-2">
                  Resumen profesional
                  <textarea
                    value={cvBuilder.summary}
                    onChange={(event) =>
                      setCvBuilder((current) => ({ ...current, summary: event.target.value }))
                    }
                    rows={3}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                    placeholder="Resumen breve de tu propuesta de valor"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-200 md:col-span-2">
                  Experiencia destacada
                  <textarea
                    value={cvBuilder.experience}
                    onChange={(event) =>
                      setCvBuilder((current) => ({ ...current, experience: event.target.value }))
                    }
                    rows={3}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                    placeholder="Rol, empresa, impacto, logros cuantificables"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-200 md:col-span-2">
                  Educación y certificaciones
                  <textarea
                    value={cvBuilder.education}
                    onChange={(event) =>
                      setCvBuilder((current) => ({ ...current, education: event.target.value }))
                    }
                    rows={3}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                    placeholder="Universidad, cursos, certificaciones"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-200 md:col-span-2">
                  Skills o logros clave
                  <textarea
                    value={cvBuilder.achievements}
                    onChange={(event) =>
                      setCvBuilder((current) => ({ ...current, achievements: event.target.value }))
                    }
                    rows={3}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                    placeholder="SQL, Power BI, optimización de reportes, automatización..."
                  />
                </label>
              </div>

              <div className="mt-4 rounded-2xl border border-white/10 bg-[#07111f] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  CV base generado
                </p>
                <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-200">
                  {currentCvDraft}
                </pre>
              </div>
            </div>
          </form>

          <aside className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
              Qué detecta y qué genera
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Revisión antes de buscar
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Confirmá que el perfil, idioma y seniority estén bien antes de abrir resultados externos.
            </p>

            <div className="mt-6 grid gap-4">
              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Perfil detectado
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    confirmedProfile.role,
                    confirmedProfile.seniority,
                    confirmedProfile.location,
                    confirmedProfile.workMode,
                    confirmedProfile.language,
                  ].filter((signal) => signal && signal !== "No especificado").length ? (
                    [
                      confirmedProfile.role,
                      confirmedProfile.seniority,
                      confirmedProfile.location,
                      confirmedProfile.workMode,
                      confirmedProfile.language,
                    ]
                      .filter((signal) => signal && signal !== "No especificado")
                      .map((signal) => (
                        <span
                          key={signal}
                          className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100"
                        >
                          {signal}
                        </span>
                      ))
                  ) : (
                    <span className="text-sm text-slate-400">Todavía no hay perfil detectado.</span>
                  )}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Skills detectadas
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {skillList.length ? (
                    skillList.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200"
                      >
                        {skill}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-400">Todavía no hay skills visibles.</span>
                  )}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Siguiente acción
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Cargá el CV, completá campos faltantes y usá el botón de búsqueda. Si una vacante está en inglés, revisá la descripción antes de postular.
                </p>
              </div>

              <div id="linkedin-searches" className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Búsquedas en LinkedIn
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Estas son búsquedas accionables, no vacantes importadas. Aparecen recién después de confirmar criterios y ayudan a explorar más volumen sin perder foco.
                </p>
                <div className="mt-4 grid gap-3">
                  {hasSearched && suggestions.length ? (
                    suggestions.map((search) => (
                      <article key={search.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-white">{search.title}</h3>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                              {search.group}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                              {search.match}
                            </span>
                          </div>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-300">{search.note}</p>
                        <p className="mt-3 rounded-xl bg-slate-950/60 px-3 py-2 text-xs text-slate-200">
                          {search.query}
                        </p>
                        <a
                          href={search.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex h-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
                        >
                          Abrir en LinkedIn
                        </a>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-400">
                      No hay búsquedas generadas todavía.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
