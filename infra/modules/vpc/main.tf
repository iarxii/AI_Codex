variable "region" {
  type = string
}

variable "project_name" {
  type = string
}

variable "vpc_name" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "zone_ids" {
  type = list(string)
}

variable "vswitch_names" {
  type = list(string)
}

variable "vswitch_cidrs" {
  type = list(string)
}

resource "alicloud_vpc" "main" {
  vpc_name   = var.vpc_name
  cidr_block = var.vpc_cidr
  description = "Primary VPC for ${var.project_name} dev deployment"
}

resource "alicloud_vswitch" "main" {
  count        = length(var.vswitch_names)
  vpc_id       = alicloud_vpc.main.id
  zone_id      = var.zone_ids[count.index]
  cidr_block   = var.vswitch_cidrs[count.index]
  vswitch_name = var.vswitch_names[count.index]
}

output "vpc_id" {
  value = alicloud_vpc.main.id
}

output "vswitch_ids" {
  value = [for item in alicloud_vswitch.main : item.id]
}
