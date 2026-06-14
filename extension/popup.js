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

function renderResult(result, job) {
  resultBox.classList.remove("hidden");
  resultBox.innerHTML = `
    <div class="score">
      <span>${result.priority}</span>
      <strong>${result.score}/100</strong>
    </div>
    <h2>${job.title || "Puesto visible"}</h2>
    <p class="muted">${[job.company, job.location].filter(Boolean).join(" · ")}</p>
    <p class="capture">${job.description ? "Descripción capturada" : "Solo datos visibles parciales"} · ${job.criteria?.length || 0} criterio${job.criteria?.length === 1 ? "" : "s"} visible${job.criteria?.length === 1 ? "" : "s"}</p>
    <h3>Por qué puede encajar</h3>
    <ul>${(result.reasons || []).map((item) => `<li>${item}</li>`).join("")}</ul>
    <h3>Riesgos a revisar</h3>
    <ul>${(result.risks || []).map((item) => `<li>${item}</li>`).join("")}</ul>
    ${
      result.missingSkills?.length
        ? `<h3>Skills no visibles</h3><p class="chips">${result.missingSkills.map((skill) => `<span>${skill}</span>`).join("")}</p>`
        : ""
    }
    <h3>Recomendación</h3>
    <p>${result.recommendation || "Revisá el aviso completo antes de postular."}</p>
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
