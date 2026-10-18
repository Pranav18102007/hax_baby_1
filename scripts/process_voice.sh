#!/usr/bin/env bash
# Voice lines: assets-raw/audio-raw/V01_*.m4a (or .wav/.mp3/.ogg/.aac) -> public/assets/voice/V01.mp3
# Outtakes:    assets-raw/audio-raw/outtakes/*  -> public/assets/voice/outtakes/*.mp3
# Trims silence, normalises loudness, pitches up ~2 semitones (tempo kept), mono 64 kbps.
set -euo pipefail
cd "$(dirname "$0")/.."
IN=assets-raw/audio-raw
OUT=public/assets/voice
mkdir -p "$OUT/outtakes"
FX="silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,highpass=f=90,loudnorm=I=-16:TP=-1.5,aresample=44100,asetrate=44100*1.1225,aresample=44100,atempo=0.8909"
ids=()
shopt -s nullglob nocaseglob
for f in "$IN"/V*.{m4a,wav,mp3,ogg,aac,mp4} "$IN"/voice*.{m4a,wav,mp3,ogg,aac,mp4}; do
  base=$(basename "$f")
  # accepts "V13_wheee.m4a" and the phone's default "voice 13.m4a" / "voice13B.m4a"
  if [[ "$base" =~ ^[Vv]oice[[:space:]_-]*([0-9]+)([A-Ea-e]?) ]]; then id="V$(printf %02d "${BASH_REMATCH[1]#0}")${BASH_REMATCH[2]}"; else id=${base%%_*}; id=${id%%.*}; fi
  id=$(echo "$id" | tr '[:lower:]' '[:upper:]' | sed 's/^V12\([A-E]\)$/V12\L\1/')
  ffmpeg -v error -y -i "$f" -af "$FX" -ac 1 -b:a 64k "$OUT/$id.mp3" && ids+=("\"$id\"") && echo "voice $id"
done
songs=()
mkdir -p "$OUT/songs"
SONGFX="highpass=f=80,loudnorm=I=-18:TP=-1.5,aresample=44100,asetrate=44100*1.1225,aresample=44100,atempo=0.8909"
declare -A SONGNAME=([S01]="Pip sings: Twinkle, Twinkle" [S02]="Pip sings: Rock-a-bye Baby" [S03]="Pip sings: Hush, Little Baby")
for f in "$IN"/S0*.{m4a,wav,mp3,ogg,aac,mp4}; do
  id=$(basename "$f"); id=${id%%_*}; id=${id%%.*}; id=$(echo "$id" | tr '[:lower:]' '[:upper:]')
  ffmpeg -v error -y -i "$f" -af "$SONGFX" -ac 1 -b:a 80k "$OUT/songs/$id.mp3" && songs+=("{\"title\":\"${SONGNAME[$id]:-Pip sings}\",\"file\":\"songs/$id.mp3\"}") && echo "song $id"
done
outs=()
for f in "$IN"/outtakes/*.{m4a,wav,mp3,ogg,aac}; do
  name=$(basename "${f%.*}" | tr ' ' '-' | tr -cd '[:alnum:]-_'); ffmpeg -v error -y -i "$f" -af "$FX" -ac 1 -b:a 64k "$OUT/outtakes/$name.mp3" && outs+=("{\"title\":\"$(basename "${f%.*}")\",\"file\":\"$name.mp3\"}") && echo "outtake $name"
done
printf '{"recorded":[%s],"songs":[%s],"outtakes":[%s]}\n' "$(IFS=,; echo "${ids[*]-}")" "$(IFS=,; echo "${songs[*]-}")" "$(IFS=,; echo "${outs[*]-}")" > src/content/voice.json
echo "wrote src/content/voice.json"
