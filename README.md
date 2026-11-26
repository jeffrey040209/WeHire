# WeHire

WeHire is an agentic AI recruitment platform designed to help HR teams and
hiring managers create vacancies, screen resumes, prioritise applications and
review candidate screening results alongside separate DISC records. Specialist
agents coordinate bounded tasks through a shared workflow, while people approve
vacancy publication and candidate decisions.

The goal is to reduce time spent reading and organising applications, with
source-linked evidence and explanations that recruiters can review.

## Current implementation

This repository currently contains the **development scaffold only**:

- FastAPI backend with environment-based settings, CORS and a tested health endpoint.
- Next.js frontend with TypeScript, Tailwind CSS and the App Router.
- Environment examples and local development configuration.

The frontend still displays its starter page. Recruitment screens, authentication,
agent workflows, scoring, storage and DISC interpretation are **planned, not
implemented**. The sections below describe the intended product and architecture.

## Planned recruitment workflow

```mermaid
flowchart TD
    A[Hiring manager defines project, role and seniority] --> B{Choose vacancy setup}
    B -->|Manual| B0[Enter JD, requirements, compensation and scorecard]
    B -->|AI assisted| A1[Retrieve authorised project context and research market salary]
    A1 --> B1[Generate editable level specific vacancy draft]
    B0 --> C[HR and manager approve JD, requirements, salary and scorecard]
    B1 --> C
    C --> D[Publish vacancy]
    D --> E[Candidate submits resume and application answers]
    E --> F[Validate files and extract source-linked evidence]
    F --> G[Check mandatory eligibility requirements]
    F --> H[Assess match against the approved scorecard]
    G --> I[Validate evidence and screening results]
    H --> I
    I --> J[Orchestrator applies approved routing rules]
    J --> K[Manual review]
    J --> L[Clarification]
    J --> M[Requirement confirmation]
    J --> N[Priority or standard review]
    L --> O[HR approves question and candidate replies]
    O --> F
    K --> P[Recruiter reviews evidence and decides]
    M --> P
    N --> P
    P --> Q[Save reviewed screening result and shortlist status]
    P --> R[Hold or reject with recorded reason]
    E -. Separate optional record .-> W[Candidate uploads completed DISC result screenshot]
    W --> X[Validate file and extract reported results]
    X --> Y[DISC Interpretation Agent prepares source-linked explanation]
    Y --> Z[HR views DISC record separately from screening scores]
```

Eligibility and matching can run in parallel after extraction. Clarification
creates a controlled loop: new evidence triggers the affected checks again.
Queues organise recruiter work; they are not final hiring decisions. Reliability
issues take precedence over ranking, and unresolved cases return to HR.
The optional DISC branch attaches a separate record to the application; it does
not feed eligibility, match scoring, ranking, queue priority or automated decisions.

This workflow ends with the reviewed candidate screening result and the separate
uploaded DISC result and AI explanation. HR records shortlist, hold or rejection
status with a reason; shortlisting does not start another automated stage.
Interview scheduling, time-slot selection, calendar or Gmail invitations, interview
question generation and scoring, final hiring, offers, background checks and
onboarding are outside this scope.

## Step by step implementation plan

Follow these steps as the development checklist for the designed system. They
describe work still to build, not features already available. The scaffold is
complete; the recruitment steps below remain planned. Each step identifies the
work, responsible component, saved output and completion check.

Build the prerequisites first. During actual application processing, eligibility
and matching (steps 10 and 11) can run in parallel after extraction. The optional
DISC branch (step 16) can run independently once an application exists; it never
blocks or feeds screening. Add audit events and access checks as each module is
built, and verify them throughout rather than waiting until the final step.

### Step 1 Establish identity and access controls

- **Build:** candidate, HR and hiring-manager sign-in; company, project and
  assigned-vacancy permissions; backend ownership checks for every record and file.
