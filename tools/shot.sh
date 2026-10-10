#!/bin/sh
# usage: SHOT_DIR=<windows dir> tools/shot.sh <name> <hash>   -> <name>.png of index.html#<hash>
# Hash flags (see js/main.js): demo, title, gallery, stageN, upsN, with=id,id, unlockall, boss, treasure, room=TYPE, gates, still, pause, -tSECONDS
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
"$CH" --headless=new --enable-unsafe-swiftshader --window-size=1280,720 --hide-scrollbars --virtual-time-budget=2500 \
  --user-data-dir="${SHOT_DIR}/prof-$1" --screenshot="${SHOT_DIR}/$1.png" "file:///C:/Users/richa/geometry-bash/index.html#$2" >/dev/null 2>&1
