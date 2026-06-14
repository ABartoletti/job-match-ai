function textFrom(selector) {
  const element = document.querySelector(selector);
  return element ? element.textContent.trim().replace(/\s+/g, " ") : "";
}

function extractJobFromVisiblePage() {
  const title =
    textFrom(".jobs-unified-top-card__job-title") ||
    textFrom(".job-details-jobs-unified-top-card__job-title") ||
    textFrom("h1");

  const company =
    textFrom(".jobs-unified-top-card__company-name") ||
    textFrom(".job-details-jobs-unified-top-card__company-name") ||
    textFrom("[class*='company-name']");

  const location =
    textFrom(".jobs-unified-top-card__bullet") ||
    textFrom(".job-details-jobs-unified-top-card__primary-description-container") ||
    textFrom("[class*='job-card-container__metadata']");

  const descriptionElement =
    document.querySelector(".jobs-description__content") ||
    document.querySelector(".jobs-box__html-content") ||
    document.querySelector("#job-details") ||
    document.querySelector("[class*='jobs-description']");

  const description = descriptionElement
    ? descriptionElement.textContent.trim().replace(/\s+/g, " ")
    : document.body.innerText.trim().replace(/\s+/g, " ").slice(0, 7000);

  return {
    title,
    company,
    location,
    description,
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
