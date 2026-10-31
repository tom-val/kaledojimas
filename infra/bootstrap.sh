#!/usr/bin/env bash
#
# One-time bootstrap for the knock-knock infrastructure.
# Run once in AWS CloudShell (or anywhere with admin AWS credentials) BEFORE the first
# `terraform apply` / first GitHub Actions deploy. Idempotent — safe to re-run.
#
# Creates:
#   1. The Terraform state S3 bucket (versioned + encrypted + private; locking via S3 lockfiles)
#   2. The GitHub Actions OIDC provider (if not already present)
#   3. An IAM role GitHub Actions assumes to deploy (prints its ARN at the end)
#
# Usage:
#   bash infra/bootstrap.sh
#
set -euo pipefail

# --- Config (override via env vars if you fork) ------------------------------
PROJECT="knock-knock"
REGION="${AWS_REGION:-eu-west-1}"
GITHUB_REPO="${GITHUB_REPO:-tom-val/kaledojimas}" # owner/repo allowed to assume the role
ROLE_NAME="${ROLE_NAME:-${PROJECT}-github-actions}"
APP_TABLE="KnockKnock"
# ---------------------------------------------------------------------------

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
# Also hardcoded in infra/environments/prod/providers.tf (backend blocks can't interpolate).
STATE_BUCKET="${STATE_BUCKET:-${PROJECT}-terraform-state}"
OIDC_HOST="token.actions.githubusercontent.com"
OIDC_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/${OIDC_HOST}"

echo "Account:  ${ACCOUNT_ID}"
echo "Region:   ${REGION}"
echo "Repo:     ${GITHUB_REPO}"
echo

# --- 1. State bucket --------------------------------------------------------
if aws s3api head-bucket --bucket "${STATE_BUCKET}" 2>/dev/null; then
  echo "State bucket ${STATE_BUCKET} already exists"
else
  echo "Creating state bucket ${STATE_BUCKET}"
  aws s3api create-bucket \
    --bucket "${STATE_BUCKET}" \
    --region "${REGION}" \
    --create-bucket-configuration LocationConstraint="${REGION}"
fi
aws s3api put-bucket-versioning \
  --bucket "${STATE_BUCKET}" \
  --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption \
  --bucket "${STATE_BUCKET}" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws s3api put-public-access-block \
  --bucket "${STATE_BUCKET}" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
echo "State bucket configured (versioning + encryption + private)"
echo

# --- 2. GitHub OIDC provider ------------------------------------------------
if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "${OIDC_ARN}" >/dev/null 2>&1; then
  echo "GitHub OIDC provider already exists"
else
  echo "Creating GitHub OIDC provider"
  aws iam create-open-id-connect-provider \
    --url "https://${OIDC_HOST}" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" >/dev/null
  echo "OIDC provider created"
fi
echo

# --- 3. IAM role for GitHub Actions ----------------------------------------
TRUST_POLICY=$(
  cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "${OIDC_ARN}" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "${OIDC_HOST}:aud": "sts.amazonaws.com" },
      "StringLike": { "${OIDC_HOST}:sub": "repo:${GITHUB_REPO}:*" }
    }
  }]
}
JSON
)

# Deploy permissions: TF state + the services Terraform/CI manage.
# Broad for a small project; tighten per-resource if this ever holds someone else's data.
DEPLOY_POLICY=$(
  cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TFState",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::${STATE_BUCKET}",
        "arn:aws:s3:::${STATE_BUCKET}/*"
      ]
    },
    {
      "Sid": "AppTable",
      "Effect": "Allow",
      "Action": ["dynamodb:*"],
      "Resource": "arn:aws:dynamodb:${REGION}:${ACCOUNT_ID}:table/${APP_TABLE}"
    },
    {
      "Sid": "AppDeploy",
      "Effect": "Allow",
      "Action": ["lambda:*", "apigateway:*", "cloudfront:*", "logs:*", "acm:*"],
      "Resource": "*"
    },
    {
      "Sid": "AppBuckets",
      "Effect": "Allow",
      "Action": ["s3:*"],
      "Resource": [
        "arn:aws:s3:::${PROJECT}-*",
        "arn:aws:s3:::${PROJECT}-*/*"
      ]
    },
    {
      "Sid": "IamForLambdaRoles",
      "Effect": "Allow",
      "Action": [
        "iam:GetRole", "iam:GetRolePolicy", "iam:GetPolicy", "iam:GetPolicyVersion",
        "iam:ListRolePolicies", "iam:ListAttachedRolePolicies",
        "iam:ListInstanceProfilesForRole", "iam:ListRoleTags", "iam:ListPolicyVersions",
        "iam:CreateRole", "iam:DeleteRole", "iam:UpdateRole", "iam:UpdateAssumeRolePolicy",
        "iam:PutRolePolicy", "iam:DeleteRolePolicy",
        "iam:AttachRolePolicy", "iam:DetachRolePolicy",
        "iam:TagRole", "iam:UntagRole",
        "iam:CreateServiceLinkedRole"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassRoleToLambdaOnly",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::${ACCOUNT_ID}:role/${PROJECT}-*",
      "Condition": {
        "StringEquals": { "iam:PassedToService": "lambda.amazonaws.com" }
      }
    }
  ]
}
JSON
)

if aws iam get-role --role-name "${ROLE_NAME}" >/dev/null 2>&1; then
  echo "Updating trust policy on existing role ${ROLE_NAME}"
  aws iam update-assume-role-policy --role-name "${ROLE_NAME}" --policy-document "${TRUST_POLICY}" >/dev/null
else
  echo "Creating role ${ROLE_NAME}"
  aws iam create-role --role-name "${ROLE_NAME}" --assume-role-policy-document "${TRUST_POLICY}" >/dev/null
fi
aws iam put-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name "${PROJECT}-deploy" \
  --policy-document "${DEPLOY_POLICY}" >/dev/null
echo "Role ready"
echo

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"
echo "============================================================"
echo "Bootstrap complete."
echo
echo "Create a GitHub environment named Prod and add this as its secret AWS_ROLE_ARN:"
echo
echo "  ${ROLE_ARN}"
echo
echo "Optional: repository variable AWS_REGION, and EXPO_TOKEN + EAS_ENABLED=true once EAS is set up."
echo "Then push to main to run deploy-prod."
echo "============================================================"
