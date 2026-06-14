#!/usr/bin/env bash

set +e
shopt -s globstar nullglob

gc="git commit"
ga="git add"

yarn format:fix

$gc src/markdown/*stats* -m 'Extend monsters refs'
$gc src/markdown/\$* -m 'Update notes and non-reader texts'
$gc src/markdown/*appendix* -m 'Update appendices'

$ga src/markdown/*.md
#git reset 0800-bestiary--autogen.md
$gc -m 'Extend rooms'

$gc src/styles/*.css -m 'Update styles'
$gc src/html/* -m 'Update layout files'

#$gc Conventions.md -m 'Extend conventions'
$gc scripts/git-commit.sh -m 'Update commit script'
$gc scripts/**/*.mjs -m 'Update build scripts'
$gc scripts/**/*.sh -m 'Update project scripts'

#$gc conf/*build.conf.mjs -m 'Update module build config'
#$gc conf/*toc.conf.mjs -m 'Update TOC overrides'
#$gc Readme.md -m 'Update readme file'

#$ga maps
#$gc -m 'Extend maps'

exit 0
