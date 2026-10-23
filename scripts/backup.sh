#!/bin/sh
# 사용법: DATA_DIR=/data BACKUP_DIR=/backup KEEP=14 sh scripts/backup.sh   (cron으로 매일 실행)
# 백업은 개인정보처리방침의 보관 기간(기본 14일)을 넘기지 않게 KEEP으로 회전한다.
set -eu
: "${DATA_DIR:?DATA_DIR 필요}"; : "${BACKUP_DIR:?BACKUP_DIR 필요}"; KEEP="${KEEP:-14}"
mkdir -p "$BACKUP_DIR"
f="$BACKUP_DIR/data-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$f" -C "$DATA_DIR" .
chmod 600 "$f"
ls -1t "$BACKUP_DIR"/data-*.tar.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "backup: $f"
