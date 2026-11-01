terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }

  # Created by infra/bootstrap.sh. Backend blocks cannot interpolate, so a fork must edit these
  # literals AND pass the same bucket name to bootstrap.sh via STATE_BUCKET. S3 names are global:
  # plain "knock-knock-terraform-state" already belongs to another AWS account.
  # Locking uses S3 conditional writes (use_lockfile) — no DynamoDB lock table.
  backend "s3" {
    bucket       = "tomval-knock-knock-terraform-state"
    key          = "knock-knock/terraform.tfstate"
    region       = "eu-central-1"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.aws_region
}
