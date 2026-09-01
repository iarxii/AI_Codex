## DevOps CI/CD Pipeline Development Plan
**Based on:** `docs/alibaba_cloud_deployment_blueprint.md`
**Current repo baseline:** this repository is currently deployed to Google Cloud Run, not Alibaba ECS. The confirmed deployment facts are in [deploy_production.bat](../deploy_production.bat), [backend/Dockerfile](../backend/Dockerfile), and [backend/main.py](../backend/main.py).
**Scope:** define a future Alibaba Cloud deployment path for the premium inference backend only, without assuming this repo is already in that architecture.
**Testing:** standard unit + integration + smoke coverage for the current FastAPI service; contract testing is optional and should be added only after the target API contract is agreed.
**Extensibility:** modular design for future SAE/FC targets, but not treated as current repo reality.

---

### 1. Current Baseline

The repo today is not greenfield Alibaba infrastructure. The confirmed facts are:

- [deploy_production.bat](../deploy_production.bat) deploys to Google Cloud Run and Artifact Registry.
- [backend/Dockerfile](../backend/Dockerfile) is built for a Cloud Run-compatible container and exposes port 8080.
- [backend/main.py](../backend/main.py) includes Cloud Run-specific startup logic, GCS sync behavior, premium handshake enforcement, and a Go sidecar startup flow.
- There is no existing `infra/` directory, no Terraform root, and no GitHub Actions deployment pipeline currently in the repository.

Therefore, the plan below is a target-state proposal for an Alibaba deployment path, not a description of the repo’s current state.

---

