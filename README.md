# Job Match AI

Job Match AI is a CV-analysis-first job search assistant.

It reads a CV, extracts the professional profile, and uses that profile to generate LinkedIn searches and an editable CV base.

## Getting Started

First, run the development server:

```bash
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Optional AI CV analysis

Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY` if you want the app to use OpenAI for CV analysis.
When the key is not present, the app falls back to local heuristics and still generates LinkedIn searches.

Only the CV analysis step uses AI. The LinkedIn search generation remains deterministic and does not require a model.

## Product Direction

The product is built for job seekers first. It should help users understand their profile, refine their CV, and open explainable, action-oriented LinkedIn searches without promising employment outcomes.

## Deploy on Vercel

The simplest path beyond local development is deploying the Next.js app on Vercel.

Set `OPENAI_API_KEY` as an environment variable in the deployment platform if AI CV analysis should be enabled in production.

## Local LinkedIn extension MVP

This repo includes a local Chrome extension MVP in `extension/`.

To test it:

1. Run the app with `npm.cmd run dev`.
2. Open Chrome and go to `chrome://extensions`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select the `extension/` folder.
6. In the app, load or paste a CV, confirm the search criteria, and click Copy profile.
7. Open a LinkedIn Jobs posting.
8. Open the extension popup, paste the copied profile, save it, and click Analyze visible job.

The extension only analyzes the currently visible job when the user clicks the button. It does not automate navigation, scrape lists in bulk, or ask for LinkedIn credentials.
