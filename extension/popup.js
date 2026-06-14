const defaultApiBase = "http://localhost:3000";
const apiBaseInput = document.getElementById("apiBase");
const profileInput = document.getElementById("profile");
const saveButton = document.getElementById("saveProfile");
const analyzeButton = document.getElementById("analyze");
const statusBox = document.getElementById("status");
const resultBox = document.getElementById("result");

function setStatus(message) {
  statusBox.textContent = message;
}

function renderRequirementList(title, requirements) {
  if (!requirements?.length) return "";

  return `
    <h3>${title}</h3>
    <ul class="requirements">
      ${requirements
        .map(
          (requirement) => `
            <li class="${requirement.matched ? "ok" : "missing"}">
              <strong>${requirement.matched ? "✓" : "✗"} ${requirement.name}</strong>
              <span>${requirement.evidence || ""}</span>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
}

function renderResult(result, job) {
  const debug = job.debug?.analysisText || job.debug?.description || {};
  const breakdown = result.scoreBreakdown || {};
  const requirementGroups = result.requirementsByCriticality || {};
  resultBox.classList.remove("hidden");
  resultBox.innerHTML = `
    <div class="score">
      <span>${result.priority}</span>
      <strong>${result.score}/100</strong>
    </div>
    <h2>${job.title || "Puesto visible"}</h2>
    <p class="muted">${[job.company, job.location].filter(Boolean).join(" · ")}</p>
    <p class="capture">${job.description ? "Descripción capturada" : "Solo datos visibles parciales"} · ${debug.characters || 0} caracteres · ${debug.words || 0} palabras · ${job.criteria?.length || 0} criterio${job.criteria?.length === 1 ? "" : "s"} visible${job.criteria?.length === 1 ? "" : "s"}</p>
    <div class="breakdown">
      <span>Skills ${breakdown.skills ?? "-"}/40</span>
      <span>Experiencia ${breakdown.experience ?? "-"}/30</span>
      <span>Familia ${breakdown.family ?? "-"}/20</span>
      <span>Seniority ${breakdown.seniority ?? "-"}/10</span>
    </div>
    <h3>Por qué puede encajar</h3>
    <ul>${(result.reasons || []).map((item) => `<li>${item}</li>`).join("")}</ul>
    <h3>Riesgos a revisar</h3>
    <ul>${(result.risks || []).map((item) => `<li>${item}</li>`).join("")}</ul>
    ${renderRequirementList("Requisitos excluyentes", requirementGroups.required)}
    ${renderRequirementList("Requisitos importantes", requirementGroups.important)}
    ${renderRequirementList("Requisitos deseables", requirementGroups.niceToHave)}
    ${
      result.matchedSkills?.length
        ? `<h3>Skills detectadas</h3><p class="chips">${result.matchedSkills.map((skill) => `<span>${skill}</span>`).join("")}</p>`
        : ""
    }
    ${
      result.missingSkills?.length
        ? `<h3>Skills no visibles</h3><p class="chips">${result.missingSkills.map((skill) => `<span>${skill}</span>`).join("")}</p>`
        : ""
    }
    ${
      result.missingRequirements?.length
        ? `<h3>Requisitos no cubiertos</h3><p class="chips">${result.missingRequirements.map((item) => `<span>${item}</span>`).join("")}</p>`
        : ""
    }
    <h3>Recomendación</h3>
    <p>${result.recommendation || "Revisá el aviso completo antes de postular."}</p>
    <details>
      <summary>Debug de captura</summary>
      <p class="muted">Primeros 500 caracteres</p>
      <pre>${debug.first500 || "Sin texto capturado"}</pre>
      <p class="muted">Últimos 500 caracteres</p>
      <pre>${debug.last500 || "Sin texto capturado"}</pre>
    </details>
    <p class="muted">Análisis: ${result.source}</p>
  `;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractVisibleJob(tabId) {
  return chrome.tabs.sendMessage(tabId, { type: "MATCH_LABORAL_EXTRACT_JOB" });
}

async function loadStoredState() {
  const stored = await chrome.storage.local.get(["apiBase", "profile"]);
  apiBaseInput.value = stored.apiBase || defaultApiBase;
  profileInput.value = stored.profile ? JSON.stringify(stored.profile, null, 2) : "";
}

async function saveProfile() {
  try {
    const profile = JSON.parse(profileInput.value);
    const apiBase = apiBaseInput.value.trim() || defaultApiBase;

    await chrome.storage.local.set({ profile, apiBase });
    setStatus("Perfil guardado. Ya podés analizar un puesto visible.");
  } catch {
    setStatus("El perfil no es JSON válido. Copialo de nuevo desde la app.");
  }
}

async function analyzeVisibleJob() {
  resultBox.classList.add("hidden");
  setStatus("Leyendo puesto visible...");

  const stored = await chrome.storage.local.get(["apiBase", "profile"]);

  if (!stored.profile) {
    setStatus("Primero pegá y guardá el perfil exportado desde la app.");
    return;
  }

  const tab = await getActiveTab();

  if (!tab?.id || !tab.url?.startsWith("https://www.linkedin.com/jobs/")) {
    setStatus("Abrí un puesto o búsqueda de LinkedIn Jobs antes de analizar.");
    return;
  }

  let extracted;
  try {
    extracted = await extractVisibleJob(tab.id);
  } catch {
    setStatus("No pude leer la página. Recargá LinkedIn y probá otra vez.");
    return;
  }

  const job = extracted?.job;

  if (!job?.title && !job?.description) {
    setStatus("No encontré un puesto visible para analizar.");
    return;
  }

  setStatus("Analizando match...");

  try {
    const apiBase = stored.apiBase || defaultApiBase;
    const response = await fetch(`${apiBase.replace(/\/$/, "")}/api/job-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile: stored.profile, job }),
    });

    if (!response.ok) {
      throw new Error("Request failed");
    }

    const result = await response.json();
    setStatus("Análisis listo.");
    renderResult(result, job);
  } catch {
    setStatus("No pude conectar con la app. Verificá que esté corriendo en la URL configurada.");
  }
}

saveButton.addEventListener("click", saveProfile);
analyzeButton.addEventListener("click", analyzeVisibleJob);

void loadStoredState();
