#!/bin/bash
set -e

echo "MongoDB Initialization Script Starting..."

# This script runs when MongoDB starts for the first time
# It's executed by docker-entrypoint.sh before starting mongod

# Note: At this point, mongod is not yet running, so we can't use mongosh
# The replica set initialization will happen after MongoDB starts

echo "MongoDB init script executed (replica set will be initialized after MongoDB starts)"

