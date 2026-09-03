variable "project_name" {
  type = string
}

variable "region" {
  type = string
}

variable "instance_type" {
  type    = string
  default = "ecs.gn7i-c8g1.2xlarge"
}

variable "image_id" {
  type    = string
  default = "ubuntu_22_04_x64_20G_alibase_20191224.vhd"
}

variable "vswitch_id" {
  type = string
}

variable "security_group_id" {
  type = string
}

resource "alicloud_instance" "gpu_backend" {
  instance_name        = "${var.project_name}-gpu-backend"
  availability_zone    = split(",", var.vswitch_id)[0]
  instance_type        = var.instance_type
  image_id             = var.image_id
  security_group_id    = var.security_group_id
  vswitch_id           = var.vswitch_id
  system_disk_category = "cloud_essd"
  system_disk_size     = 100

  user_data = <<-EOF
    #!/bin/bash
    set -eux
    apt-get update
    apt-get install -y docker.io
    systemctl enable docker
    systemctl start docker
    echo "GPU backend placeholder. Replace with Docker Compose deployment and Ollama runtime config."
  EOF
}

output "instance_id" {
  value = alicloud_instance.gpu_backend.id
}

output "public_ip" {
  value = alicloud_instance.gpu_backend.public_ip
}
