"use client";

import { useEffect, useMemo, useState } from "react";

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
  role: "Data Analyst",
  location: "Buenos Aires, Argentina",
  workMode: "Remoto",
  seniority: "Semi Senior",
  skills: "SQL, Power BI, Excel",
  language: "No especificado",
};

const rolePatterns: Array<[RegExp, string]> = [
  [/data analyst|business intelligence|bi analyst/i, "Data Analyst"],
  [/qa automation|automation qa|sdet/i, "QA Automation"],
  [/frontend|front end|react/i, "Frontend Developer"],
  [/backend|back end|node/i, "Backend Developer"],
  [/product manager|product owner/i, "Product Manager"],
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

const languagePatterns: Array<[RegExp, string]> = [
  [/(english|ingl[eé]s)[^.;,\n]{0,40}(advanced|avanzado|c1|c2|bilingual|biling[uü]e)|(advanced|avanzado|c1|c2|bilingual|biling[uü]e)[^.;,\n]{0,40}(english|ingl[eé]s)/i, "Inglés avanzado"],
  [/(english|ingl[eé]s)[^.;,\n]{0,40}(intermediate|intermedio|b1|b2)|(intermediate|intermedio|b1|b2)[^.;,\n]{0,40}(english|ingl[eé]s)/i, "Inglés intermedio"],
  [/(english|ingl[eé]s)[^.;,\n]{0,40}(basic|b[aá]sico|a1|a2)|(basic|b[aá]sico|a1|a2)[^.;,\n]{0,40}(english|ingl[eé]s)/i, "Inglés básico"],
  [/(portuguese|portugu[eé]s)[^.;,\n]{0,40}(advanced|avanzado|c1|c2|bilingual|biling[uü]e)|(advanced|avanzado|c1|c2|bilingual|biling[uü]e)[^.;,\n]{0,40}(portuguese|portugu[eé]s)/i, "Portugués avanzado"],
  [/(portuguese|portugu[eé]s)[^.;,\n]{0,40}(intermediate|intermedio|b1|b2)|(intermediate|intermedio|b1|b2)[^.;,\n]{0,40}(portuguese|portugu[eé]s)/i, "Portugués intermedio"],
  [/(portuguese|portugu[eé]s)[^.;,\n]{0,40}(basic|b[aá]sico|a1|a2)|(basic|b[aá]sico|a1|a2)[^.;,\n]{0,40}(portuguese|portugu[eé]s)/i, "Portugués básico"],
];

const workModeOptions = ["Remoto", "Hibrido", "Presencial", "Cualquiera"];
const seniorityOptions = ["Trainee", "Junior", "Semi Senior", "Senior", "Lead"];
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
];

const localStorageKey = "job-match-ai.cv-versions";

