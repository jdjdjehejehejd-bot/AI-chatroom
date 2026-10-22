from datetime import datetime

import logtimeline as lt


def test_iso():
    ts, rest = lt.parse_line("2026-01-15 09:00:01,250 ERROR boom", 2026)
    assert ts == datetime(2026, 1, 15, 9, 0, 1, 250000)
    assert lt.detect_level(rest) == 4


def test_logcat():
    ts, rest = lt.parse_line("10-22 16:37:01.123  1234  1250 E RIL: fail", 2026)
    assert ts == datetime(2026, 10, 22, 16, 37, 1, 123000)
    assert lt.detect_level(rest) == 4


def test_syslog():
    ts, _ = lt.parse_line("Oct 22 16:37:01 host app[1]: hi", 2026)
    assert ts == datetime(2026, 10, 22, 16, 37, 1)


def test_signature_groups():
    assert lt.signature("timeout 123ms addr=0xff") == lt.signature("timeout 999ms addr=0x1a")


def test_end_to_end(tmp_path):
    import make_sample_log
    log = tmp_path / "s.log"
    make_sample_log.generate(str(log))
    assert lt.main([str(log), "-o", str(tmp_path / "out")]) == 0
    report = (tmp_path / "out" / "report.md").read_text(encoding="utf-8")
    assert "Top warning/error patterns" in report and "gap of" in report


def test_signature_keeps_words_readable():
    assert lt.signature("i2c nack addr=0x2a") == "i2c nack addr=0x#"
    assert lt.signature("retry attempt=3 after 250ms") == "retry attempt=# after #ms"
