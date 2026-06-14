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
