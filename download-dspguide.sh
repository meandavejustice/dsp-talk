#!/bin/bash

BASE_URL="http://www.dspguide.com/"
EXT=".PDF"

# http://www.dspguide.com/CH1.PDF

for (( i=1; i<=34; i++ ))
do
    TITLE="CH$i$EXT"
    curl -O "$BASE_URL$TITLE"
done
