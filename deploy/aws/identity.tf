locals {
  github_oidc = {
    issuer_url  = "https://token.actions.githubusercontent.com"
    audience    = "sts.amazonaws.com"
    environment = "aws-production"
  }
}

resource "aws_iam_openid_connect_provider" "github" {
  count = var.github_oidc_provider_arn == null ? 1 : 0

  url             = local.github_oidc.issuer_url
  client_id_list  = [local.github_oidc.audience]
  thumbprint_list = var.github_oidc_thumbprint_list

  tags = {
    Name = "${local.name_prefix}-github-oidc"
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  name = "${local.name_prefix}-github-actions-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = coalesce(
            var.github_oidc_provider_arn,
            one(aws_iam_openid_connect_provider.github[*].arn),
          )
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = local.github_oidc.audience
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = var.github_oidc_subjects
          }
        }
      },
    ]
  })

  tags = {
    Name = "${local.name_prefix}-github-actions-deploy"
  }
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name = "${local.name_prefix}-github-actions-deploy"
  role = aws_iam_role.github_actions_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DeployFrontendAssets"
        Effect = "Allow"
        Action = [
          "s3:DeleteObject",
          "s3:GetBucketLocation",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:PutObject",
        ]
        Resource = [
          aws_s3_bucket.frontend_assets.arn,
          "${aws_s3_bucket.frontend_assets.arn}/*",
        ]
      },
      {
        Sid      = "InvalidateFrontendDistribution"
        Effect   = "Allow"
        Action   = "cloudfront:CreateInvalidation"
        Resource = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.frontend.id}"
      },
      {
        Sid      = "AuthorizeEcrPush"
        Effect   = "Allow"
        Action   = "ecr:GetAuthorizationToken"
        Resource = "*"
      },
      {
        Sid    = "PushBackendImage"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:BatchGetImage",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeRepositories",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart",
        ]
        Resource = aws_ecr_repository.backend.arn
      },
      {
        Sid    = "DeployBackendService"
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition",
          "ecs:UpdateService",
        ]
        Resource = "*"
      },
      {
        Sid    = "PassBackendTaskRoles"
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = [
          aws_iam_role.backend_task_execution.arn,
          aws_iam_role.backend_task.arn,
        ]
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "ecs-tasks.amazonaws.com"
          }
        }
      },
    ]
  })
}

check "github_oidc_subjects_are_environment_scoped" {
  assert {
    condition = alltrue([
      for subject in var.github_oidc_subjects : startswith(subject, "repo:${var.github_repository}:environment:")
    ])
    error_message = "GitHub OIDC subjects must be scoped to GitHub environments, not broad branch refs."
  }
}
