# 第二阶段 DevOps 学习手册：AWS Staging Scaffold

这份文档是给 DevOps 新手阅读的第二阶段学习手册。它解释 Halligalli 项目在第二阶段新增了什么、为什么这样设计、每个 DevOps 概念在项目里对应什么文件和操作。

第二阶段的核心不是“把生产环境迁到 AWS”，而是建立一个可审查、可学习、可手动启用的 AWS Staging/Portfolio 基础设施脚手架。现有的 DigitalOcean Production 仍然是正式生产路径。

## 你应该先建立的判断

当前第二阶段完成的是 **scaffold**，不是 live environment。

这意味着仓库里已经有：

- Terraform 对 AWS 资源形状的声明。
- GitHub Actions 手动部署工作流。
- 前端和后端分开部署的路径。
- GitHub environment secrets/variables 的配置清单。
- 本地验证命令。
- 成本边界和人工确认机制。

但仓库目前没有，也不应该提交：

- Terraform state。
- `.tfvars` 里的真实环境值。
- AWS access key。
- GitHub secrets。
- 渲染后的 ECS task definition。
- 本地 `.env`。

如果你是 DevOps 新手，可以把第二阶段理解成：

```text
先把云上系统应该长什么样写进 Git
  -> 本地和 CI 能验证这些声明是否基本正确
  -> 真正创建或更新 AWS 资源时必须由人手动确认
  -> 这个 staging 环境用于学习和作品集展示
  -> 正式生产仍然走已有的 DO Production GitOps 路径
```

## 第二阶段新增了什么

| 新增内容 | 位置 | 你应该如何理解 |
|---|---|---|
| AWS staging Terraform root | `deploy/aws-staging/` | 用 Terraform 描述 AWS staging 环境需要哪些资源。 |
| AWS staging 操作文档 | `docs/operations/aws-staging.md` | 也就是本文，解释架构、操作和学习路径。 |
| Terraform root 说明 | `deploy/aws-staging/README.md` | 说明这个 Terraform 目录的边界和验证方式。 |
| 手动 GitHub Actions workflow | `.github/workflows/aws-staging.yml` | 让人可以手动选择验证、部署前端、部署后端、或 smoke test。 |
| CI change routing 配置 | `.github/utils/change-filters.yaml` | 把 `deploy/aws-staging/**` 归为 Delivery Control，避免误触发生产发布路径。 |

第二阶段的状态可以这样总结：

```text
已完成：可审查的 AWS staging 基础设施和交付路径
未完成：真实 AWS 资源创建、真实域名证书配置、真实 staging 上线
不做：生产 cutover、Kubernetes、PostgreSQL、Redis、Argo CD、Flux
```

## 目标架构

第二阶段目标是用 AWS 展示主流 DevOps/Cloud Engineering 能力，同时不破坏当前生产环境。

```text
用户浏览器
  -> https://play.halligalli.games
  -> CloudFront
  -> S3 static frontend assets

React/Vite frontend
  -> VITE_HALLIGALLI_BACKEND_URL=https://api.halligalli.games
  -> HTTPS / WSS
  -> Application Load Balancer
  -> ECS Fargate task
  -> Node.js 24 + socket.io backend

Infrastructure
  -> Terraform
  -> Terraform Cloud remote state
  -> AWS resources in eu-west-1
```

| 部分 | 第二阶段选择 | 作用 |
|---|---|---|
| Region | `eu-west-1` | AWS staging 主要运行区域，欧洲爱尔兰。 |
| Domain | `halligalli.games` | staging 作品集域名。 |
| Frontend URL | `https://play.halligalli.games` | 用户访问的前端地址。 |
| Backend URL | `https://api.halligalli.games` | 前端访问后端和 socket.io 的地址。 |
| Frontend hosting | S3 + CloudFront | 存放并分发 Vite 构建后的静态文件。 |
| Backend runtime | ECR + ECS Fargate + ALB | 构建容器镜像，并在 AWS 上运行后端服务。 |
| DNS | Route 53 | 管理 staging 子域名记录。 |
| State | Terraform Cloud | 保存 Terraform 状态，不提交到 Git。 |
| Production | DigitalOcean App Platform | 保持现有生产路径不变。 |

## 为什么前端和后端要分开

Halligalli 的前端是 React/Vite 应用。构建后，它只是一组静态文件，比如 HTML、CSS、JS、图片。这类内容适合放在 S3，再由 CloudFront 做 HTTPS、缓存和全球分发。

