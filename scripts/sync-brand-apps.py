"""Normalize shared Arvinify identity and published-app CTAs, preserving app content."""
from pathlib import Path
import re,json
R=Path(__file__).resolve().parents[1]
ids={'lumino':6786564391,'mirrorlux':6797422767,'culina':6815367326,'dealora':6815449806,'her-daily-prayer-cards':6788279130,'contractor-calculator':6815061123,'paycheck-calculator':6815119897,'age-calculator':6814644191}
brand='<a class="arvinify-brand" href="/" aria-label="Arvinify home"><span class="arvinify-mark" aria-hidden="true">✳</span><span class="arvinify-wordmark">arvinify</span></a>'
css='''.arvinify-brand{display:inline-flex!important;align-items:center!important;gap:10px!important;color:#f7f1ed!important;font-family:Arial,Helvetica,sans-serif!important;font-size:27px!important;font-weight:600!important;letter-spacing:-1.2px!important;text-decoration:none!important;line-height:1.2!important;white-space:nowrap}.arvinify-mark{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:#701d38;color:#fff3eb!important;font:32px/1 Arial!important;letter-spacing:0!important}.arvinify-wordmark{color:#f7f1ed!important}.arvinify-brand:focus-visible{outline:2px solid #e7b4c2;outline-offset:6px}.store-download{display:inline-flex;margin:20px 0;padding:14px 24px;border-radius:40px;background:#701d38;color:#fff3eb;text-decoration:none;font:600 15px/1.4 Arial,sans-serif}@media(max-width:600px){.arvinify-brand{font-size:25px!important}.arvinify-mark{width:32px;height:32px;font-size:29px!important}}'''
(R/'assets/brand.css').write_text(css+'\n')
(R/'assets/brand-icon.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#701d38"/><text x="32" y="47" text-anchor="middle" font-family="Arial" font-size="48" fill="#fff3eb">✳</text></svg>')
files=[R/p for p in __import__('subprocess').check_output(['git','ls-files','*.html'],cwd=R,text=True).splitlines() if not p.startswith('assets/') and p!='arvinify-design-preview.html']
for p in files:
 h=p.read_text()
 h=re.sub(r'<a\b[^>]*class="(?:logo|brand|arvinify-brand)"[^>]*>[\s\S]*?</a>',brand,h)
 h=re.sub(r'<a href="/">ARVINIFY</a>',brand,h)
 h=re.sub(r'<link[^>]*rel="(?:shortcut )?icon"[^>]*>','',h)
 if '/assets/brand.css' not in h:h=h.replace('</head>','<link rel="stylesheet" href="/assets/brand.css"><link rel="icon" href="/assets/brand-icon.svg"></head>')
 slug=p.parent.name
 if slug in ids:
  url=f'https://apps.apple.com/app/id{ids[slug]}'
  h=re.sub(r'<a([^>]*?)href="#"[^>]*>(?:Coming soon on the App Store|Download on the App Store)</a>',lambda m:f'<a{m[1]}href="{url}">Download on the App Store</a>',h)
  if 'Download on the App Store' not in h:h=h.replace('</h1>',f'</h1><a class="store-download" href="{url}">Download on the App Store ↗</a>',1)
 if slug in ['tracevelle','scrollmere','foliolette','pixmere']:
  h=re.sub(r'Pending release|In review|Preparing release|In development','Available',h,flags=re.I)
  h=re.sub(r'<p>[^<]*(?:preparing for release|currently in review|App Store review|becomes available|not yet available)[^<]*</p>','',h,flags=re.I)
  # Publisher's verified Apple page until a direct public product URL can be resolved.
  h=re.sub(r'href="https://sepidehdalir.github.io/[^\"]+"','href="https://apps.apple.com/developer/id6786564393"',h)
  h=h.replace('View product preview','View on App Store').replace('>Preview<','>App Store<')
 p.write_text(h)
print('Updated shared branding and app CTAs on',len(files),'pages')