- **Responsible:** authentication and authorisation services, enforced in backend code.
- **Output:** authenticated actor context and permission-scoped API access.
- **Complete when:** one candidate cannot read another candidate's application,
  uploads or chatbot context, and staff cannot access unassigned records.

### Step 2 Create records storage and workflow foundations

- **Build:** records for projects, document versions, vacancies, scorecards,
  applications, evidence, agent runs, reviews and separate DISC reports. Add private
  file storage, processing states, bounded retries and audit events.
- **Responsible:** backend services and the Orchestrator workflow.
- **Output:** persistent case state with task IDs, input/output references and versions.
- **Complete when:** failed work can resume safely, repeated requests do not create
  duplicate results, and each action has a restricted audit trail.

### Step 3 Upload project files and prepare RAG

- **Build:** the manager's project library, file validation, text extraction,
  passage indexing, project access filters and source-version handling.
- **Responsible:** Project Knowledge Service.
- **Output:** authorised project passages with document and page references.
- **Complete when:** HR can retrieve relevant project context, inaccessible files
  never reach the model, and source updates or deletion update the index.

### Step 4 Capture the hiring brief and choose the creation path

- **Build:** a form for role, project, junior/mid/senior level, responsibilities,
  relevant experience, location, working arrangement, employment type and headcount.
- **Responsible:** hiring manager and HR through the vacancy workspace.
- **Output:** a saved brief and a manual or AI-assisted creation choice.
- **Complete when:** manual entry works without project files or AI research, and
  the AI path receives explicit role scope and seniority rather than guessing them.

### Step 5 Research and review the proposed salary

- **Build:** approved external source lookup, comparable-role filtering,
  normalisation of pay basis and comparison with the internal band and budget.
- **Responsible:** Salary Research Agent, calculation service and HR approver.
- **Output:** a proposed range with source URLs, dates, assumptions, limitations
  and approval status; manual compensation entry remains available.
- **Complete when:** weak evidence stays pending, band conflicts are flagged, and
  no range is published without approval. Private project and candidate data must
  not be sent to external search services.

### Step 6 Draft the JD and level specific screening setup

- **Build:** editable AI drafts using the brief and authorised project passages,
  including responsibilities, mandatory/preferred criteria and screening questions.
- **Responsible:** Vacancy Drafting Agent with HR and hiring-manager review.
- **Output:** the JD plus a proposed scorecard containing each criterion, its
  weight and evidence-based rating anchors. Mandatory eligibility rules are separate.
- **Complete when:** weights total 100%, junior and senior expectations differ
  appropriately, citations support project facts and assumptions are visible.

### Step 7 Approve and publish the vacancy

- **Build:** draft editing, approval history, public preview and publication controls.
- **Responsible:** HR and hiring manager approve; backend publishes the approved version.
- **Output:** a published vacancy with saved JD, salary, application form and scorecard versions.
- **Complete when:** unapproved edits cannot go live, public content excludes
  confidential project details, and screening references the approved snapshot.

### Step 8 Receive and validate applications

- **Build:** the candidate application form, resume upload, processing notice,
  submission confirmation and application status page.
- **Responsible:** candidate portal and deterministic Intake service.
- **Output:** an application ID, private resume reference and validation status.
- **Complete when:** ownership and file-safety checks run before processing, unsafe
  or unreadable files reach manual handling, and candidates can view only their records.

### Step 9 Extract source linked resume evidence

- **Build:** structured extraction of job-relevant experience, skills, projects
  and application answers, with source locations and extraction warnings.
- **Responsible:** Evidence Extraction Agent.
- **Output:** versioned evidence records and explicitly missing or uncertain facts.
- **Complete when:** reviewers can open the supporting source, missing facts are
  not invented and the agent receives no DISC records as screening evidence.

### Step 10 Check mandatory eligibility

