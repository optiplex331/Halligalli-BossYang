locals {
  backend_scaffold = {
    purpose                    = "Run the Node.js 24 socket.io backend for AWS Staging/Portfolio"
    hostname                   = local.dns.backend_hostname
    image_registry             = "Amazon ECR"
    runtime_platform           = "ECS Fargate"
    backend_entry              = "https://${local.dns.backend_hostname}"
    health_path                = "/health"
    readiness_path             = "/readyz"
    websocket_path             = "/socket.io"
    allowed_origins            = "https://${local.dns.frontend_hostname}"
    container_name             = "backend"
    container_port             = 3001
    default_desired_count      = 1
    deployment_maximum_percent = 200
    manual_scale_note          = "Keep the multiplayer backend at one task for demos; use desired_count 0 only for teardown"
    release_identity_note      = "APP_VERSION and COMMIT_SHA are placeholders until the manual AWS Staging deployment workflow injects release identity"
  }
}

resource "aws_ecr_repository" "backend" {
  name                 = "${local.name_prefix}-backend"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep the most recent demo images for AWS Staging"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["staging-"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Expire untagged images quickly"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 3
        }
        action = {
          type = "expire"
        }
      },
    ]
  })
}

resource "aws_vpc" "backend" {
  cidr_block           = local.networking_scaffold.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${local.name_prefix}-backend-vpc"
  }
}

data "aws_availability_zones" "backend_available" {
  state = "available"
}

resource "aws_subnet" "backend_public" {
  count = local.networking_scaffold.public_subnet_count

  vpc_id                  = aws_vpc.backend.id
  availability_zone       = data.aws_availability_zones.backend_available.names[count.index]
  cidr_block              = cidrsubnet(aws_vpc.backend.cidr_block, 8, count.index)
  map_public_ip_on_launch = true

  tags = {
    Name = "${local.name_prefix}-backend-public-${count.index + 1}"
    Tier = "public"
  }
}

resource "aws_internet_gateway" "backend" {
  vpc_id = aws_vpc.backend.id

  tags = {
    Name = "${local.name_prefix}-backend-igw"
  }
}

resource "aws_route_table" "backend_public" {
  vpc_id = aws_vpc.backend.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.backend.id
  }

  tags = {
    Name = "${local.name_prefix}-backend-public"
  }
}

resource "aws_route_table_association" "backend_public" {
  count = length(aws_subnet.backend_public)

  subnet_id      = aws_subnet.backend_public[count.index].id
  route_table_id = aws_route_table.backend_public.id
}

resource "aws_security_group" "backend_alb" {
  name        = "${local.name_prefix}-backend-alb"
  description = "Public HTTPS entry for the AWS Staging backend"
  vpc_id      = aws_vpc.backend.id

  tags = {
    Name = "${local.name_prefix}-backend-alb"
  }
}

resource "aws_security_group" "backend_task" {
  name        = "${local.name_prefix}-backend-task"
  description = "Fargate task ingress from the backend ALB"
  vpc_id      = aws_vpc.backend.id

  tags = {
    Name = "${local.name_prefix}-backend-task"
  }
}

