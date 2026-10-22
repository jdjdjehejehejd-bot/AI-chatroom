#!/usr/bin/env python3
"""Generate a fully synthetic device log (no real data) for demos and tests."""
import random
import sys
from datetime import datetime, timedelta


def generate(path, seed=1, n=400):
    rnd = random.Random(seed)
    t = datetime(2026, 1, 15, 9, 0, 0)
    lines = []
    msgs_ok = ["sensor read ok value={v}", "heartbeat seq={s}", "uplink queued bytes={b}",
               "battery level={p}%"]
    for i in range(n):
        t += timedelta(milliseconds=rnd.randint(100, 4000))
        if i == 150:                      # simulated reboot gap
            t += timedelta(seconds=75)
            lines.append(f"{t:%Y-%m-%d %H:%M:%S},000 INFO boot: firmware v1.2.{rnd.randint(1,9)} started")
        r = rnd.random()
        if r < 0.80:
            m = rnd.choice(msgs_ok).format(v=rnd.randint(0, 999), s=i, b=rnd.randint(10, 900),
                                           p=rnd.randint(5, 100))
            lines.append(f"{t:%Y-%m-%d %H:%M:%S},{t.microsecond//1000:03d} INFO {m}")
        elif r < 0.92:
            lines.append(f"{t:%Y-%m-%d %H:%M:%S},{t.microsecond//1000:03d} WARN uplink retry attempt={rnd.randint(1,5)}")
        elif r < 0.98:
            lines.append(f"{t:%Y-%m-%d %H:%M:%S},{t.microsecond//1000:03d} ERROR uplink timeout after {rnd.randint(3000,9000)}ms addr=0x{rnd.randint(4096,65535):x}")
        else:
            lines.append(f"{t:%Y-%m-%d %H:%M:%S},{t.microsecond//1000:03d} ERROR i2c nack addr=0x{rnd.randint(16,127):x}")
            lines.append("    at drivers/i2c.c:212 i2c_xfer()")
            lines.append("    at app/sensor.c:88 sensor_poll()")
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


if __name__ == "__main__":
    generate(sys.argv[1] if len(sys.argv) > 1 else "sample.log")
    print("wrote sample log")