- **Build:** evaluation of each approved mandatory rule against extracted evidence.
- **Responsible:** Eligibility Agent and deterministic rule checks where applicable.
- **Output:** met, not met or unknown per rule, with evidence references.
- **Complete when:** missing evidence yields unknown, not met requires affirmative
  evidence, and no result automatically rejects the candidate.

### Step 11 Calculate and explain the resume match

- **Build:** criterion ratings against the approved level-specific rubric;
  backend calculation of weighted points and same-vacancy ranking inputs.
- **Responsible:** Matching Agent proposes ratings; backend calculates totals.
- **Output:** criterion ratings, points, total, evidence links and information gaps.
- **Complete when:** totals can be reproduced from the saved rubric, unknowns
  follow the approved policy and DISC never changes the score or ranking.

### Step 12 Validate screening reliability

- **Build:** source-support, contradiction, completeness and criteria-adherence checks.
- **Responsible:** Quality Validation Agent with deterministic schema/version checks.
- **Output:** passed checks, warnings, a bounded rerun request or manual-review status.
- **Complete when:** unsupported claims and mismatched scorecard versions cannot
  pass silently, and repeated failures hand control to HR.

### Step 13 Assign the recruiter review queue

- **Build:** approved routing precedence for manual review, clarification,
  requirement confirmation, priority review and standard review.
- **Responsible:** Orchestrator applying configured backend routing rules.
- **Output:** one primary queue with all additional warnings preserved.
- **Complete when:** reliability issues take priority over ranking, thresholds
  are vacancy-specific and DISC presence or values do not affect routing.

### Step 14 Resolve important missing information

- **Build:** standard clarification drafts, HR approval, candidate portal replies,
  response deadlines and bounded follow-up attempts.
- **Responsible:** Clarification Agent, HR reviewer and candidate.
- **Output:** new evidence or an unresolved case returned to HR.
- **Complete when:** replies rerun affected eligibility/matching checks and quality
  validation before queue reassignment; silence is not silently treated as failure.

### Step 15 Review and save the candidate screening result

- **Build:** ranked queues, original-resume viewing, score explanations, authorised
  comparisons and human confirmation of shortlist, hold or rejection status.
- **Responsible:** recruiter or hiring manager within assigned permissions.
- **Output:** reviewed screening result, reason, reviewer and timestamp, preserving
  original AI results and any human corrections.
- **Complete when:** HR can verify every result, the candidate sees only their
  permitted published status and shortlisting starts no scheduling workflow.

### Step 16 Attach and explain the optional DISC result

- **Build:** candidate screenshot upload, processing permission, private storage,
  OCR/vision extraction, field review and a separate Personality / DISC tab.
- **Responsible:** upload service, candidate or HR field reviewer and DISC Interpretation Agent.
- **Output:** an application-linked record containing the original screenshot,
  reported fields, source-linked explanation, uncertainty and version history.
- **Complete when:** unreadable fields require review, uploads remain labelled
  candidate-supplied and unverified, and no DISC data reaches eligibility, scoring,
  ranking, routing or salary calculations. Skipping this step has no penalty.

### Step 17 Add application support and recruitment assistants

- **Build:** a candidate chatbot for permitted status, clarification and upload
  questions; an HR assistant for evidence summaries, score explanations and
  separate DISC explanations. Finish the dashboard's screening and DISC metrics.
- **Responsible:** Candidate Support Agent and HR Recruitment Assistant.
- **Output:** source-linked answers within the signed-in user's permissions and
  reviewable proposals requiring the appropriate human confirmation.
- **Complete when:** candidate answers expose no internal screening scores or
  other applicants, and HR comparisons use only authorised records and approved criteria.

### Step 18 Verify the complete workflow

- **Build and run:** integration checks for manual/AI vacancy creation, approvals,
  application intake, screening, clarification, human review and separate DISC uploads.
- **Responsible:** development team and HR acceptance reviewers.
- **Output:** repeatable acceptance evidence, failure alerts and operational metrics
  for processing errors, review time and human corrections.
