# Job Match AI - Agent guidance

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may differ from older Next.js versions. Read the relevant guide in `node_modules/next/dist/docs/` before writing framework-sensitive code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Product rules

- Build for job seekers first, not recruiters.
- Do not promise employment or hiring outcomes.
- Never invent work experience, skills, education, or certifications for a user.
- Recommendations must be explainable and action-oriented.
- Treat CVs, work history, contact data, and job-search activity as private user data.
- LinkedIn integration must avoid storing LinkedIn credentials or scraping LinkedIn from the backend.
- Prefer assisted LinkedIn search URLs in the MVP, then evaluate a browser extension for visible-page analysis.

## Technical rules

- Use TypeScript and keep components typed.
- Prefer simple server/client boundaries until interactivity requires client components.
- Keep product logic separate from UI when it becomes non-trivial.
- Run `npm.cmd run lint` before considering code changes complete.
- Use `npm.cmd` on Windows PowerShell because `npm.ps1` may be blocked by execution policy.

