#!/usr/bin/env python3
"""logtimeline - turn raw logs into a normalized timeline report.

Usage:
    python logtimeline.py INPUT.log [-o OUTDIR] [--year 2026] [--level WARN]
                          [--grep PATTERN] [--gap 30]

Outputs (in OUTDIR, default ./out):
    report.md   human-readable summary + timeline
    events.csv  normalized events (open in Excel)
"""
import argparse
import csv
import re
import sys
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path

LEVELS = {"V": 0, "TRACE": 0, "D": 1, "DEBUG": 1, "I": 2, "INFO": 2,
          "W": 3, "WARN": 3, "WARNING": 3, "E": 4, "ERR": 4, "ERROR": 4,
          "F": 5, "FATAL": 5}
LEVEL_NAME = {0: "TRACE", 1: "DEBUG", 2: "INFO", 3: "WARN", 4: "ERROR", 5: "FATAL"}

MONTHS = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}

# (name, regex, builder) - each regex must capture the timestamp at the line start.
RE_ISO = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?(?:Z|[+-]\d{2}:?\d{2})?\s*")
RE_LOGCAT = re.compile(
    r"^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?\s*")
RE_SYSLOG = re.compile(
    r"^([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s*")
RE_EPOCH = re.compile(r"^\[?\s*(\d{10})(?:\.(\d{1,6}))?\]?\s*")
RE_LEVEL_WORD = re.compile(r"\b(FATAL|ERROR|ERR|WARNING|WARN|INFO|DEBUG|TRACE)\b")
# logcat: "<pid> <tid> E Tag: msg" or "E/Tag(123): msg"
RE_LEVEL_LOGCAT = re.compile(r"(?:^|\s)(\d+\s+\d+\s+)?([VDIWEF])(?:/|\s+)\S")


def _frac(s):
    return int((s or "0").ljust(6, "0")[:6])


def parse_line(line, year):
    """Return (datetime, rest_of_line) or None."""
    m = RE_ISO.match(line)
    if m:
        y, mo, d, h, mi, s, f = m.groups()
        return datetime(int(y), int(mo), int(d), int(h), int(mi), int(s), _frac(f)), line[m.end():]
    m = RE_LOGCAT.match(line)
    if m:
        mo, d, h, mi, s, f = m.groups()
        try:
            return datetime(year, int(mo), int(d), int(h), int(mi), int(s), _frac(f)), line[m.end():]
        except ValueError:
            return None
    m = RE_SYSLOG.match(line)
    if m and m.group(1) in MONTHS:
        mo, d, h, mi, s = m.groups()
        try:
            return datetime(year, MONTHS[mo], int(d), int(h), int(mi), int(s)), line[m.end():]
        except ValueError:
            return None
    m = RE_EPOCH.match(line)
    if m:
        sec, f = m.groups()
        return datetime.utcfromtimestamp(int(sec)).replace(microsecond=_frac(f)), line[m.end():]
    return None


def detect_level(rest):
    m = RE_LEVEL_WORD.search(rest[:80])
    if m:
        return LEVELS[m.group(1)]
    m = RE_LEVEL_LOGCAT.match(rest)
    if m:
        return LEVELS[m.group(2)]
    return 2


def signature(msg):
    """Collapse variable parts so similar messages group together."""
    s = re.sub(r"\b[0-9a-fA-F]{8,}\b", "#hex", msg)
    # one pass: hex literals -> 0x#, standalone numbers -> # (digits inside words like i2c stay)
    s = re.sub(r"0x[0-9a-fA-F]+|(?<![A-Za-z])\d+",
               lambda m: "0x#" if m.group().startswith("0x") else "#", s)
    return re.sub(r"\s+", " ", s).strip()[:120]


def load(path, year):
    events, skipped = [], 0
    last = None
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for raw in f:
            line = raw.rstrip("\n")
            if not line.strip():
                continue
            p = parse_line(line, year)
            if p is None:
                # continuation line (stack trace etc.): attach to previous event
                if last is not None:
                    last["msg"] += " | " + line.strip()
                else:
                    skipped += 1
                continue
            ts, rest = p
            last = {"ts": ts, "level": detect_level(rest), "msg": rest.strip()}
            events.append(last)
    events.sort(key=lambda e: e["ts"])  # normalize ordering
    return events, skipped