后端是 Node.js 24 + socket.io。它不是静态文件，而是一个长时间运行的服务，需要处理 HTTP、`/readyz`、`/health` 和 WebSocket/socket.io 连接。所以后端被打包成 Docker image，推送到 ECR，再由 ECS Fargate 运行。

这个拆分能让你学到一个重要 DevOps 思维：

```text
不同类型的 workload 应该使用不同的交付和运行方式。

静态前端：build -> upload -> CDN invalidate
后端服务：build image -> push registry -> update service -> health check
```

## 学习路线

建议按这个顺序阅读和理解文件：

1. `docs/operations/aws-staging.md`

   先读本文，建立第二阶段的目标、边界和架构图。

2. `deploy/aws-staging/README.md`

   理解 Terraform root 是什么，以及为什么这里默认只做静态验证。

3. `deploy/aws-staging/locals.tf`

   看命名、标签、成本策略如何集中定义。这里能学到基础设施命名和 tagging 的重要性。

4. `deploy/aws-staging/variables.tf`

   看 region、domain、subdomain、NAT Gateway 等输入如何被限制。这里能学到 guardrail。

5. `deploy/aws-staging/frontend.tf`

   看 S3、CloudFront、ACM certificate、Route 53 record 如何组成前端 hosting。

6. `deploy/aws-staging/backend.tf`

   看 ECR、VPC、subnet、security group、ALB、ECS Fargate、task definition 如何组成后端运行环境。

7. `.github/workflows/aws-staging.yml`

   看 GitHub Actions 如何把“验证、部署前端、部署后端、smoke test”组织成手动 workflow。

8. `.github/utils/change-filters.yaml`

   看 AWS staging 相关文件为什么被归类为 Delivery Control，而不是 product runtime 或 production manifest。

## 关键概念速查

| 概念 | 新手解释 | 在本项目里的体现 |
|---|---|---|
| Staging | 非生产环境，用来验证、演示和学习。 | AWS Staging/Portfolio，不替代 DO Production。 |
| Scaffold | 可审查的脚手架，还不是已运行环境。 | Terraform 和 workflow 已写好，但没有自动创建 AWS 资源。 |
| Infrastructure as Code | 用代码描述基础设施。 | `deploy/aws-staging/*.tf`。 |
| Terraform root | 一个 Terraform 工作目录，代表一组基础设施边界。 | `deploy/aws-staging/`。 |
| Remote state | Terraform 用来记录真实资源状态的远程存储。 | Terraform Cloud workspace `halligalli-aws-staging`。 |
| S3 | 对象存储，适合放静态构建产物。 | 存放 Vite build 生成的 `dist/` 文件。 |
| CloudFront | CDN，负责 HTTPS、缓存和边缘分发。 | 对外提供 `play.halligalli.games`。 |
| ACM | AWS Certificate Manager，用来签发 TLS 证书。 | CloudFront 证书在 `us-east-1`，后端 ALB 证书在 `eu-west-1`。 |
| Route 53 | AWS DNS 服务。 | 管理 `play.halligalli.games` 和 `api.halligalli.games`。 |
| ECR | AWS 容器镜像仓库。 | 存放 staging 后端 image。 |
| ECS Fargate | 不直接管理 EC2 的容器运行方式。 | 运行单个 Halligalli backend task。 |
| ALB | Application Load Balancer。 | 接收 HTTPS/WSS 流量并转发到后端 task。 |
| Security group | AWS 网络防火墙规则。 | 限制 ALB 和 backend task 之间的访问。 |
| Readiness check | 判断服务是否能接流量。 | `/readyz`。 |
| Health check | 判断当前运行的是哪个 release identity。 | `/health` 返回 `APP_VERSION` 和 `COMMIT_SHA`。 |
| Smoke test | 部署后做最小可用性验证。 | workflow 调用 `/readyz` 和 `/health`。 |
| Manual gate | 防止误操作的人工确认。 | deploy 操作必须输入 `STAGING_APPLY`。 |

## Terraform 在这里做什么

Terraform 的职责是声明 AWS staging 需要哪些资源，以及这些资源如何连接。

本阶段 Terraform 覆盖：

- S3 bucket。
- CloudFront distribution。
- ACM certificate。
- Route 53 DNS records。
- ECR repository。
- VPC。
- public subnets。
- internet gateway。
- route table。
- security groups。
- ALB。
- target group。
- ECS cluster。
- ECS task definition。
- ECS service。
- CloudWatch log group。

你可以先运行这些本地验证命令：

