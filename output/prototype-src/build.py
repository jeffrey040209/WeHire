#!/usr/bin/env python3
"""Build the WeHire prototype PDF.

Each screen lives in screens/NN.html. The first line is a JSON front-matter comment:
  <!-- {"title": "...", "portal": "candidate"|"hr", "active": "Nav item", "crumb": "...", "user": "..."} -->
The rest of the file is the screen's main content (rendered inside .content).
Icons: write {{i:name}} anywhere to insert an inline SVG icon (see ICONS).

Usage:
  python3 build.py                 # full build: prototype.html + PDF in ../
  python3 build.py --preview 3 7   # preview screens 3 and 7 only -> preview/03.png, preview/07.png
"""
import json, re, subprocess, sys, pathlib, html

ROOT = pathlib.Path(__file__).resolve().parent
OUT_PDF = ROOT.parent / "WeHire_Recruitment_Portal_Professional_Prototype_Modern.pdf"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Lucide-style 24x24 stroke icons
ICONS = {
    "search": '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    "briefcase": '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
    "file": '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    "file-text": '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6M9 9h1"/>',
    "message": '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
    "sparkles": '<path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    "user": '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    "users": '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
    "help": '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2.2-2.4 3.7"/><path d="M12 17h.01"/>',
    "settings": '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    "grid": '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    "check-circle": '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    "check": '<path d="m5 12 5 5 9-10"/>',
    "chart": '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    "activity": '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
    "upload": '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    "chevron-right": '<path d="m9 6 6 6-6 6"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "arrow-left": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    "lock": '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    "shield": '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    "map-pin": '<path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "calendar": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>',
    "alert": '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    "send": '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
    "building": '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M10 21v-3h4v3"/>',
    "dollar": '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    "edit": '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    "eye": '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    "image": '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    "book": '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    "layers": '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    "target": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    "list": '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    "clipboard": '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    "refresh": '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    "scale": '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    "flag": '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
    "inbox": '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
    "x": '<path d="M18 6 6 18M6 6l12 12"/>',
    "pause": '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    "zap": '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    "star": '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
    "folder": '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    "link": '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    "save": '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
}

def icon(name):
    if name not in ICONS:
        raise SystemExit(f"Unknown icon: {name}. Available: {', '.join(sorted(ICONS))}")
    return f'<svg class="i" viewBox="0 0 24 24">{ICONS[name]}</svg>'

NAV = {
    "candidate": {
        "brand_sub": "Candidate inputs",
        "items": [("Resume submission", "upload"), ("DISC result upload", "image"),
                  ("Clarification response", "message")],
        "kicker": "Candidate inputs",
        "url": "inputs.wehire.app",
    },
    "hr": {
        "brand_sub": "Recruitment workspace",
        "items": [("Overview", "grid"), ("Vacancies", "briefcase"), ("Candidates", "users"), ("Approvals", "check-circle"),
                  ("AI assistant", "sparkles"), ("Analytics", "chart"), ("Activity log", "activity")],
        "kicker": "Recruitment workspace",
        "url": "app.wehire.app",
    },
}

def initials(name):
    return "".join(p[0] for p in name.split("/")[0].split()[:2]).upper()

def render_page(idx, total, meta, body):
    portal = meta["portal"]
    nav = NAV[portal]
    items = "".join(
        f'<a class="{"active" if label == meta.get("active") else ""}">{icon(ic)}{html.escape(label)}</a>'
        for label, ic in nav["items"])
    user = meta.get("user", "")
    user_html = html.escape(user).replace(" / ", ' <span class="faint">/</span> ')
    body = re.sub(r"\{\{i:([a-z\-]+)\}\}", lambda m: icon(m.group(1)), body)
    crumb_icon = icon("sparkles") if portal == "candidate" else icon("layers")
    return f"""
<section class="page {portal}">
  <header class="page-head">
    <div>
      <div class="page-kicker"><span class="dot"></span>WeHire prototype · {nav['kicker']}</div>
      <h1 class="page-title">{html.escape(meta['title'])}</h1>
    </div>
    <div class="page-num">{idx:02d} <span>/ {total:02d}</span></div>
  </header>
  <div class="frame">
    <div class="chrome"><span class="b"></span><span class="b"></span><span class="b"></span><div class="url">{icon('lock')}{nav['url']}</div></div>
    <div class="app {portal}">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">W</div><div><div class="brand-name">WeHire</div><div class="brand-sub">{nav['brand_sub']}</div></div></div>
        <div class="nav-label">Menu</div>
        <nav class="nav">{items}</nav>
        <div class="spacer"></div>
        <nav class="nav side-foot"><a>{icon('help')}Help and support</a>{f"<a>{icon('settings')}Settings</a>" if portal == 'hr' else ''}</nav>
      </aside>
      <div class="main">
        <div class="topbar">
          <div class="crumb">{crumb_icon}{html.escape(meta.get('crumb', ''))}</div>
          <div class="right"><div class="icon-btn">{icon('bell')}</div><div class="user"><div class="avatar">{initials(user)}</div><div>{user_html}</div></div></div>
        </div>
        <div class="content">{body}</div>
        <div class="app-foot"><div><b>DESIGN PROTOTYPE</b> / Illustrative candidate data</div><div>WeHire / 2026</div></div>
      </div>
    </div>
  </div>
</section>"""