resource "aws_vpc_security_group_ingress_rule" "backend_alb_http" {
  security_group_id = aws_security_group.backend_alb.id
  description       = "Allow HTTP redirect traffic from the public internet"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_ingress_rule" "backend_alb_https" {
  security_group_id = aws_security_group.backend_alb.id
  description       = "Allow HTTPS traffic from the public internet"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "backend_alb_to_task" {
  security_group_id            = aws_security_group.backend_alb.id
  description                  = "Forward HTTP traffic to backend tasks"
  ip_protocol                  = "tcp"
  from_port                    = local.backend_scaffold.container_port
  to_port                      = local.backend_scaffold.container_port
  referenced_security_group_id = aws_security_group.backend_task.id
}

resource "aws_vpc_security_group_ingress_rule" "backend_task_from_alb" {
  security_group_id            = aws_security_group.backend_task.id
  description                  = "Accept backend traffic from the ALB"
  ip_protocol                  = "tcp"
  from_port                    = local.backend_scaffold.container_port
  to_port                      = local.backend_scaffold.container_port
  referenced_security_group_id = aws_security_group.backend_alb.id
}

resource "aws_vpc_security_group_egress_rule" "backend_task_https" {
  security_group_id = aws_security_group.backend_task.id
  description       = "Allow HTTPS egress for ECR and CloudWatch Logs over public networking"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_lb" "backend" {
  name                       = "${local.name_prefix}-backend"
  load_balancer_type         = "application"
  internal                   = false
  security_groups            = [aws_security_group.backend_alb.id]
  subnets                    = aws_subnet.backend_public[*].id
  idle_timeout               = 300
  enable_deletion_protection = false

  tags = {
    Name = "${local.name_prefix}-backend"
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "${local.name_prefix}-backend"
  port        = local.backend_scaffold.container_port
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.backend.id

  health_check {
    enabled             = true
    path                = local.backend_scaffold.readiness_path
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }

  tags = {
    Name = "${local.name_prefix}-backend"
  }
}

resource "aws_lb_listener" "backend_http_redirect" {
  load_balancer_arn = aws_lb.backend.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "backend_https" {
  load_balancer_arn = aws_lb.backend.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.backend_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}

resource "aws_ecs_cluster" "backend" {
  name = "${local.name_prefix}-backend"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

resource "aws_iam_role" "backend_task_execution" {
  name = "${local.name_prefix}-backend-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "backend_task_execution" {
  role       = aws_iam_role.backend_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "backend_task" {
  name = "${local.name_prefix}-backend-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      },
    ]
  })
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${local.name_prefix}-backend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.backend_task_cpu
  memory                   = var.backend_task_memory
  execution_role_arn       = aws_iam_role.backend_task_execution.arn
  task_role_arn            = aws_iam_role.backend_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = local.backend_scaffold.container_name
      image     = "${aws_ecr_repository.backend.repository_url}:${var.backend_image_tag}"
      essential = true

      portMappings = [
        {
          containerPort = local.backend_scaffold.container_port
          hostPort      = local.backend_scaffold.container_port
          protocol      = "tcp"
          appProtocol   = "http"
        },
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "production"
        },
        {
          name  = "PORT"
          value = tostring(local.backend_scaffold.container_port)
        },
        {
          name  = "HALLIGALLI_ALLOWED_ORIGINS"
          value = local.backend_scaffold.allowed_origins
        },
        {
          name  = "APP_VERSION"
          value = var.backend_app_version
        },
        {
          name  = "COMMIT_SHA"
          value = var.backend_commit_sha
        },
      ]

      healthCheck = {
        command     = ["CMD-SHELL", "wget -qO- http://127.0.0.1:${local.backend_scaffold.container_port}${local.backend_scaffold.readiness_path} >/dev/null || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.backend.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = local.backend_scaffold.container_name
        }
      }
    },
  ])
}

resource "aws_ecs_service" "backend" {
  name                               = "${local.name_prefix}-backend"
  cluster                            = aws_ecs_cluster.backend.id
  task_definition                    = aws_ecs_task_definition.backend.arn
  desired_count                      = var.backend_desired_count
  launch_type                        = "FARGATE"
  health_check_grace_period_seconds  = 60
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = local.backend_scaffold.deployment_maximum_percent
  wait_for_steady_state              = false

  network_configuration {
    subnets          = aws_subnet.backend_public[*].id
    security_groups  = [aws_security_group.backend_task.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = local.backend_scaffold.container_name
    container_port   = local.backend_scaffold.container_port
  }

  depends_on = [
    aws_iam_role_policy_attachment.backend_task_execution,
    aws_lb_listener.backend_https,
  ]
}

check "backend_single_task_default" {
  assert {
    condition     = var.backend_desired_count <= 1
    error_message = "AWS Staging backend must not imply multiplayer horizontal scaling."
  }
}

check "backend_readiness_surface" {
  assert {
    condition     = local.backend_scaffold.readiness_path == "/readyz"
    error_message = "AWS Staging backend readiness checks must use /readyz."
  }
}
