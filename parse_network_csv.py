import csv
import json
import re
from pathlib import Path

csv_path = Path('鲁迅社交关系（时间关联版）1127.csv')
out_path = Path('network-data.json')

rows = []
with csv_path.open(encoding='utf-8') as f:
    reader = csv.reader(f)
    header = next(reader)
    for r in reader:
        if not any(r):
            continue
        rows.append(r)

nodes = [{'id':'lu_xun','name':'鲁迅','type':'center','relation':'中心','events':[], 'minYear':1912}]
links = []

for i, r in enumerate(rows):
    name = r[1].strip() if len(r) > 1 else ''
    relation = r[2].strip() if len(r) > 2 else '其他'
    events = []
    # 时间/重要事件对从第3列开始，每两列一对（time, desc）
    for j in range(3, len(r), 2):
        time = r[j].strip() if j < len(r) else ''
        desc = r[j+1].strip() if (j+1) < len(r) else ''
        if time or desc:
            events.append({'time': time, 'description': desc})
    # extract min year
    years = []
    for e in events:
        m = re.search(r'(19\d{2})', e.get('time',''))
        if m:
            years.append(int(m.group(1)))
    minYear = min(years) if years else 1926
    node = {
        'id': f'person_{i}',
        'name': name or f'未知{i}',
        'type': 'person',
        'relation': relation or '其他',
        'events': events,
        'minYear': minYear
    }
    nodes.append(node)
    isBroken = any(('破裂' in (e.get('description') or '') or '断交' in (e.get('description') or '')) for e in events)
    links.append({'source':'lu_xun','target':node['id'],'relation':relation,'events':events,'isBroken':isBroken,'minYear':minYear})

out = {'nodes': nodes, 'links': links}
with out_path.open('w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print('Wrote', out_path.resolve(), 'nodes=', len(nodes), 'links=', len(links))
