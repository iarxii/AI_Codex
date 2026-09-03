# Infrastructure Target

This repository currently deploys to Google Cloud Run by default, as shown in [deploy_production.bat](../deploy_production.bat).

This directory is reserved for the future Alibaba Cloud deployment target for the premium backend only. The implementation work here is intentionally additive and should not replace the active Cloud Run deployment.

## Current plan
- Keep the current repo deployment path working.
- Add Alibaba Cloud as a separate deployment target.
- Use the RAM user `aicodex-be-deploy` for GitHub Actions secrets.
- Start with dev-only Alibaba deployment, not full production automation.

## Initial implementation baseline
- VPC: `aicodex-vpc` with a private RFC1918 range such as `10.10.0.0/16`
- vSwitches:
  - `aicodex-vsw-az1` = `10.10.1.0/24`
  - `aicodex-vsw-az2` = `10.10.2.0/24`
- Registry: Alibaba Container Registry (ACR)
- Compute target: dedicated GPU ECS for the premium backend
- Gate: dev workflow first, then staging and prod workflows after smoke validation and approval

## Repository reality check
- This is not a greenfield Alibaba migration.
- The repo is still Cloud Run-first.
- The Alibaba files here are scaffolded for the next target environment, not a replacement deployment stack.
