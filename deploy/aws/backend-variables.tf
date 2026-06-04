variable "backend_certificate_arn" {
  description = "ACM certificate ARN for the HTTPS Backend Entry. Supply a real eu-west-1 certificate through GitHub Environment values."
  type        = string

  validation {
    condition     = can(regex("^arn:aws(-[a-z]+)?:acm:eu-west-1:[0-9]{12}:certificate/.+", var.backend_certificate_arn))
    error_message = "Backend certificate ARN must be an ACM certificate ARN in eu-west-1."
  }
}

variable "backend_image_tag" {
  description = "AWS Production Scaffold Image tag expected in the ECR backend repository."
  type        = string
  default     = "aws-production-scaffold-placeholder"

  validation {
    condition     = can(regex("^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$", var.backend_image_tag))
    error_message = "Backend image tag must be a valid Docker tag."
  }
}

variable "backend_desired_count" {
  description = "Backend ECS desired task count. Keep at one for demos, or set to zero only for teardown."
  type        = number
  default     = 1

  validation {
    condition     = contains([0, 1], var.backend_desired_count)
    error_message = "Backend desired count may only be 0 or 1; multiplayer horizontal scaling is out of scope."
  }
}

variable "backend_task_cpu" {
  description = "Fargate CPU units for the single AWS Production Scaffold backend task."
  type        = number
  default     = 256

  validation {
    condition     = contains([256, 512, 1024], var.backend_task_cpu)
    error_message = "Backend task CPU must use a small Fargate size suitable for scaffold demos."
  }
}

variable "backend_task_memory" {
  description = "Fargate memory MiB for the single AWS Production Scaffold backend task."
  type        = number
  default     = 512

  validation {
    condition     = contains([512, 1024, 2048], var.backend_task_memory)
    error_message = "Backend task memory must use a small Fargate size suitable for scaffold demos."
  }
}

variable "backend_app_version" {
  description = "Release Identity placeholder for APP_VERSION until the manual AWS Production Scaffold deployment workflow injects a release value."
  type        = string
  default     = "aws-production-scaffold-placeholder"

  validation {
    condition     = length(trimspace(var.backend_app_version)) > 0
    error_message = "Backend APP_VERSION placeholder must not be empty."
  }
}

variable "backend_commit_sha" {
  description = "Release Identity placeholder for COMMIT_SHA until the manual AWS Production Scaffold deployment workflow injects a commit SHA."
  type        = string
  default     = "0000000000000000000000000000000000000000"

  validation {
    condition     = can(regex("^[0-9a-f]{7,40}$", var.backend_commit_sha))
    error_message = "Backend COMMIT_SHA placeholder must look like a lowercase git SHA."
  }
}