def dedupe(events):
    """Drop consecutive identical messages, keeping a repeat count."""
    out = []
    for e in events:
        if out and out[-1]["msg"] == e["msg"] and out[-1]["level"] == e["level"]:
            out[-1]["count"] += 1
            continue
        e["count"] = 1
        out.append(e)
    return out


def build_report(events, args, skipped, total_before):
    lines = []
    w = lines.append
    w("# Log Timeline Report\n")
    if not events:
        w("No events matched.\n")
        return "\n".join(lines)
    start, end = events[0]["ts"], events[-1]["ts"]
    lvl = Counter(LEVEL_NAME[e["level"]] for e in events)
    w("## Summary\n")
    w(f"- Source: `{args.input}`")
    w(f"- Time range: {start} -> {end} ({end - start})")
    w(f"- Events: {total_before} parsed, {len(events)} after filter/dedupe, {skipped} unparsable lines skipped")
    w("- Levels: " + ", ".join(f"{k}={v}" for k, v in sorted(lvl.items(), key=lambda kv: -LEVELS[kv[0]])))
    first_err = next((e for e in events if e["level"] >= 4), None)
    if first_err:
        w(f"- **First error**: {first_err['ts']} - {first_err['msg'][:100]}")
    w("")

    errs = Counter()
    first_seen = {}
    for e in events:
        if e["level"] >= 3:
            sig = signature(e["msg"])
            errs[sig] += e["count"]
            first_seen.setdefault(sig, e["ts"])
    if errs:
        w("## Top warning/error patterns\n")
        w("| # | Count | First seen | Pattern |")
        w("|---|-------|------------|---------|")
        for i, (sig, c) in enumerate(errs.most_common(10), 1):
            w(f"| {i} | {c} | {first_seen[sig].strftime('%H:%M:%S')} | `{sig.replace('|', '/')}` |")
        w("")

    w("## Timeline\n")
    gap = timedelta(seconds=args.gap)
    prev = None
    seg = 1
    w(f"### Segment {seg}\n")
    for e in events:
        if prev and e["ts"] - prev > gap:
            seg += 1
            w(f"\n> gap of {e['ts'] - prev} - possible reboot / hang / disconnect\n")
            w(f"### Segment {seg}\n")
        mark = {4: "ERR ", 5: "FATAL", 3: "WARN"}.get(e["level"], "     ")
        rep = f" (x{e['count']})" if e["count"] > 1 else ""
        w(f"- `{e['ts'].strftime('%H:%M:%S.%f')[:-3]}` {mark} {e['msg'][:160]}{rep}")
        prev = e["ts"]
    return "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description="Normalize logs into a timeline report.")
    ap.add_argument("input")
    ap.add_argument("-o", "--outdir", default="out")
    ap.add_argument("--year", type=int, default=datetime.now().year,
                    help="year for formats without one (logcat, syslog)")
    ap.add_argument("--level", default="DEBUG", choices=[k for k in LEVELS if len(k) > 1],
                    help="minimum level to keep")
    ap.add_argument("--grep", default=None, help="keep only messages matching this regex")
    ap.add_argument("--gap", type=int, default=30, help="seconds of silence that start a new segment")
    args = ap.parse_args(argv)

    events, skipped = load(args.input, args.year)
    total = len(events)
    minlvl = LEVELS[args.level]
    events = [e for e in events if e["level"] >= minlvl]
    if args.grep:
        rx = re.compile(args.grep, re.I)
        events = [e for e in events if rx.search(e["msg"])]
    events = dedupe(events)

    out = Path(args.outdir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "report.md").write_text(build_report(events, args, skipped, total), encoding="utf-8")
    with open(out / "events.csv", "w", newline="", encoding="utf-8-sig") as f:
        cw = csv.writer(f)
        cw.writerow(["timestamp", "level", "count", "signature", "message"])
        for e in events:
            cw.writerow([e["ts"].isoformat(sep=" ", timespec="milliseconds"),
                         LEVEL_NAME[e["level"]], e["count"], signature(e["msg"]), e["msg"]])
    print(f"{total} events parsed -> {len(events)} kept. Wrote {out/'report.md'} and {out/'events.csv'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
