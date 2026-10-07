#!/bin/sh
# Prüft den Claude-Skill: Beispiele rechnen und Ergebnis mit dem HTML-Tool vergleichen (Rappen-genau).
# Aufruf: sh tests/skill_test.sh   (nach python3 build.py && node tools/build_skill.mjs)
set -e
cd "$(dirname "$0")/.."
OUT=$(mktemp -d)
for f in skill/lv-devis-tiefbau/beispiele/*.json; do node skill/lv-devis-tiefbau/scripts/rechne.js "$f" --out "$OUT" > "$OUT/$(basename "$f").md"; done
node tests/skill_parity.mjs "$OUT"
