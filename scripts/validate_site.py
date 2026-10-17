"""Validate editable knowledge data and the generated site's public links."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
import json, sys

root=Path(__file__).resolve().parents[1]
site=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'_site'
data=json.loads((root/'assets/data/knowledge.json').read_text(encoding='utf-8'))
layout=json.loads((root/'assets/data/knowledge-layout.json').read_text(encoding='utf-8'))
nodes={n['id']:n for n in data['nodes']}
assert len(nodes)==len(data['nodes']), 'Duplicate node ID'
domains={d['id'] for d in data['domains']}
stages={s['value'] for s in data['stages']}
assert data['version']==1 and nodes
for node in nodes.values():
    assert node['domain'] in domains
    assert node['stage'] in stages
    seen={node['id']};parent=node['parent']
    while parent:
        assert parent in nodes and parent not in seen, 'Invalid/cyclic parent'
        seen.add(parent);parent=nodes[parent]['parent']
for edge in data.get('relations',[]):
    assert edge['from'] in nodes and edge['to'] in nodes
for domain in domains:
    peak=layout['domains'][domain]
    assert all(isinstance(peak[k],(float,int)) for k in ['x','z','radius','height'])
    assert peak['radius']>0 and peak['height']>0

def exists(url):
    parts=urlsplit(url)
    if parts.scheme or parts.netloc or not parts.path.startswith('/'):return
    p=site/unquote(parts.path).lstrip('/')
    assert p.is_file() or (p/'index.html').is_file(), f'Missing public path: {url}'

class Links(HTMLParser):
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if tag=='a' and 'href' in attrs:exists(attrs['href'])
        if tag in ('script','link'):
            value=attrs.get('src') or attrs.get('href')
            if value:exists(value)

for page in ['index.html','blog/index.html','about/index.html','quantified-self/index.html']:
    html=(site/page).read_text(encoding='utf-8');Links().feed(html)
    assert 'Articles (EN)' not in html and 'Articles (中文)' not in html
for node in nodes.values():
    for evidence in node.get('evidence',[]):exists(evidence['url'])
print(f'PASS: {len(nodes)} nodes, parent graph, stages, layout and new page/knowledge links.')
