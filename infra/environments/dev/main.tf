terraform {
  required_version = ">= 1.6.0"

  required_providers {
    alicloud = {
      source  = "aliyun/alicloud"
      version = "~> 1.230.0"
    }
  }
}

provider "alicloud" {
  region = var.region
}

module "network" {
  source = "../../modules/vpc"

  region          = var.region
  project_name    = var.project_name
  vpc_name        = var.vpc_name
  vpc_cidr        = var.vpc_cidr
  zone_ids        = var.zone_ids
  vswitch_cidrs   = var.vswitch_cidrs
  vswitch_names   = var.vswitch_names
}

module "security_group" {
  source = "../../modules/security-group"

  project_name      = var.project_name
  vpc_id            = module.network.vpc_id
  admin_cidr_blocks = var.admin_cidr_blocks
  backend_port      = var.backend_port
  ollama_port       = var.ollama_port
}
