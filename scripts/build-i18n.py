#!/usr/bin/env python3
"""i18n/strings.txt(ko || en || ja || zh || es, ' || ' 구분) + i18n/engine.js → public/i18n.js. 자리표시자 {name} 일치 여부를 검사한다."""
import json, re, sys, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rows, seen, bad = [], set(), 0
for n, line in enumerate(open(os.path.join(root, 'i18n/strings.txt'), encoding='utf-8'), 1):
    line = line.rstrip('\n')
    if not line.strip() or line.startswith('# '): continue
    cols = [c.replace('\\n', '\n') for c in line.split(' || ')]
    if len(cols) != 5 or not all(c.strip() for c in cols):
        print(f'줄 {n}: 열이 5개가 아니거나 비어 있음: {cols[0][:40]}'); bad += 1; continue
    ph = lambda s: sorted(re.findall(r'\{(\w+)\}', s))
    for i, c in enumerate(cols[1:], 1):
        if ph(c) != ph(cols[0]): print(f'줄 {n}: 자리표시자 불일치(열 {i}): {cols[0][:40]}'); bad += 1
    if cols[0] in seen: print(f'줄 {n}: 중복 키: {cols[0][:40]}'); bad += 1
    seen.add(cols[0]); rows.append(cols)
if bad: sys.exit(1)
eng = open(os.path.join(root, 'i18n/engine.js'), encoding='utf-8').read()
out = eng.replace('/*ROWS*/[]', '[\n' + ',\n'.join(json.dumps(r, ensure_ascii=False) for r in rows) + '\n]')
open(os.path.join(root, 'public/i18n.js'), 'w', encoding='utf-8').write(out)
print(f'{len(rows)}개 문장 → public/i18n.js ({len(out)//1024}KB)')
