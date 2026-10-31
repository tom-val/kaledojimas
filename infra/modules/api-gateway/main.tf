terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

variable "name" {
  type = string
}

variable "lambda_invoke_arn" {
  type = string
}

variable "lambda_function_name" {
  type = string
}

variable "cors_allow_origins" {
  type    = list(string)
  default = ["*"]
}

# There is no auth at all (ownership is a per-house token), so the stage throttle is the only brake
# on abuse — and on the bill. Generous for real use: one map refresh is a single request.
variable "throttle_rate_limit" {
  type    = number
  default = 50
}

variable "throttle_burst_limit" {
  type    = number
  default = 100
}

variable "tags" {
  type    = map(string)
  default = {}
}

# API Gateway answers CORS preflights itself from this config, so no OPTIONS route is needed.
resource "aws_apigatewayv2_api" "this" {
  name          = var.name
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = var.cors_allow_origins
    allow_methods = ["GET", "POST", "DELETE", "OPTIONS"]
    allow_headers = ["content-type", "x-house-token"]
    max_age       = 600
  }

  tags = var.tags
}

resource "aws_apigatewayv2_integration" "api" {
  api_id                 = aws_apigatewayv2_api.this.id
  integration_type       = "AWS_PROXY"
  integration_uri        = var.lambda_invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Catch-all — the Node handler does all routing (/health, /v1/*).
resource "aws_apigatewayv2_route" "default" {
  api_id    = aws_apigatewayv2_api.this.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.api.id}"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.this.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_rate_limit  = var.throttle_rate_limit
    throttling_burst_limit = var.throttle_burst_limit
  }

  tags = var.tags
}

resource "aws_lambda_permission" "api" {
  statement_id  = "AllowAPIGWInvoke"
  action        = "lambda:InvokeFunction"
  function_name = var.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.this.execution_arn}/*/*"
}

output "api_endpoint" {
  value = aws_apigatewayv2_stage.default.invoke_url
}

# Lets CloudFront build the origin hostname from the API id alone.
output "api_id" {
  value = aws_apigatewayv2_api.this.id
}
