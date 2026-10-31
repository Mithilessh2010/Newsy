# Contributing to Equal Horizons

Thanks for taking an interest in the project. It brings together very different things—news, civic information, archival research, a globe—and we want changes to improve both usability and trust.

## Before you open a PR

- **Bug fixes:** Describe a reproducible problem. Include browser, route, and steps to reproduce it.
- **Source integrations:** Link to the official documentation and note whether a key, commercial license, approval, or attribution is required. Normalize results in the server adapter. No arbitrary user-supplied upstream URL requests.
- **UI changes:** Keep navigation keyboard-friendly, maintain mobile layouts, honor `prefers-reduced-motion`, and show helpful empty/loading/error states. Use precise copy; avoid made-up statistics or headlines.
- **Data / documents:** Preserve source URLs and dates. Verify usage rights. Don't paste complete articles or private documents into the repository.

## Set up

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

If a build fails, please include the exact error in your PR. Avoid saying "fully tested" if you only ran some of the checks.

## Pull request description

Tell us: **What changed? Why? How did you verify it?** Include screenshots if it affects the interface. For new providers, include a mocked API response test and the original provider documentation.

## Issues to start with

Improving language access, adding government datasets with clear licenses, preventing broken original-source links, refining geolocation, and making mobile reading faster are all valuable areas.

Security vulnerabilities should be reported privately to the maintainers; please don't publish tokens, personal data, or exploit details in an issue.
