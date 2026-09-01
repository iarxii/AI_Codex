# Infrastructure Target

This repository currently deploys to Google Cloud Run by default, as shown in [deploy_production.bat](../deploy_production.bat).

This directory is reserved for the future Alibaba Cloud deployment target for the premium backend only.

## Current plan
- Keep the current repo deployment path working.
- Add Alibaba Cloud as a separate deployment target.
- Use the RAM user `aicodex-be-deploy` for GitHub Actions secrets.
- Start with dev-only Alibaba deployment, not full production automation.
