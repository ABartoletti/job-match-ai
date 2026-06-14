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
    document.querySelector(".jobs-box__html-content") ||
    document.querySelector("#job-details");

  const description = descriptionElement ? cleanText(descriptionElement.textContent).slice(0, 9000) : "";
  const workplaceInsights = uniqueTexts(".job-details-fit-level-preferences button, .job-details-fit-level-preferences li, .jobs-unified-top-card__job-insight, .job-details-jobs-unified-top-card__job-insight", 12);
  const criteria = uniqueTexts(".job-details-how-you-match-card__container li, .job-details-how-you-match-card__container span, .jobs-details-job-summary__text", 12);
  const visibleSummary = [title, company, location, ...workplaceInsights, ...criteria].filter(Boolean).join(" · ");

  return {
    title,
    company,
    location,
    description: description || visibleSummary,
    visibleSummary,
    workplaceInsights,
    criteria,
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
