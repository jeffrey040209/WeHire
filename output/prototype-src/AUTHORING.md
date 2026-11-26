# Authoring a screen

Source PDF (original, do not modify): `../WeHire_Recruitment_Portal_Professional_Prototype.pdf` (34 landscape pages, each a flat screenshot of one screen).
We rebuild every screen as HTML in a modern design, keeping **every piece of information identical**.

## Files
- `styles.css` — shared design system. **Do not edit** (other people build in parallel). If you need something it lacks, use inline `style=""` in your screen.
- `build.py` — **do not edit**. Run `python3 build.py --preview 5 6` to render screens 05 and 06 to `preview/05.png` etc. and run an overflow check. Never run `build.py` without `--preview`.
- `screens/NN.html` — one per page. References: `screens/01.html` (candidate portal) and `screens/24.html` (HR workspace). Read both before starting.

## Screen file format
Line 1 is JSON front matter; the rest is the content area only (sidebar, top bar, footer, page title and page number come from build.py):
```
<!-- {"title": "<exact page title text from original, above the screenshot>", "portal": "candidate" | "hr", "active": "<highlighted sidebar item, exactly as in nav>", "crumb": "<top bar left text, exactly>", "user": "<top bar right text, e.g. 'Aisha Rahman' or 'Maya Tan / Recruiter'>"} -->
```
Candidate nav items: Find opportunities, My applications, Messages, AI assistant, My profile.
HR nav items: Overview, Vacancies, Candidates, Approvals, AI assistant, Analytics, Activity log.
Icons: `{{i:name}}` (names are in the ICONS dict in build.py).

## Rules
1. **Information must be identical**: every heading, label, value, number, button text, badge, helper text and note in the original appears in yours, with the same wording, capitalisation, punctuation, slashes and numbers. Don't add new information (decorative icons are fine), don't drop any, don't reword. Uppercase small labels such as "CANDIDATE PORTAL" may be written in normal case, because `.eyebrow` / `.label` uppercase them with CSS.
2. Keep the same structure (which cards exist, what's inside them, roughly where they sit). Improve the design: spacing, hierarchy, badges, icons, progress bars, steppers and so on, using the classes in styles.css.
3. The content area is about 1080 x 720 canvas px. It must not overflow: the preview prints `OK, no overflow` or `OVERFLOW -> ...`. Fix every overflow.
4. Look at your preview PNG and compare it with the original. It should look polished, balanced and uncluttered, with nothing clipped and nothing overlapping.

## Seeing the original
```
pdftoppm -r 150 -png -f N -l N ../WeHire_Recruitment_Portal_Professional_Prototype.pdf /tmp/wehire-orig/p   # page N
tesseract /tmp/wehire-orig/p-NN.png - 2>/dev/null   # OCR to cross-check exact text
```
Read the PNG to see it. Use OCR only as a cross-check for spelling and numbers, not as the source of truth for layout.
