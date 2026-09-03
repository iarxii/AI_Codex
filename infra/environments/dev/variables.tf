variable "region" {
  description = "Alibaba Cloud region for the dev deployment."
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Project prefix used in naming resources."
  type        = string
  default     = "aicodex"
}

variable "vpc_name" {
  description = "Name of the VPC for the Alibaba target environment."
  type        = string
  default     = "aicodex-vpc"
}

variable "vpc_cidr" {
  description = "CIDR block for the dev VPC."
  type        = string
  default     = "10.10.0.0/16"
}

variable "zone_ids" {
  description = "Availability zone IDs for the vswitches."
  type        = list(string)
  default     = ["ap-southeast-1a", "ap-southeast-1b"]
}

variable "vswitch_names" {
  description = "Names of the dev vswitches."
  type        = list(string)
  default     = ["aicodex-vsw-az1", "aicodex-vsw-az2"]
}

variable "vswitch_cidrs" {
  description = "CIDR blocks for the dev vswitches."
  type        = list(string)
  default     = ["10.10.1.0/24", "10.10.2.0/24"]
}

variable "admin_cidr_blocks" {
  description = "CIDR blocks allowed to reach SSH/admin ports."
  type        = list(string)
  default     = ["203.0.113.10/32"]
}

variable "backend_port" {
  description = "Port exposed by the FastAPI backend in the dev target."
  type        = number
  default     = 8000
}

variable "ollama_port" {
  description = "Port exposed by the Ollama service if it is intentionally exposed. Keep private unless required."
  type        = number
  default     = 11434
}

variable "ecs_instance_type" {
  description = "Instance type for the ECS GPU host running Ollama."
  type        = string
  default     = "ecs.gn7i-c8g1.2xlarge"
}

variable "ecs_image_id" {
  description = "OS image ID for the ECS GPU host."
  type        = string
  default     = "ubuntu_22_04_x64_20G_alibase_20191224.vhd"
}
