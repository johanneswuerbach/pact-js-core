#!/bin/sh

set -e

: "${1?Please supply the pact-ruby-standalone version to upgrade to}"

STANDALONE_VERSION=$1
TYPE=${2:-fix}
DASHERISED_VERSION=$(echo "${STANDALONE_VERSION}" | sed 's/\./\-/g')
BRANCH_NAME="chore/upgrade-to-pact-ruby-standalone-${DASHERISED_VERSION}"

git checkout master
git checkout standalone/versions.ts
git pull origin master

git checkout -b ${BRANCH_NAME}

cat standalone/versions.ts | sed "s/export const PACT_STANDALONE_VERSION.*/export const PACT_STANDALONE_VERSION = '${STANDALONE_VERSION}';/" > tmp-versions
mv tmp-versions standalone/versions.ts

git add standalone/versions.ts
git commit -m "${TYPE}: update standalone to ${STANDALONE_VERSION}"
git push --set-upstream origin ${BRANCH_NAME}

hub pull-request --message "${TYPE}: update standalone to ${STANDALONE_VERSION}"

git checkout master