```bash
terraform -chdir=deploy/aws-staging fmt -check -recursive
terraform -chdir=deploy/aws-staging init -backend=false -input=false
terraform -chdir=deploy/aws-staging validate -no-color
```

这些命令的含义：

| 命令 | 做什么 | 会不会创建 AWS 资源 |
|---|---|---|
| `terraform fmt -check` | 检查 Terraform 文件格式。 | 不会。 |
| `terraform init -backend=false` | 初始化 Terraform，但不连接远程 state。 | 不会。 |
| `terraform validate` | 静态验证 Terraform 配置。 | 不会。 |

不要把 `terraform apply` 当成验证命令。`apply` 是真实创建或修改云资源的动作，会产生费用和状态变化。

## GitHub Actions 在这里做什么

`.github/workflows/aws-staging.yml` 是手动 workflow。它不会因为普通 push 或 PR 自动部署 AWS。

它支持四个 operation：

| Operation | 作用 | 是否会改 AWS |
|---|---|---|
| `validate` | 验证 release config 和 Terraform 配置。 | 不会。 |
| `deploy-frontend` | 构建前端，上传到 S3，刷新 CloudFront。 | 会。 |
| `deploy-backend` | 构建后端 image，推到 ECR，更新 ECS service。 | 会。 |
| `smoke-backend` | 请求 `/readyz` 和 `/health`。 | 不会改资源，但会访问已存在的 backend。 |

会修改 AWS 的操作必须满足两个条件：

1. 人手动通过 `workflow_dispatch` 触发。
2. `confirm_cost` 输入必须等于 `STAGING_APPLY`。

这个设计是在教你一个基础 DevOps 原则：

```text
自动化不等于无保护。
越接近真实云资源和费用，越需要明确的人工 gate。
```

## 前端部署流程

前端部署的路径是：

```text
pnpm install
  -> pnpm run build
  -> dist/
  -> aws s3 sync
  -> CloudFront invalidation
```

构建时设置：

```text
VITE_HALLIGALLI_BACKEND_URL=https://api.halligalli.games
```

这告诉前端：进入 AWS staging 后，后端地址不是本地，也不是 DO Production，而是 `api.halligalli.games`。

部署完成后，用户通过这个地址访问：

```text
https://play.halligalli.games
```

## 后端部署流程

后端部署的路径是：

```text
docker build
  -> inject APP_VERSION and COMMIT_SHA
  -> docker push to ECR
  -> register new ECS task definition revision
  -> update ECS service
  -> wait for service stability
  -> curl /readyz
  -> curl /health
```

后端容器运行时使用：

```text
HALLIGALLI_ALLOWED_ORIGINS=https://play.halligalli.games
```

这表示 staging 后端只允许 staging 前端作为浏览器来源。对 socket.io/WebSocket 应用来说，origin 边界很重要。

## `/readyz` 和 `/health` 的区别

这两个 endpoint 很容易混淆，但它们在 DevOps 里表达不同问题。

| Endpoint | 回答的问题 | 使用者 |
|---|---|---|
| `/readyz` | 这个服务现在能不能接流量？ | ALB target group health check、部署 smoke test。 |
| `/health` | 当前运行的是哪个版本和 commit？ | release identity、smoke test、drift check。 |

换句话说：

```text
/readyz = traffic readiness
/health = release identity
```

一个服务可能 `/health` 能返回版本信息，但业务依赖还没准备好，所以不能接流量。把这两个概念分开，是更成熟的运维设计。

## GitHub Environment 配置

未来真实手动部署会使用 GitHub environment：`aws-staging`。

需要配置这些 secrets：

| Secret | 用途 |
|---|---|
| `AWS_STAGING_ACCESS_KEY_ID` | GitHub Actions 访问 AWS 的 access key id。 |
| `AWS_STAGING_SECRET_ACCESS_KEY` | GitHub Actions 访问 AWS 的 secret access key。 |

需要配置这些 variables：

| Variable | 用途 |
|---|---|
| `AWS_STAGING_FRONTEND_BUCKET` | Terraform 创建的前端 S3 bucket。 |
| `AWS_STAGING_CLOUDFRONT_DISTRIBUTION_ID` | 前端部署后需要 invalidation 的 CloudFront distribution。 |
| `AWS_STAGING_ECR_REGISTRY` | ECR registry host，例如 `<account>.dkr.ecr.eu-west-1.amazonaws.com`。 |
| `AWS_STAGING_ECR_REPOSITORY` | staging 后端 ECR repository 名称。 |
| `AWS_STAGING_ECS_CLUSTER` | ECS cluster 名称。 |
| `AWS_STAGING_ECS_SERVICE` | ECS service 名称。 |
| `AWS_STAGING_TASK_FAMILY` | ECS task definition family。 |
| `AWS_STAGING_CONTAINER_NAME` | ECS task definition 里的容器名，当前是 `backend`。 |

