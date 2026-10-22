# logtimeline

Turn a raw device/firmware log into a clean, readable timeline report in one command.

No dependencies. Python 3.8+.

**No install needed:** try the in-browser version at https://jdjdjehejehejd-bot.github.io/Monaymonay/ (your log never leaves your computer).

## What it does

- Parses mixed timestamp formats: ISO (`2026-01-15 09:00:01,250`), Android logcat (`10-22 16:37:01.123`), syslog (`Oct 22 16:37:01`), and epoch seconds
- Normalizes and sorts events by time
- Detects log level (INFO / WARN / ERROR / FATAL)
- Attaches stack-trace lines to the event they belong to
- Collapses repeated identical lines (`x37`)
- Groups similar warnings/errors into patterns (numbers and addresses are masked)
- Marks silent gaps as possible reboot / hang / disconnect points
- Writes `report.md` (for reading) and `events.csv` (for Excel)

## Quick start

```bash
python logtimeline.py your_device.log
# -> out/report.md, out/events.csv
```

Try it with the bundled synthetic sample:

```bash
python make_sample_log.py sample.log
python logtimeline.py sample.log -o example_output
```

## Options

| Option | Meaning | Default |
|--------|---------|---------|
| `-o, --outdir` | output folder | `out` |
| `--level` | minimum level to keep (`DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`) | `DEBUG` |
| `--grep REGEX` | keep only messages matching the regex (case-insensitive) | off |
| `--gap SECONDS` | silence that starts a new segment | `30` |
| `--year` | year for formats that have none (logcat, syslog) | current year |

Examples:

```bash
# errors only
python logtimeline.py device.log --level ERROR

# everything about the modem, 10-second gap detection
python logtimeline.py device.log --grep "modem|ril|ims" --gap 10

# Android logcat from 2025
python logtimeline.py logcat.txt --year 2025
```

## Typical workflow for a field failure

1. Pull the log from the device.
2. Run `logtimeline.py` with `--level WARN` to see the top error patterns and the first error.
3. Look at the segment boundaries: a gap right before the first error often means a reboot.
4. Re-run with `--grep` on the suspicious subsystem to see just that story.
5. Paste the relevant lines from `report.md` into your bug report.

## Notes and limits

- Timestamps without a time zone are treated as-is (no conversion).
- Unknown line formats are skipped, or attached to the previous event if they follow one.
- Only the first 160 characters of each message appear in the timeline; the CSV has the full text.
- Do not upload logs that contain private or confidential data to public places.

## License

Personal and commercial use allowed for the purchaser's own logs. Do not redistribute the package.
