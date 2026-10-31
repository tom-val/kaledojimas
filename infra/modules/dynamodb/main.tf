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

variable "tags" {
  type    = map(string)
  default = {}
}

# PK = CELL#<geohash-5>, SK = HOUSE#<id> (see backend/src/store.ts). Listing a map area is 9 Query
# calls (the cell + its neighbours), never a Scan. On-demand billing: traffic is one spiky evening a year.
resource "aws_dynamodb_table" "this" {
  name         = var.name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # Houses expire 6 h after they are marked; TTL deletes them (lazily — the API also filters).
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  # No point-in-time recovery or prevent_destroy: every row is ephemeral by design.

  tags = var.tags
}

output "table_name" {
  value = aws_dynamodb_table.this.name
}

output "table_arn" {
  value = aws_dynamodb_table.this.arn
}
