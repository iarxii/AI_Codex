variable "region" {
  type = string
}

variable "project_name" {
  type = string
}

resource "alicloud_cr_ee_instance" "main" {
  instance_name = "${var.project_name}acr"
  endpoint_type = "public"
  payment_type = "PayAsYouGo"
  renew_period = 1
}

resource "alicloud_cr_namespace" "main" {
  instance_id = alicloud_cr_ee_instance.main.id
  name        = lower(replace(var.project_name, "-", ""))
  auto_create = true
}

output "instance_id" {
  value = alicloud_cr_ee_instance.main.id
}

output "namespace" {
  value = alicloud_cr_namespace.main.name
}
