/* 문서 상태 표기 검사: 기능 상태는 docs/STATUS.md에만 둔다. 다른 문서에 낡은 상태 표현이 다시 들어오면 실패한다. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'); const res = [];
const check = (n, c, d) => { res.push(c); console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' :: ' + d)); };
const files = ['README.md', 'PLAN.md', 'docs/DESIGN.md', 'docs/GROWTH.md', 'docs/TOKENS.md', 'docs/PLAY.md'];
const BAD = [
  [/자동 테스트 \d+개 통과/, '테스트 개수를 문서에 적지 마세요(금방 어긋남). `npm test` 출력이 기준'],
  [/구현 현황|현재 구현 상태|현재 상태 \(/, '상태 표는 docs/STATUS.md에만'],
  [/\|\s*(구현|미구현|보류)\s*\|/, '상태 열은 docs/STATUS.md에만'],
  [/계정 없음|로그인[^.\n]{0,12}없음|방 영구 저장[^.\n]{0,8}없음|서버 재시작하면 방이 사라진다/, '이미 구현된 기능을 없다고 적었는지 확인'],
  [/공유 링크는 서버 메모리라 재시작하면 사라진다\.(?!.*DATA_DIR)/, '공유 링크는 DATA_DIR이 있으면 저장된다']
];
for (const f of files) {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8'); const hits = [];
  for (const [re, why] of BAD) { const m = re.exec(t); if (m) hits.push('"' + m[0] + '" — ' + why); }
  check(f + ' has no stale status wording', !hits.length, hits.join(' | '));
}
const st = fs.readFileSync(path.join(ROOT, 'docs/STATUS.md'), 'utf8');
check('STATUS.md has the four-column table', /\| 기능 \| 코드 \| 자동 테스트 \| 외부 연동 \| 배포 환경 \|/.test(st));
for (const f of ['PLAN.md', 'docs/GROWTH.md']) check(f + ' points to STATUS.md', /STATUS\.md/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
console.log(res.every(Boolean) ? 'ALL OK' : 'SOME FAILED ' + res.filter(x => !x).length); process.exit(res.every(Boolean) ? 0 : 1);
