#!/bin/bash

# Load environment variables from .env
if [ -f .env.development.local ]; then
  export $(grep -v '^#' .env.development.local | xargs)
else
  echo "No .env.development.local found"
  exit 1
fi

# Get the current git branch
#CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Check if current branch is 'main'
#if [ "$CURRENT_BRANCH" != "main" ]; then
#  DEPLOY_SSH_HOST="$DEPLOY_SSH_HOST"beta
#  PUBLIC_PATH=/beta
#else
#  PUBLIC_PATH=/
#fi

#yarn build -- --publicPath "$PUBLIC_PATH"
#yarn build
mkdir -p /tmp/isometry-map-deploy
rm -rf /tmp/isometry-map-deploy/*

rsync -av --exclude='*.test.ts' --exclude='*.test.ts.snap' isometry-map/src/ /tmp/isometry-map-deploy/

# Deploy to remote server
echo "DEPLOY_SSH_PORT: $DEPLOY_SSH_PORT"
echo "DEPLOY_SSH_HOST: $DEPLOY_SSH_HOST"
#scp -P $DEPLOY_SSH_PORT -r /tmp/isometry-map-deploy/* $DEPLOY_SSH_HOST
rsync -avz -e "ssh -p $DEPLOY_SSH_PORT" --exclude 'fonts/' --exclude 'admin/' /tmp/isometry-map-deploy/ "$DEPLOY_SSH_HOST"

