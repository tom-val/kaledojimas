data "aws_caller_identity" "current" {}

locals {
  env    = "prod"
  prefix = var.project_name

  tags = merge({
    Project     = var.project_name
    Environment = local.env
    ManagedBy   = "terraform"
  }, var.tags)

  # S3 names are global, so the account id keeps them unique.
  web_bucket_name = "${local.prefix}-frontend-${data.aws_caller_identity.current.account_id}"

  # Built from the API id rather than module.gateway.api_endpoint, so CloudFront depends only on the
  # API resource and not on the Lambda integration.
  api_origin_domain = "${module.gateway.api_id}.execute-api.${var.aws_region}.amazonaws.com"

  web_cf_origin = "https://${module.cloudfront.domain_name}"
  web_origin    = var.custom_domain != "" ? "https://${var.custom_domain}" : local.web_cf_origin
}

# --- Data -------------------------------------------------------------------

module "dynamodb" {
  source = "../../modules/dynamodb"
  name   = "KnockKnock"
  tags   = local.tags
}

module "web" {
  source                      = "../../modules/s3-web"
  name                        = local.web_bucket_name
  cloudfront_distribution_arn = module.cloudfront.distribution_arn
  tags                        = local.tags
}

# --- Compute ----------------------------------------------------------------

module "api" {
  source = "../../modules/lambda"
  name   = "${local.prefix}-api"

  environment = {
    TABLE_NAME = module.dynamodb.table_name
    # Source maps from the esbuild bundle in stack traces.
    NODE_OPTIONS = "--enable-source-maps"
  }

  extra_policy_json = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:PutItem", "dynamodb:DeleteItem", "dynamodb:Query"]
      Resource = module.dynamodb.table_arn
    }]
  })

  tags = local.tags
}

module "gateway" {
  source               = "../../modules/api-gateway"
  name                 = "${local.prefix}-api"
  lambda_invoke_arn    = module.api.invoke_arn
  lambda_function_name = module.api.function_name
  # Wide open on purpose: browsers reach the API through CloudFront on the web app's own origin
  # (no preflight), native clients ignore CORS, and there are no credentials to protect.
  cors_allow_origins = ["*"]
  tags               = local.tags
}

# --- Edge -------------------------------------------------------------------

module "cloudfront" {
  source              = "../../modules/cloudfront"
  name                = local.prefix
  web_bucket_domain   = module.web.bucket_regional_domain_name
  api_origin_domain   = local.api_origin_domain
  custom_domain       = var.custom_domain
  acm_certificate_arn = var.acm_certificate_arn
  tags                = local.tags
}