function parseSkills(skills: string) {
  return skills
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
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

function loadCvVersions(): CvVersion[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const storedVersions = window.localStorage.getItem(localStorageKey);

    if (!storedVersions) {
      return [];
    }

    const parsed = JSON.parse(storedVersions) as CvVersion[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((version) => version && version.id && version.profile)
      .map((version) => ({
        ...version,
        profile: normalizeProfile(version.profile),
      }));
  } catch {
    return [];
  }
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

  const looseMatches = text
    .split(/[,\n•;|]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 1)
    .filter((segment) => segment.length <= 24)
    .slice(0, 5);

  return looseMatches.join(", ");
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

function buildCvDraft(builder: CvBuilderState, profile: CvProfile) {
  const lines = [
    builder.fullName ? builder.fullName : "Nombre completo",
    builder.headline ? builder.headline : `${profile.role} | ${profile.seniority}`,
    "",
    "Perfil profesional",
    builder.summary || `Perfil orientado a ${profile.role} con foco en ${parseSkills(profile.skills).slice(0, 3).join(", ")}.`,
    "",
    "Experiencia",
    builder.experience || "Agrega aquí tu experiencia más relevante, logros y alcance.",
    "",
    "Educación",
    builder.education || "Agrega tu formación académica o certificaciones.",
    "",
    "Skills",
    builder.achievements || profile.skills,
    "",
    "Ubicación",
    profile.location,
    "Modalidad preferida",
    profile.workMode,
    "Seniority",
    profile.seniority,
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

function buildSuggestions(filters: SearchFilters): SearchSuggestion[] {
  const skills = parseSkills(filters.skills);
  const primarySkills = skills.slice(0, 3);
  const secondarySkills = skills.slice(0, 2);
  const languageTerms = filters.language === "No especificado" ? [] : [filters.language];
  const baseTerms = [filters.role, filters.seniority, filters.location, filters.workMode, ...languageTerms].filter(Boolean);
  const roleOnlyTerms = [filters.role, filters.location, filters.workMode, ...languageTerms].filter(Boolean);
  const skillsFirstTerms = [filters.role, filters.location, filters.workMode, ...secondarySkills, ...languageTerms].filter(Boolean);
  const wideTerms = [filters.role, filters.location].filter(Boolean);
  const conservativeTerms = [filters.role, filters.seniority, filters.location, ...languageTerms, ...skills.slice(0, 1)].filter(Boolean);

  const suggestions = [
    {
      title: "Vacantes exactas",
      terms: [...baseTerms, ...primarySkills],
      note: "Lista filtrada más precisa. Prioriza el match con el perfil detectado.",
    },
    {
      title: "Skills primero",
      terms: skillsFirstTerms,
      note: "Amplía el foco hacia vacantes donde importan más las herramientas que el título exacto.",
    },
    {
      title: "Rol puro",
      terms: roleOnlyTerms,
      note: "Busca por título y contexto básico sin empujar demasiado el filtro de skills.",
    },
    {
      title: "Exploración amplia",
      terms: wideTerms,
      note: "Abre más resultados para ver variantes cercanas del rol y del mercado.",
    },
    {
      title: "Encaje conservador",
      terms: conservativeTerms,
      note: "Reduce ruido y deja solo búsquedas muy cercanas al perfil validado.",
    },
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
    };
  });
}

export default function Home() {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [cvText, setCvText] = useState("");
  const [cvFileName, setCvFileName] = useState("");
  const [cvStatus, setCvStatus] = useState("Pega el texto del CV o sube un archivo para autocompletar el formulario.");
  const [isParsingCv, setIsParsingCv] = useState(false);
  const [cvVersions, setCvVersions] = useState<CvVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [cvBuilder, setCvBuilder] = useState<CvBuilderState>({
    fullName: "",
    headline: "",
    summary: "",
    experience: "",
    education: "",
    achievements: "",
  });
  const suggestions = buildSuggestions(filters);
  const skillList = parseSkills(filters.skills);
  const profilePreview = useMemo(() => parseCvText(cvText), [cvText]);
  const confirmedProfile = useMemo(() => normalizeProfile({ ...profilePreview, ...filters }), [filters, profilePreview]);
  const selectedVersion = cvVersions.find((version) => version.id === selectedVersionId) ?? cvVersions[0];
  const currentCvDraft = useMemo(() => buildCvDraft(cvBuilder, confirmedProfile), [cvBuilder, confirmedProfile]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedVersions = loadCvVersions();

      if (storedVersions.length === 0) {
        return;
      }

      setCvVersions(storedVersions);
      setSelectedVersionId(storedVersions[0]?.id ?? "");

      const firstVersion = storedVersions[0];
      if (firstVersion) {
        setSelectedVersionId(firstVersion.id);
        setCvText(firstVersion.profile.skills ? firstVersion.profile.skills : "");
        applyProfile(firstVersion.profile);
        setCvStatus(
          `Se cargó el historial guardado con ${storedVersions.length} versión${storedVersions.length === 1 ? "" : "es"}.`,
        );
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (cvVersions.length === 0) {
      return;
    }

    window.localStorage.setItem(localStorageKey, JSON.stringify(cvVersions));
  }, [cvVersions]);

  function applyProfile(profile: CvProfile) {
    const normalizedProfile = normalizeProfile(profile);

    setFilters((current) => ({
      ...current,
      ...normalizedProfile,
    }));
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
    setCvText(version.profile.skills ? version.profile.skills : cvText);
    setCvFileName(version.fileName);
    applyProfile(version.profile);
    setCvStatus(`Se cargó la versión ${version.fileName} (${version.source}).`);
  }

  const insightCards = [
    {
      label: "Rol detectado",
      value: confirmedProfile.role,
      helper: "Se usa como eje de la búsqueda y del CV base.",
    },
    {
      label: "Seniority",
      value: confirmedProfile.seniority,
      helper: "Ayuda a definir el tono y el nivel de las búsquedas.",
    },
    {
      label: "Ubicación",
      value: confirmedProfile.location,
      helper: "Se prioriza en los filtros y en el encabezado del CV.",
    },
    {
      label: "Idioma",
      value: confirmedProfile.language,
      helper: "Se puede completar manualmente si el CV no lo especifica.",
    },
    {
      label: "Skills clave",
      value: skillList.length ? `${skillList.length} detectadas` : "Sin skills",
      helper: "Sirven para el CV y para ampliar la búsqueda en LinkedIn.",
    },
  ];

  const coreBenefits = [
    "Analiza CVs en PDF, DOCX o texto",
    "Extrae un perfil estructurado y accionable",
    "Genera búsquedas de LinkedIn desde ese perfil",
    "Arma un CV base editable por secciones",
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
        result.source === "openai"
          ? `CV cargado desde ${result.fileName}. Se usó IA para extraer el perfil.`
          : `CV cargado desde ${result.fileName}. Se usaron heurísticas locales porque no había IA disponible.`,
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
          `No se pudo usar el parser del archivo. Se leyó como texto plano desde ${file.name}.`,
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
                Job Match AI · CV Intelligence
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Analiza tu CV con precisión y convierte ese perfil en oportunidades.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                La propuesta del producto arranca en el análisis del CV: extrae perfil, detecta señales clave,
                genera búsquedas accionables y construye un CV base editable. Todo en una experiencia clara, moderna y rápida.
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
              ["Rol detectado", confirmedProfile.role],
              ["Ubicación", confirmedProfile.location],
              ["Modalidad", confirmedProfile.workMode],
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
                      applyProfile(parseCvText(nextText));
                      setCvStatus(
                        nextText.trim()
                          ? "CV detectado desde texto pegado. El perfil quedó actualizado."
                          : "Pega el texto del CV o sube un archivo para autocompletar el formulario.",
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
                    El análisis del CV alimenta búsquedas, CV base y versiones históricas.
                  </span>
                  <a
                    href="#linkedin-searches"
                    className="inline-flex w-fit items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-400/20"
                  >
                    Ver búsquedas de LinkedIn
                  </a>
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
                    Si el CV no declara idioma, modalidad o seniority, completalo acá. La app usa estos datos para las búsquedas, sin modificar la experiencia real del CV.
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
                    onChange={(event) => setFilters((current) => ({ ...current, role: event.target.value }))}
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                    placeholder="Data Analyst"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-200">
                  Ubicación
                  <input
                    value={filters.location}
                    onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                    placeholder="Buenos Aires, Argentina"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-200">
                  Modalidad
                  <select
                    value={filters.workMode}
                    onChange={(event) => setFilters((current) => ({ ...current, workMode: event.target.value }))}
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
                    onChange={(event) => setFilters((current) => ({ ...current, seniority: event.target.value }))}
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                  >
                    {seniorityOptions.map((option) => (
                      <option key={option} value={option} className="bg-slate-950">
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium text-slate-200">
                  Nivel de idioma
                  <select
                    value={filters.language}
                    onChange={(event) => setFilters((current) => ({ ...current, language: event.target.value }))}
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
                  Skills clave
                  <input
                    value={filters.skills}
                    onChange={(event) => setFilters((current) => ({ ...current, skills: event.target.value }))}
                    className="h-11 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                    placeholder="SQL, Power BI, Excel"
                  />
                </label>
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
                    Historial de CV
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Conserva versiones previas y evita reprocesar archivos idénticos.
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
              Hallazgos del CV con salida accionable
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              El usuario ve rápido qué entendió la app y qué acciones puede tomar después: buscar, editar el CV o volver a cargar otra versión.
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
                  ]
                    .filter(Boolean)
                    .map((signal) => (
                      <span
                        key={signal}
                        className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-100"
                      >
                        {signal}
                      </span>
                    ))}
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
                  Con este perfil la app puede abrir búsquedas relevantes, comparar cambios del CV y seguir refinando la presentación profesional.
                </p>
              </div>

              <div id="linkedin-searches" className="rounded-[1.5rem] border border-white/10 bg-slate-950/45 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Búsquedas derivadas
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Estas opciones no son una vacante puntual. Cada una abre una lista de oportunidades filtradas en LinkedIn con distinto nivel de precisión.
                </p>
                <div className="mt-4 grid gap-3">
                  {suggestions.map((search) => (
                    <article key={search.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-white">{search.title}</h3>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                          {search.match}
                        </span>
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
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
