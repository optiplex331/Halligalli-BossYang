terraform {
  required_version = ">= 1.8.0, < 2.0.0"

  backend "remote" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0, < 7.0"
    }
  }
}
