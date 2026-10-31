# Copy to prod.tfvars (gitignored) for local runs, or pass via TF_VAR_* in CI.
aws_region   = "eu-west-1"
project_name = "knock-knock"

# Optional custom domain (in CI: GitHub variables APP_CUSTOM_DOMAIN + APP_ACM_CERTIFICATE_ARN).
# The certificate is an ISSUED ACM certificate in us-east-1, created or reused in the ACM console.
# custom_domain       = "tuktuk.example.lt"
# acm_certificate_arn = "arn:aws:acm:us-east-1:<account>:certificate/<id>"
