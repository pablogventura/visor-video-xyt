#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/e2e/fixtures/moving-box.mp4"
mkdir -p "$(dirname "$OUT")"
ffmpeg -y -f lavfi -i "testsrc=size=320x240:rate=30:duration=2" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart \
  "$OUT"
echo "Wrote $OUT"
ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height,avg_frame_rate,nb_frames -of default=nw=1 "$OUT"