- **Complete when:** access isolation, source traceability, scoring calculations,
  recovery and DISC separation pass checks. Confirm the delivered UI and APIs end
  at screening results and separate DISC records, with no scheduling or invitation module.

### Final deliverables and acceptance checklist

- [ ] HR can publish an approved manual or project-grounded AI vacancy.
- [ ] Salary research is sourced, level-specific and approved before publication.
- [ ] Each vacancy has approved eligibility rules, criteria, weights and rating anchors.
- [ ] Candidates can apply and answer HR-approved clarification requests privately.
- [ ] HR can review evidence, rankings and explanations and save a screening outcome.
- [ ] Candidates can upload DISC screenshots as separate optional application records.
- [ ] HR can inspect the original DISC upload and its source-linked AI explanation.
- [ ] Candidate support and HR assistants respect record permissions and result visibility.
- [ ] Audit history, failure recovery and access-isolation checks cover the complete flow.

These boxes remain unchecked until the corresponding feature is implemented and
verified; they do not indicate scaffold completion.

## Design documents

Use these documents alongside the checklist to review the intended flow and screens:

- [Agentic AI screening workflow](output/Agentic_AI_Resume_Screening_Process.pdf)
- [HR dashboard and candidate portal prototype](output/WeHire_Recruitment_Portal_Professional_Prototype.pdf)

## Planned user interfaces

| Interface | Main capabilities |
| --- | --- |
| Candidate portal | Browse vacancies, apply, upload a resume and optional completed DISC result screenshot, track permitted application status, respond to clarification and review their own DISC upload details. |
| Candidate chatbot | Answer questions about the signed-in candidate's own application status, clarification requests and DISC uploads. |
| HR dashboard | View recruitment metrics, draft vacancies from selected projects, inspect salary benchmarks, manage review queues, compare authorised applicants and record decisions. View uploaded DISC reports and AI explanations in a separate application tab. |
| Hiring manager workspace | Upload and manage project references, select role and seniority, review AI-generated requirements and salary proposals, approve criteria and inspect authorised screening and DISC results. |
| HR recruitment assistant | Explain screening results, summarise candidate evidence and separately explain authorised DISC reports; propose actions within the staff member's permissions. |

## Project-based vacancy drafting with RAG

Hiring managers can upload project documents describing the product, objectives,
technical stack, delivery scope and team needs. HR can select a project when
creating a vacancy so the draft reflects the work the new employee will perform.
This project-grounded drafting path uses retrieval-augmented generation (RAG);
manual vacancy creation remains available without uploaded documents.

1. **Upload and prepare:** validate files, store originals privately, extract text
   and split it into retrievable passages. Index approved passages with project,
   company, access permissions, document version and source-location metadata.
2. **Set the hiring brief:** choose the authorised project, job role, junior/mid/senior
   level, expected experience, location, employment type and hiring objectives.
3. **Retrieve relevant context:** enforce project permissions before returning
   passages about responsibilities, technology and delivery needs to the drafting agent.
4. **Generate an editable draft:** propose a project introduction, JD, responsibilities,
   mandatory and preferred skills, screening questions and a level-specific scorecard.
   Show source references and distinguish project facts from proposed hiring requirements.
5. **Review and publish:** HR and the hiring manager confirm scope, seniority,
   requirements and compensation before publishing an approved vacancy version.

Project technology is context, not an automatic mandatory requirement: the manager
must confirm what this particular hire needs. Missing or conflicting project facts
should produce questions rather than invented requirements. Internal plans,
customer details and other confidential content must be excluded from public drafts.
Treat uploaded text as reference data, not instructions to change workflow or access.
Update or remove indexed passages when their source changes or is deleted.

## AI-assisted market salary research

A planned **Salary Research Agent** researches current external salary sources to
propose a market-informed range for the selected role and experience level. This
is a vacancy-planning estimate, not an individual candidate's pay decision.

