// Run with: node site/test.js
const assert = require("node:assert/strict");
const lt = require("./logtimeline.js");

function us(y, mo, d, h, mi, s, micro) {
  return Date.UTC(y, mo - 1, d, h, mi, s) * 1000 + (micro || 0);
}

// --- timestamp formats
let p = lt.parseLine("2026-01-15 09:00:01,250 ERROR boom", 2026);
assert.equal(p.t, us(2026, 1, 15, 9, 0, 1, 250000));
assert.equal(lt.detectLevel(p.rest), 4);

p = lt.parseLine("10-22 16:37:01.123  1234  1250 E RIL: fail", 2026);
assert.equal(p.t, us(2026, 10, 22, 16, 37, 1, 123000));
assert.equal(lt.detectLevel(p.rest), 4);

p = lt.parseLine("Oct 22 16:37:01 host app[1]: hi", 2026);
assert.equal(p.t, us(2026, 10, 22, 16, 37, 1));

p = lt.parseLine("[1700000000.5] hello", 2026);
assert.equal(p.t, 1700000000 * 1000000 + 500000);

assert.equal(lt.parseLine("not a log line", 2026), null);
assert.equal(lt.parseLine("02-31 10:00:00.000 I x", 2026), null); // impossible date

// --- signatures stay readable
assert.equal(lt.signature("i2c nack addr=0x2a"), "i2c nack addr=0x#");
assert.equal(lt.signature("retry attempt=3 after 250ms"), "retry attempt=# after #ms");
assert.equal(lt.signature("timeout 123ms addr=0xff"), lt.signature("timeout 999ms addr=0x1a"));

// --- end to end: dedupe, continuation lines, gap, patterns, filters
const log = [
  "2026-01-15 09:00:00,000 INFO boot ok",
  "2026-01-15 09:00:01,000 WARN retry attempt=1",
  "2026-01-15 09:00:02,000 WARN retry attempt=2",
  "2026-01-15 09:00:03,000 ERROR i2c nack addr=0x2a",
  "    at drivers/i2c.c:212 i2c_xfer()",
  "2026-01-15 09:00:03,000 ERROR i2c nack addr=0x2a",
  "2026-01-15 09:02:00,000 INFO boot: firmware started",
].join("\n");

let r = lt.analyze(log, { year: 2026 });
assert.equal(r.total, 6);
assert.equal(r.segments.length, 2, "one gap -> two segments");
assert.equal(r.segments[1].gapBefore, 117 * 1000000);
assert.equal(r.firstError.msg.startsWith("ERROR i2c nack"), true);
assert.equal(r.patterns[0].count >= 2, true);
assert.ok(r.events.some((e) => e.msg.includes("at drivers/i2c.c")), "continuation attached");

r = lt.analyze(log, { year: 2026, level: "ERROR" });
assert.equal(r.kept, 2);
r = lt.analyze(log, { year: 2026, grep: "boot" });
assert.equal(r.kept, 2);
r = lt.analyze(log, { year: 2026, grep: "(" });
assert.ok(r.grepError, "bad regex reported, not thrown");

const md = lt.toMarkdown(lt.analyze(log, { year: 2026 }), "test.log");
assert.ok(md.includes("Top warning/error patterns") && md.includes("gap of"));
const csv = lt.toCsv(lt.analyze(log, { year: 2026 }));
assert.ok(csv.startsWith("timestamp,level,count,signature,message"));
assert.equal(lt.analyze("", {}).kept, 0);

console.log("all js tests passed");
