locals {
  networking_scaffold = {
    vpc_cidr                = "10.42.0.0/16"
    public_subnet_count     = 2
    private_subnet_count    = 0
    nat_gateway_count       = 0
    nat_gateway_enabled     = var.enable_nat_gateway
    default_egress_strategy = "No NAT Gateway; future backend slices must justify private subnet egress explicitly"
  }
}

check "nat_gateway_disabled_by_default" {
  assert {
    condition     = local.networking_scaffold.nat_gateway_count == 0 && var.enable_nat_gateway == false
    error_message = "AWS Production Scaffold must keep NAT Gateway disabled by default."
  }
}