### 2. Target Architecture (Alibaba Only)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FUTURE GITHUB ACTIONS PIPELINE                   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Static   │▶│ Unit     │▶│ Build    │▶│ Push to  │            │
│  │ checks   │  │ tests    │  │ image    │  │ ACR      │            │
│  └──────────┘  └──────────┘  └──────────┘  └────┬─────┘            │
│                                                  │                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │                  │
│  │ Terraform│▶│ ECS GPU  │▶│ Smoke/   │◀──────┘                  │
│  │ plan/apply│ │ deploy   │ │ contract │                         │
│  └──────────┘  └──────────┘  └──────────┘                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              ALIBABA CLOUD TARGET INFRASTRUCTURE                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │
│  │ VPC / SG    │  │ ACR         │  │ GPU ECS     │                  │
│  │ networking  │  │ image repo  │  │ backend     │                  │
│  └─────────────┘  └─────────────┘  └─────────────┘                  │
│         │               │               │                            │
│         └───────────────┼───────────────┘                            │
│                         ▼                                            │
│              ┌─────────────────────┐                                │
│              │ Terraform state    │                                │
│              │ OSS backend        │                                │
│              └─────────────────────┘                                │
└─────────────────────────────────────────────────────────────────────┘
```

This is a proposal for a future deployment target. It is not a current state claim about this repo.

---

### 3. Target Repository Structure

```
.
├── .github/
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── cd-dev.yml
│   │   ├── cd-staging.yml
│   │   ├── cd-prod.yml
│   │   └── contract-smoke.yml
│   └── actions/
│       ├── setup-terraform/
│       ├── setup-alicloud/
│       └── docker-build-push/
├── infra/
│   ├── environments/
│   │   ├── dev/
│   │   ├── staging/
│   │   └── prod/
│   ├── modules/
│   │   ├── vpc/
│   │   ├── security-group/
│   │   ├── acr/
│   │   ├── ecs-gpu/
│   │   ├── slb/
│   │   ├── oss/
│   │   └── ram/
│   └── backend.tf
├── backend/
│   ├── Dockerfile
│   ├── main.py
│   └── ...
├── client/
│   └── ...
├── docs/
│   ├── plans/
│   └── runbooks/
├── scripts/
│   ├── deploy.sh
│   └── smoke-test.sh
└── README.md
```

This structure should only be added after the project chooses Alibaba Cloud as the target deployment model. It is not present today.

---

### 4. Confirmed Facts vs. Decisions That Still Need Approval

#### Confirmed
- The repo currently deploys to Google Cloud Run.
- The backend is a FastAPI app with premium-handshake logic and Cloud Run-specific initialization.
- The project does not yet contain an infrastructure-as-code root or GitHub Actions deployment pipeline.

#### Not confirmed and therefore not assumed
- Alibaba region
- GPU family and size
- ACR vs other registry choice
- Terraform state backend ownership
- Model storage strategy
- SSL termination pattern
- Whether the Alibaba path is a replacement or an addition to the current Cloud Run path

This plan intentionally does not assume those details.

---

### 5. Decision-Ready Environment Model

| Environment | Trigger | Approval | Purpose |
|-------------|---------|----------|---------|
| dev | push to develop | automatic | feature validation |
| staging | manual promotion from main | 1 approver | pre-production validation |
| prod | manual tag-based promotion | 2 approvers | live traffic |

This model is a reasonable target posture, but it should only be adopted after the team agrees that Alibaba ECS is the actual production target.

---

### 6. Required Operational Decisions Before Implementation

#### 6.1 Model lifecycle
Decision required:
- bake the model into the container image,
- fetch it at first boot,
- persist to an attached ESSD volume,
- or store it in OSS/NAS and mount it at runtime.

This is the most important deployment decision because it drives startup time, cold-start recovery, and model durability.

#### 6.2 TLS and ingress
Decision required:
- Alibaba SLB with certificate manager,
- Cloudflare in front,
- or private-only access with no public endpoint.

#### 6.3 Terraform state backend
Decision required:
- create a new OSS bucket for state,
- reuse an existing OSS bucket,
- or keep state local until the platform is stable.

#### 6.4 Contract testing
Decision required:
- use Pact Broker,
- self-host a broker,
- or defer contract tests until the API contract is stable.

#### 6.5 GPU sizing and topology
Decision required:
- dev instance type,
- prod instance type,
- single-AZ vs multi-AZ,
- whether SLB is required from day one.

#### 6.6 Rollback strategy
Decision required:
- Terraform reapply of the prior working version,
- ECS rolling rollback,
- or blue/green deployment.

---

### 7. Proposed Terraform Modules (Target Only)

| Module | Purpose | Status |
|--------|---------|--------|
| `vpc` | network foundation | proposed |
| `security-group` | network segmentation and host-level ingress controls | proposed |
| `acr` | image registry | proposed |
| `ecs-gpu` | GPU compute host | proposed |
| `slb` | public ingress and TLS termination | proposed |
| `oss` | model/object persistence | proposed |
| `ram` | CI/CD identity and least privilege | proposed |

These modules are a target architecture. They are not a current implementation in this repository.

---

### 8. Testing Strategy for the Actual Repo

The repo currently has Python and FastAPI code, but no proof of an existing CI/CD deployment pipeline or a defined deployment contract. The testing path should therefore be practical and staged.

| Layer | Scope | Current status |
|-------|-------|----------------|
| Static | lint, type checks, config validation | to be introduced |
| Unit | app logic and validation | to be introduced or expanded |
| Integration | FastAPI + database + model dependencies | required before staging deployment |
| Smoke | health and key API checks after deploy | required |
| Contract | API contract verification | optional, pending contract agreement |
| Load | concurrency and throughput checks | optional, post-launch |

This is more accurate than assuming contract testing is already in scope.

---

### 9. Security and Secrets Model

The secure handling model should be defined for the future target, not treated as a current repo setup.

Target model:
- GitHub Environments for env-specific secrets
- RAM users with least-privilege policy
- ACR credentials scoped to the build pipeline only
- runtime credentials stored in Alibaba-managed secret storage or workload environment variables
- rotation policy defined by the team

This is a target-state design, not an existing deployment configuration.

---

### 10. Documentation Deliverables

The following docs are valid as a target list, but they should be created only after a deployment model is approved.

- `docs/pipeline/ci-cd-design.md`
- `docs/pipeline/testing-strategy.md`
- `docs/pipeline/secrets-management.md`
- `docs/runbooks/deploy-premium-backend.md`
- `docs/runbooks/rollback.md`
- `docs/runbooks/incident-response.md`
- `docs/runbooks/scale-gpu.md`
- `docs/architecture/adr/001-pipeline-architecture.md`
- `docs/architecture/adr/002-environment-strategy.md`
- `docs/architecture/adr/003-testing-strategy.md`

---

### 11. Implementation Phases (Reality-First)

| Phase | Deliverable | Reality check |
|-------|-------------|---------------|
| 0 | confirm the current deployment baseline | required; repo is currently Cloud Run-based |
| 1 | decide whether Alibaba is a replacement or an additional target | required before Terraform is created |
| 2 | define environment model and security model | required before workflow templates |
| 3 | create `infra/` and GitHub workflow scaffolding | required; not present today |
| 4 | build VPC, SG, RAM, ACR, and GPU ECS modules | required |
| 5 | build CI workflow and artifact publishing | required |
| 6 | build dev deployment flow | required |
| 7 | add staging and prod gating | required |
| 8 | add smoke and contract verification | required after API contract finalization |
| 9 | add observability and runbooks | required after production deployment |

---

### 12. Final Position

This plan should be treated as a future-state Alibaba Cloud deployment design for the premium backend, not as a current implementation. The critical corrections are:

- the repo is currently Cloud Run based, not Alibaba ECS based;
- the repo does not already contain Terraform or GitHub Actions deployment scaffolding;
- model, network, and rollback decisions must be made explicitly before engineering work begins;
- the plan should evolve from the real repo baseline rather than from an assumed greenfield architecture.

---

### 13. Recommended Next Actions

1. Confirm whether Alibaba is replacing the current Cloud Run deployment or adding another target.
2. Decide the model storage strategy.
3. Decide ingress and TLS termination.
4. Decide Terraform state ownership and registry choice.
5. Create `infra/` and workflow scaffolding only after those decisions are locked.
6. Then implement the VPC, RAM, ACR, and GPU ECS modules in that order.

This keeps the engineering work grounded in actual repo state and avoids building a deployment architecture on assumptions.
