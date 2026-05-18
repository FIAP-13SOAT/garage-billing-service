#!/bin/bash
set -e
CLI="aws --endpoint-url=http://localhost:4566 --region us-east-1"

for Q in billing-commands billing-replies; do
  $CLI sqs create-queue --queue-name "garage-$Q"
done
