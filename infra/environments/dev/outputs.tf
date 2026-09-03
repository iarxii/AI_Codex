output "vpc_id" {
  description = "ID of the pre-production VPC."
  value       = module.network.vpc_id
}

output "vswitch_ids" {
  description = "IDs of the dev vswitches."
  value       = module.network.vswitch_ids
}

output "security_group_id" {
  description = "ID of the backend security group."
  value       = module.security_group.security_group_id
}

output "ecs_public_ip" {
  description = "Public IP of the ECS GPU host running Ollama."
  value       = module.ecs_gpu.public_ip
}

output "ecs_instance_id" {
  description = "Instance ID of the ECS GPU host."
  value       = module.ecs_gpu.instance_id
}

output "acr_instance_id" {
  description = "ID of the Alibaba Container Registry instance."
  value       = module.acr.instance_id
}

output "acr_namespace" {
  description = "Namespace created in the Alibaba Container Registry instance."
  value       = module.acr.namespace
}
