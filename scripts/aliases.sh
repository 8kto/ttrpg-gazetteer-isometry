#!/usr/bin/env bash

# Rebuild PDF (use cache), no styles
alias bm="yarn tsx ./scripts/oktozine/build-module.ts main"

# Rebuild styles, rebuild PDF (use cache)
alias bb="yarn build:styles && yarn tsx scripts/oktozine/build-module.ts main"

# Rebuild all (by default: no cache)
alias b="yarn build"

# Rebuild cover
alias bc="yarn build:styles; yarn tsx ./scripts/oktozine/build-module.ts cover --no-html-skip"

# Clear build + rebuild all
alias bbb="rm -rf build/chunks-html; rm build/*.css; rm build/*.json; yarn build"

# Rebuild styles + OSR
alias bbo="yarn build:styles && yarn tsx scripts/oktozine/build-module.ts osr"

# Rebuild OSR
alias bo="yarn tsx scripts/oktozine/build-module.ts osr"
