#!/bin/sh
# Prüft den Claude-Skill (Python-Rechenkern) gegen das HTML-Tool.
# Aufruf: sh tests/skill_test.sh   (nach python3 build.py && node tools/build_skill.mjs)
set -e
cd "$(dirname "$0")/.."
OUT=$(mktemp -d)
# 1) Beispiele rechnen und im HTML-Tool laden (Rappen-genau)
for f in skill/lv-devis-tiefbau/beispiele/*.json; do python3 skill/lv-devis-tiefbau/scripts/rechne.py "$f" --out "$OUT" > "$OUT/$(basename "$f").md"; done
node tests/skill_parity.mjs "$OUT"
# 2) 300 Zufallsprojekte: Python-Rechenkern gegen Original-Rechenkern, Position für Position
python3 tests/skill_fuzz.py "$OUT/fuzz" 300 > /dev/null
node tests/skill_fuzz_cmp.mjs "$OUT/fuzz"
