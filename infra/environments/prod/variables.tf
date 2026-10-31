variable "aws_region" {
  description = "Region for every resource"
  type        = string
  default     = "eu-west-1"
}

variable "project_name" {
  description = "Resource name prefix. Changing it renames (and for S3, replaces) live resources."
  type        = string
  default     = "knock-knock"
}

# Optional custom domain for the web app (e.g. tuktuk.example.lt). Empty ⇒ *.cloudfront.net only.
# In CI it comes from the GitHub variable APP_CUSTOM_DOMAIN.
variable "custom_domain" {
  type    = string
  default = ""
}

# ARN of an ISSUED us-east-1 ACM certificate covering custom_domain (created or reused in the ACM
# console). In CI it comes from the GitHub variable APP_ACM_CERTIFICATE_ARN.
variable "acm_certificate_arn" {
  type    = string
  default = ""
}

variable "tags" {
  description = "Extra tags merged into the defaults applied to every resource"
  type        = map(string)
  default     = {}
}
