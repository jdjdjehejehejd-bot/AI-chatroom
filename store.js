/* 아주 작은 파일 저장소. DATA_DIR이 없으면 저장하지 않는다(메모리만).
   인터페이스(read/write/remove/list)만 지키면 Redis나 DB로 바꿀 수 있다. */
const fs = require('fs');
const path = require('path');

function createStore(dir) {
  if (!dir) return { enabled: false, read: () => null, write: () => {}, remove: () => {}, list: () => [] };
  fs.mkdirSync(path.join(dir, 'rooms'), { recursive: true });
  const safe = n => String(n).split('/').map(x => x.replace(/[^A-Za-z0-9_-]/g, '_')).join('/');
  const file = n => path.join(dir, safe(n) + '.json');
  return {
    enabled: true,
    read(name) {
      let raw;
      try { raw = fs.readFileSync(file(name), 'utf8'); } catch (e) { return null; }
      try { return JSON.parse(raw); } catch (e) {
        try { fs.renameSync(file(name), file(name) + '.corrupt-' + Date.now()); console.error('손상된 저장 파일을 따로 보관했습니다:', name); } catch (e2) {}
        return null;
      }
    },
    write(name, obj) {
      const f = file(name), tmp = f + '.' + process.pid + '.tmp';
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(tmp, JSON.stringify(obj));
      fs.renameSync(tmp, f);
    },
    remove(name) { try { fs.unlinkSync(file(name)); } catch (e) {} },
    list(prefix) {
      try { return fs.readdirSync(path.join(dir, prefix)).filter(f => f.endsWith('.json')).map(f => prefix + '/' + f.slice(0, -5)); } catch (e) { return []; }
    }
  };
}
module.exports = { createStore };
