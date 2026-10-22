/* logtimeline core - JavaScript port of logtimeline.py.
 * Works in the browser (window.LogTimeline) and in Node (module.exports).
 * Everything runs locally: no network calls, no uploads.
 */
(function (root) {
  "use strict";

  var LEVELS = { V: 0, TRACE: 0, D: 1, DEBUG: 1, I: 2, INFO: 2, W: 3, WARN: 3, WARNING: 3,
                 E: 4, ERR: 4, ERROR: 4, F: 5, FATAL: 5 };
  var LEVEL_NAME = ["TRACE", "DEBUG", "INFO", "WARN", "ERROR", "FATAL"];
  var MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
                 Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };

  var RE_ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?(?:Z|[+-]\d{2}:?\d{2})?\s*/;
  var RE_LOGCAT = /^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?\s*/;
  var RE_SYSLOG = /^([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s*/;
  var RE_EPOCH = /^\[?\s*(\d{10})(?:\.(\d{1,6}))?\]?\s*/;
  var RE_LEVEL_WORD = /\b(FATAL|ERROR|ERR|WARNING|WARN|INFO|DEBUG|TRACE)\b/;
  var RE_LEVEL_LOGCAT = /^(\d+\s+\d+\s+)?([VDIWEF])(?:\/|\s+)\S/;

  function frac(s) {
    return parseInt(((s || "0") + "000000").slice(0, 6), 10);
  }

  // Timestamps are kept as microseconds since epoch (UTC fields as written in the log).
  function makeTime(y, mo, d, h, mi, s, micro) {
    if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || s > 60) return null;
    var dt = new Date(Date.UTC(y, mo - 1, d, h, mi, s, 0));
    if (dt.getUTCMonth() !== mo - 1) return null; // e.g. Feb 31
    return dt.getTime() * 1000 + micro;
  }

  function parseLine(line, year) {
    var m = RE_ISO.exec(line), t;
    if (m) {
      t = makeTime(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6], frac(m[7]));
      return t === null ? null : { t: t, rest: line.slice(m[0].length) };
    }
    m = RE_LOGCAT.exec(line);
    if (m) {
      t = makeTime(year, +m[1], +m[2], +m[3], +m[4], +m[5], frac(m[6]));
      return t === null ? null : { t: t, rest: line.slice(m[0].length) };
    }
    m = RE_SYSLOG.exec(line);
    if (m && MONTHS[m[1]]) {
      t = makeTime(year, MONTHS[m[1]], +m[2], +m[3], +m[4], +m[5], 0);
      return t === null ? null : { t: t, rest: line.slice(m[0].length) };
    }
    m = RE_EPOCH.exec(line);
    if (m) {
      return { t: parseInt(m[1], 10) * 1000000 + frac(m[2]), rest: line.slice(m[0].length) };
    }
    return null;
  }

  function detectLevel(rest) {
    var m = RE_LEVEL_WORD.exec(rest.slice(0, 80));
    if (m) return LEVELS[m[1]];
    m = RE_LEVEL_LOGCAT.exec(rest);
    if (m) return LEVELS[m[2]];
    return 2;
  }

  function signature(msg) {
    var s = msg.replace(/\b[0-9a-fA-F]{8,}\b/g, "#hex");
    s = s.replace(/0x[0-9a-fA-F]+|(?<![A-Za-z])\d+/g, function (x) {
      return x.indexOf("0x") === 0 ? "0x#" : "#";
    });
    return s.replace(/\s+/g, " ").trim().slice(0, 120);
  }

  function load(text, year) {
    var events = [], skipped = 0, last = null;
    var lines = text.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/\r$/, "");
      if (!line.trim()) continue;
      var p = parseLine(line, year);
      if (p === null) {
        if (last !== null) last.msg += " | " + line.trim();
        else skipped++;
        continue;
      }
      last = { t: p.t, level: detectLevel(p.rest), msg: p.rest.trim(), count: 1 };
      events.push(last);
    }
    events.sort(function (a, b) { return a.t - b.t; });
    return { events: events, skipped: skipped };
  }

  function dedupe(events) {
    var out = [];
    for (var i = 0; i < events.length; i++) {
      var e = events[i], prev = out[out.length - 1];
      if (prev && prev.msg === e.msg && prev.level === e.level) { prev.count += 1; continue; }
      e.count = 1;
      out.push(e);
    }
    return out;
  }

  function pad(n, w) { n = String(n); while (n.length < w) n = "0" + n; return n; }

  function fmtTime(t, withDate) {
    var d = new Date(Math.floor(t / 1000));
    var ms = Math.floor((t % 1000000) / 1000);
    var hms = pad(d.getUTCHours(), 2) + ":" + pad(d.getUTCMinutes(), 2) + ":" + pad(d.getUTCSeconds(), 2);
    var base = hms + "." + pad(ms, 3);
    if (!withDate) return base;
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1, 2) + "-" + pad(d.getUTCDate(), 2) + " " + base;
  }

  function fmtDuration(us) {
    var ms = Math.round(us / 1000);
    var h = Math.floor(ms / 3600000); ms -= h * 3600000;
    var m = Math.floor(ms / 60000); ms -= m * 60000;
    var s = Math.floor(ms / 1000); ms -= s * 1000;
    return h + ":" + pad(m, 2) + ":" + pad(s, 2) + "." + pad(ms, 3);
  }

  /* opts: { year, level: "DEBUG"|"INFO"|"WARN"|"ERROR"|"FATAL", grep: string, gap: seconds } */
  function analyze(text, opts) {
    opts = opts || {};
    var year = opts.year || new Date().getFullYear();
    var minLevel = LEVELS[(opts.level || "DEBUG").toUpperCase()];
    if (minLevel === undefined) minLevel = 1;
    var gapUs = (opts.gap === undefined || opts.gap === "" ? 30 : Number(opts.gap)) * 1000000;

    var loaded = load(text, year);
    var total = loaded.events.length;
    var events = loaded.events.filter(function (e) { return e.level >= minLevel; });
    var grepError = null;
    if (opts.grep) {
      try {
        var rx = new RegExp(opts.grep, "i");
        events = events.filter(function (e) { return rx.test(e.msg); });
      } catch (err) { grepError = String(err.message || err); }
    }
    events = dedupe(events);

    var result = { total: total, kept: events.length, skipped: loaded.skipped, grepError: grepError,
                   events: events, levels: {}, patterns: [], segments: [], firstError: null,
                   start: null, end: null };
    if (!events.length) return result;

    result.start = events[0].t;
    result.end = events[events.length - 1].t;
    events.forEach(function (e) {
      var n = LEVEL_NAME[e.level];
      result.levels[n] = (result.levels[n] || 0) + 1;
      if (!result.firstError && e.level >= 4) result.firstError = e;
    });

    var map = {}, order = [];
    events.forEach(function (e) {
      if (e.level < 3) return;
      var sig = signature(e.msg);
      if (!map[sig]) { map[sig] = { sig: sig, count: 0, first: e.t }; order.push(sig); }
      map[sig].count += e.count;
    });
    result.patterns = order.map(function (k) { return map[k]; })
      .sort(function (a, b) { return b.count - a.count; }).slice(0, 10);

    var seg = { events: [], gapBefore: null }, prev = null;
    result.segments.push(seg);
    events.forEach(function (e) {
      if (prev !== null && e.t - prev > gapUs) {
        seg = { events: [], gapBefore: e.t - prev };
        result.segments.push(seg);
      }
      seg.events.push(e);
      prev = e.t;
    });
    return result;
  }

  function toMarkdown(r, sourceName) {
    var L = [];
    L.push("# Log Timeline Report\n");
    if (!r.events.length) { L.push("No events matched.\n"); return L.join("\n"); }
    L.push("## Summary\n");
    L.push("- Source: `" + (sourceName || "pasted log") + "`");
    L.push("- Time range: " + fmtTime(r.start, true) + " -> " + fmtTime(r.end, true) +
           " (" + fmtDuration(r.end - r.start) + ")");
    L.push("- Events: " + r.total + " parsed, " + r.kept + " after filter/dedupe, " +
           r.skipped + " unparsable lines skipped");
    var lv = Object.keys(r.levels).sort(function (a, b) { return LEVELS[b] - LEVELS[a]; })
      .map(function (k) { return k + "=" + r.levels[k]; });
    L.push("- Levels: " + lv.join(", "));
    if (r.firstError) {
      L.push("- **First error**: " + fmtTime(r.firstError.t, true) + " - " + r.firstError.msg.slice(0, 100));
    }
    L.push("");
    if (r.patterns.length) {
      L.push("## Top warning/error patterns\n");
      L.push("| # | Count | First seen | Pattern |");
      L.push("|---|-------|------------|---------|");
      r.patterns.forEach(function (p, i) {
        L.push("| " + (i + 1) + " | " + p.count + " | " + fmtTime(p.first).slice(0, 8) + " | `" +
               p.sig.replace(/\|/g, "/") + "` |");
      });
      L.push("");
    }
    L.push("## Timeline\n");
    r.segments.forEach(function (s, i) {
      if (i > 0) L.push("\n> gap of " + fmtDuration(s.gapBefore) + " - possible reboot / hang / disconnect\n");
      L.push("### Segment " + (i + 1) + "\n");
      s.events.forEach(function (e) {
        var mark = { 3: "WARN", 4: "ERR ", 5: "FATAL" }[e.level] || "     ";
        L.push("- `" + fmtTime(e.t) + "` " + mark + " " + e.msg.slice(0, 160) +
               (e.count > 1 ? " (x" + e.count + ")" : ""));
      });
    });
    return L.join("\n") + "\n";
  }

  function csvCell(v) {
    v = String(v);
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }

  function toCsv(r) {
    var rows = [["timestamp", "level", "count", "signature", "message"]];
    r.events.forEach(function (e) {
      rows.push([fmtTime(e.t, true), LEVEL_NAME[e.level], e.count, signature(e.msg), e.msg]);
    });
    return rows.map(function (row) { return row.map(csvCell).join(","); }).join("\r\n") + "\r\n";
  }

  var api = { parseLine: parseLine, detectLevel: detectLevel, signature: signature,
              analyze: analyze, toMarkdown: toMarkdown, toCsv: toCsv,
              fmtTime: fmtTime, fmtDuration: fmtDuration, LEVEL_NAME: LEVEL_NAME };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LogTimeline = api;
})(typeof window !== "undefined" ? window : this);