- **Inputs:** role, responsibilities, seniority, relevant years of experience,
  location, currency, industry, employment type and working arrangement.
- **Research:** use approved salary surveys, salary guides and comparable job
  postings. Retain source links, publication dates, retrieval dates, sample context
  and limitations; do not present an unsupported model estimate as market research.
- **Normalise:** compare the same currency, pay period and compensation basis.
  Separate base salary from bonuses, equity and benefits; disclose any conversion
  rates, dates or assumptions. Backend code performs numerical calculations.
- **Recommend:** show a proposed minimum and maximum, supporting benchmarks,
  confidence or data limitations, and comparison with the approved internal band.
  Sparse, stale or conflicting evidence requires HR review rather than a fabricated range.
- **Approve:** HR checks internal equity, the role's approved budget and company
  compensation policy. Differences between market evidence and the internal band
  are flagged; a new or changed band requires approval before publication.

Salary research uses external research tools; project RAG supplies internal role
context. These are separate sources. The agent must not send confidential project
documents or candidate records to external search services. Save the approved
range, research references and approval record with the vacancy version.

## Requirements by role and seniority

Junior and senior vacancies for the same role need distinct responsibilities,
requirements and rating anchors. Years of experience are one input, not proof of
seniority; the expected scope, independence and complexity must guide the draft.

| Dimension | Junior developer example | Senior developer example |
| --- | --- | --- |
| Delivery scope | Implement bounded tasks with guidance. | Own complex features or services from design through delivery. |
| Technical evidence | Fundamentals, relevant projects and ability to apply feedback. | Evidence of design trade-offs, production reliability and complex problem solving. |
| Independence | Work with review and mentoring. | Make justified decisions and resolve ambiguity independently. |
| Collaboration | Communicate progress and learn team practices. | Lead technical discussions, review designs and mentor colleagues where required. |
| Screening rubric | Emphasise fundamentals and demonstrated learning. | Emphasise ownership, depth and impact relevant to the vacancy. |

These examples are editable starting points, not universal requirements. Draft
only the level-specific criteria justified by the hiring brief, and distinguish
skills needed on entry from skills that can be learned. HR and managers approve
separate scorecards and salary proposals for each vacancy and level. Do not rank
junior and senior applicants together using one shared scorecard.

## DISC result uploads and AI interpretation

Candidates can complete a DISC assessment outside WeHire and upload a screenshot
of their result to a specific application. WeHire stores this as an **associated
application record**, separate from resume evidence and the screening scorecard.
This feature does not generate DISC questions, administer a test or calculate
a new personality score. A paid assessment API is not required for this upload path.

1. **Upload:** the signed-in candidate selects their own application, uploads the
   result screenshot and, where known, supplies the assessment provider and test date.
   Explain who can view the record and obtain permission to process it.
2. **Validate and store:** backend services verify application ownership and file
   safety, keep the original image in private storage and link its record to the
   candidate and application. Uploads are labelled candidate-supplied and unverified.
3. **Extract:** OCR or a vision model reads only the visible profile label,
   D/I/S/C values, scale labels and report text, retaining image-region references
   and extraction warnings. Candidate confirmation or HR review resolves ambiguous
   readings; unreadable or cropped results require a clearer upload, not guessed values.
4. **Interpret:** the DISC Interpretation Agent explains what the uploaded report
   says in plain language, including any report-supported communication or working
   preferences. Distinguish extracted facts from AI explanation, cite the source
   regions and state limitations. Use authorised provider guidance when available;
   otherwise keep the explanation limited to the visible report.
5. **Review:** authorised HR staff view the original, extracted fields, AI explanation
   and warnings in a separate **Personality / DISC** tab on the application page.
   HR can flag or correct extraction errors while preserving the original record.