EXCLUDED_SCREENS = {1, 3, 6, 22, 33, 34}
TOTAL = 28

def load(f):
    text = f.read_text()
    m = re.match(r"\s*<!--\s*(\{.*?\})\s*-->", text, re.S)
    if not m:
        raise SystemExit(f"{f.name}: missing JSON front matter")
    return json.loads(m.group(1)), text[m.end():]

def to_pdf(pages, out_html, out_pdf):
    css = (ROOT / "styles.css").read_text().replace('url("fonts/', f'url("{(ROOT / "fonts").as_uri()}/')
    out_html.write_text(f"""<!doctype html><html><head><meta charset="utf-8"><title>WeHire Recruitment Portal Professional Prototype</title>
<style>{css}</style></head><body>{''.join(pages)}</body></html>""")
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                    "--virtual-time-budget=8000", "--run-all-compositor-stages-before-draw",
                    f"--user-data-dir=/tmp/wehire-chrome-{out_pdf.stem}",
                    f"--print-to-pdf={out_pdf}", out_html.as_uri()],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

CHECK_JS = """<script>
window.addEventListener('load', () => {
  const issues = [];
  const c = document.querySelector('.content');
  if (c.scrollHeight > c.clientHeight + 1) issues.push('content too tall by ' + (c.scrollHeight - c.clientHeight) + 'px (canvas units)');
  c.querySelectorAll('*').forEach(el => {
    const r = el.getBoundingClientRect(), cr = c.getBoundingClientRect();
    if (r.width && r.right > cr.right + 2) issues.push('pokes out right: <' + el.tagName.toLowerCase() + ' class=' + el.className + '> ' + (el.textContent || '').trim().slice(0, 40));
  });
  document.body.setAttribute('data-issues', JSON.stringify(issues.slice(0, 8)));
});
</script>"""

def check_overflow(html_path, stem):
    tmp = html_path.with_name(f"{stem}.check.html")
    tmp.write_text(html_path.read_text().replace("</body>", CHECK_JS + "</body>"))
    dom = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--virtual-time-budget=4000",
                          "--window-size=1100,1000", f"--user-data-dir=/tmp/wehire-chrome-check-{stem}",
                          "--dump-dom", tmp.as_uri()], capture_output=True, text=True).stdout
    tmp.unlink()
    m = re.search(r"data-issues=\"(.*?)\"", dom)
    issues = json.loads(html.unescape(m.group(1))) if m else ["could not run overflow check"]
    print(f"  {stem}: " + ("OK, no overflow" if not issues else "OVERFLOW -> " + "; ".join(issues)))

def main():
    args = sys.argv[1:]
    if args and args[0] == "--preview":
        # Preview individual screens without touching the full build: preview/NN.png
        prev = ROOT / "preview"; prev.mkdir(exist_ok=True)
        for n in args[1:]:
            f = ROOT / "screens" / f"{int(n):02d}.html"
            meta, body = load(f)
            stem = f"{int(n):02d}"
            to_pdf([render_page(int(n), TOTAL, meta, body)], prev / f"{stem}.html", prev / f"{stem}.pdf")
            subprocess.run(["pdftoppm", "-r", "130", "-png", "-singlefile", str(prev / f"{stem}.pdf"), str(prev / stem)], check=True)
            print(f"Preview: {prev / (stem + '.png')}")
            check_overflow(prev / f"{stem}.html", stem)
        return
    files = [f for f in sorted((ROOT / "screens").glob("[0-9][0-9].html")) if int(f.stem) not in EXCLUDED_SCREENS]
    assert len(files) == TOTAL
    pages = [render_page(i, TOTAL, *load(f)) for i, f in enumerate(files, 1)]
    to_pdf(pages, ROOT / "prototype.html", OUT_PDF)
    print(f"Built {len(files)} pages -> {OUT_PDF}")

if __name__ == "__main__":
    main()
