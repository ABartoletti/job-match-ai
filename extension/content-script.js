function textFrom(selector) {
  const element = document.querySelector(selector);
  return cleanText(element ? element.textContent : "");
}

function cleanText(value) {
  return (value || "").trim().replace(/\s+/g, " ");
}

function uniqueTexts(selector, limit = 10) {
  const seen = new Set();
  return Array.from(document.querySelectorAll(selector))
    .map((element) => cleanText(element.textContent))
    .filter((text) => text.length > 1)
    .filter((text) => {
      const key = text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function textStats(text) {
  const clean = cleanText(text);
  const words = clean ? clean.split(/\s+/).length : 0;

  return {
    characters: clean.length,
    words,
    first500: clean.slice(0, 500),
    last500: clean.slice(Math.max(0, clean.length - 500)),
  };
}

function extractSections(description) {
  const sectionLabels = {
    requirements: /(requirements|requisitos|qualifications|what you need|must have|skills requeridas|conocimientos)/i,
    responsibilities: /(responsibilities|responsabilidades|what you will do|funciones|tareas|role overview)/i,
    benefits: /(benefits|beneficios|what we offer|ofrecemos|perks)/i,
  };
  const sections = {
    requirements: "",
    responsibilities: "",
    benefits: "",
  };
  const parts = description.split(/(?=(?:requirements|requisitos|qualifications|responsibilities|responsabilidades|benefits|beneficios|what you will do|what we offer|ofrecemos)\b)/i);

  for (const part of parts) {
    const text = cleanText(part);
    if (!text) continue;

    if (sectionLabels.requirements.test(text) && !sections.requirements) {
      sections.requirements = text.slice(0, 2500);
    } else if (sectionLabels.responsibilities.test(text) && !sections.responsibilities) {
      sections.responsibilities = text.slice(0, 2500);
    } else if (sectionLabels.benefits.test(text) && !sections.benefits) {
      sections.benefits = text.slice(0, 2000);
    }
  }

  return sections;
}

function firstMeaningfulText(selectors) {
  for (const selector of selectors) {
    const text = textFrom(selector);
    if (text) return text;
  }

  return "";
}

function extractJobFromVisiblePage() {
  const title = firstMeaningfulText([
    ".jobs-unified-top-card__job-title",
    ".job-details-jobs-unified-top-card__job-title",
    ".jobs-details__main-content h1",
    "h1",
  ]);

  const company = firstMeaningfulText([
    ".jobs-unified-top-card__company-name",
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-details-top-card__company-url",
    "[class*='company-name']",
  ]);

  const location = firstMeaningfulText([
    ".jobs-unified-top-card__bullet",
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".jobs-details-top-card__bullet",
    "[class*='job-card-container__metadata']",
  ]);

  const descriptionElement =
    document.querySelector(".jobs-description__content") ||
    document.querySelector(".jobs-description") ||
    document.querySelector(".jobs-box__html-content") ||
    document.querySelector(".jobs-description-content__text") ||
    document.querySelector("#job-details");

  const description = descriptionElement ? cleanText(descriptionElement.textContent).slice(0, 9000) : "";
  const sections = extractSections(description);
  const workplaceInsights = uniqueTexts(".job-details-fit-level-preferences button, .job-details-fit-level-preferences li, .jobs-unified-top-card__job-insight, .job-details-jobs-unified-top-card__job-insight", 12);
  const criteria = uniqueTexts(".job-details-how-you-match-card__container li, .job-details-how-you-match-card__container span, .jobs-details-job-summary__text", 12);
  const visibleSummary = [title, company, location, ...workplaceInsights, ...criteria].filter(Boolean).join(" · ");
  const analysisText = [
    title,
    company,
    location,
    description,
    sections.requirements,
    sections.responsibilities,
    sections.benefits,
    ...workplaceInsights,
    ...criteria,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title,
    company,
    location,
    description: description || visibleSummary,
    requirements: sections.requirements,
    responsibilities: sections.responsibilities,
    benefits: sections.benefits,
    visibleSummary,
    workplaceInsights,
    criteria,
    debug: {
      description: textStats(description),
      analysisText: textStats(analysisText),
      selectors: {
        descriptionFound: Boolean(descriptionElement),
      },
    },
    sourceUrl: window.location.href,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "MATCH_LABORAL_EXTRACT_JOB") {
    return false;
  }

  sendResponse({ job: extractJobFromVisiblePage() });
  return false;
});
