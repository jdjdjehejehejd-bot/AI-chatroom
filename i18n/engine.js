/* 자동 생성: scripts/build-i18n.py (원본은 i18n/engine.js + i18n/strings.tsv). 직접 고치지 마세요.
   한국어 문장이 곧 키다. _t(키, 값)은 화면 문구, _tx(문장)은 서버가 보낸 한국어 문장(고정 문장·{자리표시자} 문장)을 번역한다. */
(function (g) {
  var LANGS = [["ko", "한국어"], ["en", "English"], ["ja", "日本語"], ["zh", "简体中文"], ["es", "Español"]];
  var IDX = { ko: 0, en: 1, ja: 2, zh: 3, es: 4 };
  var ROWS = /*ROWS*/[];
  function pick() {
    var c = null, q = /[?&]lang=([a-z]{2})/.exec(location.search);
    if (q) c = q[1]; else { try { c = localStorage.getItem("lang"); } catch (e) {} }
    if (c && IDX[c] != null) return c;
    var nl = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"];
    for (var i = 0; i < nl.length; i++) { var l = String(nl[i]).toLowerCase().slice(0, 2); if (IDX[l] != null) return l; }
    return "en";
  }
  var lang = pick(), col = IDX[lang], map = {}, pats = [];
  function esc(s) { return s.replace(/[.*+?^$()|[\]\\]/g, "\\$&"); }
  if (col) ROWS.forEach(function (r) {
    var ko = r[0], tr = r[col] || r[1] || ko; map[ko] = tr;
    if (/\{\w+\}/.test(ko)) {
      var names = [], src = esc(ko).replace(/\{(\w+)\}/g, function (m, n) { names.push(n); return "([\\s\\S]*?)"; });
      pats.push({ re: new RegExp("^" + src + "$"), names: names, tr: tr, w: ko.replace(/\{\w+\}/g, "").length });
    }
  });
  pats.sort(function (a, b) { return b.w - a.w; });
  function fmt(s, v) { return v ? s.replace(/\{(\w+)\}/g, function (m, k) { return k in v ? v[k] : m; }) : s; }
  g._lang = lang; g._langs = LANGS;
  g._t = function (k, v) { return fmt(col && map[k] !== undefined ? map[k] : k, v); };
  g._tx = function (s) {
    if (!col || typeof s !== "string" || !s) return s;
    if (map[s] !== undefined) return map[s];
    for (var i = 0; i < pats.length; i++) {
      var m = pats[i].re.exec(s); if (!m) continue;
      var v = {}; pats[i].names.forEach(function (n, j) { var x = m[j + 1]; v[n] = g._tx(x); });
      return fmt(pats[i].tr, v);
    }
    return s;
  };
  g._setLang = function (l) { if (IDX[l] == null) return; try { localStorage.setItem("lang", l); } catch (e) {} var u = new URL(location.href); u.searchParams.delete("lang"); location.href = u.toString(); };
  var HAN = /[가-힣]/, ATTR = ["placeholder", "aria-label", "title", "alt"];
  g._dom = function (root) {
    if (!col) return;
    var w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, null), n, list = [];
    while ((n = w.nextNode())) { var p = n.parentNode && n.parentNode.nodeName; if (p !== "SCRIPT" && p !== "STYLE" && HAN.test(n.nodeValue)) list.push(n); }
    list.forEach(function (n) { var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(n.nodeValue), k = m[2].replace(/\s*\n\s*/g, " "); if (map[k] !== undefined) n.nodeValue = m[1] + map[k] + m[3]; else if (map[m[2]] !== undefined) n.nodeValue = m[1] + map[m[2]] + m[3]; });
    (root || document).querySelectorAll("[placeholder],[aria-label],[title],[alt]").forEach(function (e) { ATTR.forEach(function (a) { var v = e.getAttribute(a); if (v && HAN.test(v) && map[v] !== undefined) e.setAttribute(a, map[v]); }); });
  };
  function init() {
    document.documentElement.lang = lang;
    g._dom(document.body);
    document.querySelectorAll('a[href="/terms"],a[href="/privacy"],a[href="/delete-account"]').forEach(function (a) { a.setAttribute("href", a.getAttribute("href") + "?lang=" + lang); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(window);
