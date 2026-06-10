terraform {
  required_version = ">= 1.8.0, < 2.0.0"

  backend "remote" {}

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 4.0, < 5.0"
    }
  }
}