这些值为什么不放进 Git？

因为 Git 适合保存可审查的声明，不适合保存真实密钥、账号标识、环境私有值和本地状态。

## 成本边界

第二阶段是学习和作品集环境，不是长期运行的生产环境。所以它内置了几个成本 guardrail：

- 默认不使用 NAT Gateway。
- 后端 desired count 只允许 `0` 或 `1`。
- CloudWatch Logs retention 是 14 天。
- ALB deletion protection 默认关闭。
- CloudFront 使用 `PriceClass_100`。
- ECR lifecycle policy 只保留最近的 demo images。

真实费用风险主要来自：

- ALB 小时费用。
- public IPv4 相关费用。
- Fargate task 运行时间。
- CloudFront/S3 请求和流量。
- CloudWatch Logs 写入和保存。

建议的生命周期：

1. 准备 demo 前再 apply 或 scale up。
2. 展示 `play.halligalli.games`、`api.halligalli.games`、`/readyz`、`/health` 和 multiplayer socket path。
3. demo 后 destroy，或者把 `backend_desired_count` 设为 `0`。

## 和现有生产路径的关系

第二阶段不会改变 DO Production。

现有生产路径仍然是：

```text
Release PR
  -> Release Tag
  -> GHCR Release Image
  -> Production Promotion PR
  -> deploy/production/app.yaml
  -> GitOps Reconciler
  -> DO Production
```

AWS staging 是另一条学习和展示路径：

```text
Manual workflow_dispatch
  -> AWS Staging validation
  -> optional frontend deploy
  -> optional backend deploy
  -> smoke checks
  -> AWS Staging/Portfolio
```

这两条路径故意分开。这样做的好处是：

- 学 AWS 不会破坏当前生产发布。
- staging 可以按需创建和销毁。
- production promotion 仍然需要人审查 manifest change。
- portfolio 可以展示 AWS 能力，但不把项目复杂度强行推到生产环境。

## 本地验证清单

这些命令不需要 AWS credentials，也不需要 Terraform Cloud credentials：

```bash
terraform -chdir=deploy/aws-staging fmt -check -recursive
terraform -chdir=deploy/aws-staging init -backend=false -input=false
terraform -chdir=deploy/aws-staging validate -no-color
docker run --rm -v "${PWD}:/repo" --workdir /repo rhysd/actionlint:1.7.12 -color
pnpm run test
pnpm run typecheck
pnpm run build
```

作为新手，你可以这样理解这组命令：

| 检查 | 目的 |
|---|---|
| Terraform fmt | 基础设施代码格式一致。 |
| Terraform init/validate | Terraform 配置语法和 provider schema 基本正确。 |
| actionlint | GitHub Actions YAML 基本正确。 |
| product tests | 产品逻辑没有被破坏。 |
| typecheck | TypeScript 类型没有被破坏。 |
| build | 前后端构建仍然成功。 |

## 学习练习

阅读第二阶段时，可以按这些问题检查自己是否理解：

1. 为什么 `deploy/aws-staging/` 属于 Child Repo，而不是 Workbench？
2. 为什么 Terraform state 不能提交到 Git？
3. 为什么 `terraform validate` 可以安全运行，而 `terraform apply` 不能随便运行？
4. 为什么前端适合 S3 + CloudFront，而后端需要 ECS Fargate？
5. 为什么 backend 要经过 ALB，而不是直接暴露 task？
6. 为什么 `/readyz` 和 `/health` 要分开？
7. 为什么 AWS staging deploy 需要 `STAGING_APPLY`？
8. 为什么 AWS staging 使用 ECR，而 DO Production 继续使用 GHCR Release Image？
9. 如果 demo 结束后忘记销毁或 scale down，哪些资源最可能继续产生费用？
10. 如果将来要上 production AWS，哪些地方需要重新决策，而不能直接把 staging 当 production？

## 第二阶段一句话总结

第二阶段把 Halligalli 从“已有 DO Production 发布系统”扩展为“具备 AWS staging 学习和作品集展示能力的项目”，但它保持了清晰边界：AWS staging 是手动、成本敏感、可销毁的非生产环境；DO Production 仍然由现有 Release PR、Production Promotion 和 GitOps Reconciler 控制。