The **DISC Interpretation Agent** receives only the authorised uploaded report,
provider context and relevant interpretation references. It returns structured
reported results, a source-linked explanation, missing information and review
warnings. It cannot authenticate the screenshot, establish that the candidate
completed the test, infer unseen results or diagnose psychological conditions.
Do not assume different providers use equivalent scales or turn displayed numbers
into percentages unless the report explicitly defines them that way.

Each record should retain the application and candidate IDs, private upload
reference, declared provider and test date, upload timestamp, extracted fields,
explanation, source references, processing status, model/prompt versions and any
human corrections. Replacements create a new version; deletion follows retention
rules and removes related derived content. A screenshot is supporting information,
not a verified assessment certificate.

**Keep DISC outside candidate selection calculations:** neither uploaded values
nor AI explanations may alter resume scores, eligibility, ranking, review queues,
salary proposals or trigger shortlist/rejection. The absence of a DISC upload
must not penalise an application. HR explanations must not label a personality
style as better, worse or proof of suitability for a role. Treat this feature as
optional descriptive context rather than a predictor of job performance.

## Planned agent and service responsibilities

| Component | Responsibility | Authority boundary |
| --- | --- | --- |
| Orchestrator | Coordinate tasks, track workflow state and assign review queues. | Follow approved routing rules; cannot independently publish or reject applications. |
| Vacancy Drafting Agent | Retrieve authorised project context and propose a level-specific JD, requirements, questions and scorecard. | Cite sources, flag assumptions and exclude confidential content; HR and managers approve publication. |
| Salary Research Agent | Research comparable market pay for the role, location, seniority and experience; propose a sourced range. | Cannot change company bands or publish pay independently; HR approves budget and internal equity alignment. |
| Project knowledge service | Validate and index approved project documents; retrieve permission-scoped passages and source references. | Backend enforces access, document versions and deletion; retrieved text cannot grant permissions. |
| Intake service | Validate uploads, register applications and enforce file ownership. | Deterministic backend checks; no LLM required. |
| Evidence Extraction Agent | Extract job-relevant facts with document and page references. | Missing information stays unknown; no invented candidate facts. |
| Eligibility Agent | Check approved mandatory requirements. | Return met, not met or unknown with evidence; HR confirms any rejection. |
| Matching Agent | Rate evidence against an approved rubric and explain each rating. | Backend calculates weighted totals; scores are not hiring probabilities. |
| Quality Validation Agent | Check source support, contradictions and adherence to criteria. | Request a rerun or manual review; does not certify fairness by itself. |
| Clarification Agent | Draft questions about important gaps and process replies. | HR approves outbound questions; bounded attempts return unresolved cases to HR. |
| DISC Interpretation Agent | Read candidate-uploaded DISC result screenshots and explain the visible report with source references and uncertainty. | Separate associated record only; cannot validate the assessment, invent results or influence screening scores, ranking or automated decisions. |
| Candidate Support Agent | Answer permitted application-status and clarification questions and help with DISC result uploads. | Own account only; no internal screening scores, recruiter notes or other candidates' data. |
| HR Recruitment Assistant | Summarise evidence, explain scores and compare selected applicants. | Respect assigned vacancies and record permissions; obtain required action confirmation. |
| Audit and monitoring service | Record actions, versions, overrides, failures and unusual access. | Cannot change scores or decisions; logging and access enforcement remain deterministic. |

Not every component needs an LLM. Language tasks can use an LLM, while numerical
calculations, authorisation, file checks and application record updates belong in backend
code. LangGraph is a proposed orchestration option: nodes can be LLM calls,
ordinary functions or human review steps; conditional edges route using workflow
state. LangChain may provide model, tool and retrieval integrations. Neither
library is installed in the scaffold yet.

Agents should exchange structured task/result references, case identifiers,
criteria versions, evidence references and statuses. The backend controls access
and state transitions rather than relying on unrestricted shared chat history.

## Screening and human review

A **scorecard** is the approved set of job criteria, weights and anchored rating
rules for a vacancy. The Matching Agent proposes a rating for each criterion
using candidate evidence. Backend code converts those ratings into weighted
points according to the saved rubric.

