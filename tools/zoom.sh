#!/bin/sh
# usage: SHOT_DIR=<dir> tools/zoom.sh <name> <x> <y> <w> <h> [scale]  -> <name>_zoom.png: that region of <name>.png, enlarged
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
SC=${6:-4}
cat > "${SHOT_DIR}/_zoom.html" <<HTML
<body style="margin:0;background:#000;overflow:hidden"><img src="$1.png" style="position:absolute;left:calc(-$2px * $SC);top:calc(-$3px * $SC);width:calc(1280px * $SC);image-rendering:pixelated">
HTML
"$CH" --headless=new --window-size=$(($4 * SC)),$(($5 * SC)) --hide-scrollbars --user-data-dir="${SHOT_DIR}/prof-zoom" --screenshot="${SHOT_DIR}/$1_zoom.png" "file:///${SHOT_DIR}/_zoom.html" >/dev/null 2>&1
