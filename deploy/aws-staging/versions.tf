terraform {
  required_version = ">= 1.8.0, < 2.0.0"

  cloud {
    organization = "halligalli-games"

    workspaces {
      name = "halligalli-aws-staging"
    }
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0, < 7.0"
    }
  }
}