- Compare candidates within the same vacancy and scorecard version.
- Use the vacancy's approved seniority-specific criteria; do not judge junior
  applicants against an unrelated senior-level rubric.
- Keep mandatory eligibility checks separate from match scores.
- Exclude DISC reports and their AI explanations from scoring, eligibility,
  ranking and routing inputs; missing uploads carry no penalty.
- Show evidence, explanations and gaps alongside scores.
- Apply an explicit policy for unknowns; absence of evidence is not automatic failure.
- Use approved thresholds to prioritise review, with human approval for shortlist,
  hold or rejection decisions.
- Preserve original results and human corrections with their reasons.

## Data access and company knowledge

The planned design separates private application records from reusable company
knowledge:

- Store resumes in private file storage and application records in a database.
  A vector store is not the primary store for candidate records.
- Store DISC screenshots privately and link extracted results and explanations
  to their application record. Keep them out of the shared company RAG index and
  screening-agent inputs. Restrict access to the owning candidate and authorised
  staff; record access and apply deletion rules to originals and derived content.
- Enforce candidate ownership and staff permissions in backend queries and file
  access, including chatbot tool calls. Prompts alone cannot enforce isolation.
- Expose only the candidate's permitted status, clarification and own upload information through
  the candidate assistant.
- Use optional retrieval-augmented generation (RAG) for authorised company
  policies, approved templates and project summaries when drafting vacancies or
  answering supported questions. RAG retrieves references; it does not train the model.
  The project-grounded drafting feature uses this retrieval layer; it is not a
  prerequisite for manual vacancy creation or basic resume screening.
- Basic resume screening does not require a vector database. Any later indexing
  of private candidate evidence must preserve application-level access controls
  and deletion rules.
- Restrict audit access and record event/result references without unnecessarily
  duplicating resumes or sensitive content in logs.

These are architecture requirements to implement, not security capabilities
already provided by the scaffold.

## Structure

```text
backend/
  app/
    api/routes/       # API router and health endpoint
    core/config.py    # Environment-based settings
    main.py           # FastAPI application
  tests/              # Backend tests
  .env.example
  requirements.txt
frontend/             # Next.js App Router, TypeScript, Tailwind, src/, npm
  src/app/
  .env.example
output/               # Workflow and UI prototype PDFs
README.md             # Product direction and local development guide
```

## Prerequisites

- Python 3.12 or newer
- A Node.js version supported by the installed Next.js release, with npm

## Local services

| Service | URL |
| --- | --- |
| Frontend | <http://localhost:3012> |
| Backend API | <http://localhost:8012> |
| API documentation | <http://localhost:8012/docs> |
| Health check | <http://localhost:8012/health> |

No LLM credentials or database is needed to run the current
scaffold.

## Run the backend

From the repository root:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8012
```

Health: <http://localhost:8012/health> returns `{"status": "ok"}`.
Interactive API documentation: <http://localhost:8012/docs>.
Settings load from `backend/.env`; environment variables take precedence.
`CORS_ORIGINS` is a JSON array and defaults to `["http://localhost:3012"]`.

Run tests from `backend/` with the virtual environment activated:

```bash
python -m pytest -q
```

## Run the frontend

In a second terminal, from the repository root:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3012>. Both `npm run dev` and `npm start` use port 3012.
`NEXT_PUBLIC_API_URL` points to the backend and
defaults in the example to `http://localhost:8012`. Variables prefixed with
`NEXT_PUBLIC_` are public browser configuration, not secrets.
The existing starter page is preserved and does not yet call the API.

Validate a production build:

```bash
npm run build
```

## Branch workflow

Develop and validate changes on `staging`. Open a pull request from `staging`
to `main` when changes are ready for review. Do not push changes directly to
`main`. Keep local environment files and dependency directories out of Git;
commit `.env.example` templates and the npm lockfile.
