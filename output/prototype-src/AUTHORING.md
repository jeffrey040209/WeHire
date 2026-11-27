# Authoring the WeHire screening prototype

The PDF has 28 pages. Candidate interaction is limited to source screens 02
(Resume Submission), 04 (Clarification Response) and 05 (DISC Result Upload).
Keep the green candidate-input theme and purple HR theme in styles.css.

Source IDs remain stable. Screens 01, 03, 06, 22, 33 and 34 are retained as legacy
source references but excluded from all full PDF builds. Do not reintroduce job
search, application tracking, candidate chat, profile management or result pages.

HR vacancies are approved internal screening configurations, not public WeHire
job postings. External job-platform integrations are outside this prototype.

Use `build.py --preview 2 4 5` for targeted previews and overflow checks.
Use `build.py` for a complete rebuild after authorisation. The PDF uses consecutive
page numbers independent of source IDs. Review every rendered page before delivery.
