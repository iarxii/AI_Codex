variable "project_name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "admin_cidr_blocks" {
  type = list(string)
}

variable "backend_port" {
  type = number
}

variable "ollama_port" {
  type = number
}

resource "alicloud_security_group" "backend" {
  security_group_name = "${var.project_name}-sg"
  vpc_id              = var.vpc_id
}

resource "alicloud_security_group_rule" "ssh" {
  count             = length(var.admin_cidr_blocks)
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "22/22"
  priority          = 1
  security_group_id = alicloud_security_group.backend.id
  cidr_ip           = var.admin_cidr_blocks[count.index]
}

resource "alicloud_security_group_rule" "backend_http" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "80/80"
  priority          = 2
  security_group_id = alicloud_security_group.backend.id
  cidr_ip           = "0.0.0.0/0"
}

resource "alicloud_security_group_rule" "backend_https" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "443/443"
  priority          = 3
  security_group_id = alicloud_security_group.backend.id
  cidr_ip           = "0.0.0.0/0"
}

resource "alicloud_security_group_rule" "backend_api" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "${var.backend_port}/${var.backend_port}"
  priority          = 4
  security_group_id = alicloud_security_group.backend.id
  cidr_ip           = "0.0.0.0/0"
}

resource "alicloud_security_group_rule" "ollama_private" {
  type              = "ingress"
  ip_protocol       = "tcp"
  nic_type          = "intranet"
  policy            = "accept"
  port_range        = "${var.ollama_port}/${var.ollama_port}"
  priority          = 5
  security_group_id = alicloud_security_group.backend.id
  cidr_ip           = "10.10.0.0/16"
}

output "security_group_id" {
  value = alicloud_security_group.backend.id
}
