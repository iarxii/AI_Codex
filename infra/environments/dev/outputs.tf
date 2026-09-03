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
