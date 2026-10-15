# dev: una sola zona de NAT, sin endpoints de interfaz, Fargate Spot y recursos chicos. Se puede
# destruir y recrear: sin protección contra borrado y secretos que se borran de inmediato.
# Los valores 000000000000 y el dominio son marcadores: se reemplazan por los de la cuenta de dev.

environment         = "dev"
allowed_account_ids = ["000000000000"]
region              = "us-east-1"
dr_region           = "us-west-2"

domain_name = "dev.treowallet.example"

vpc_cidr                   = "10.10.0.0/16"
az_count                   = 2
single_nat_gateway         = true
enable_interface_endpoints = false

db_instance_class           = "db.t4g.medium"
db_multi_az                 = false
db_backup_retention_days    = 7
db_deletion_protection      = false
enable_cross_region_backups = false

cache_node_type = "cache.t4g.micro"
cache_num_nodes = 1

api_image_tag    = "bootstrap"
web_image_tag    = "bootstrap"
use_fargate_spot = true

api_cpu       = 256
api_memory    = 512
api_min_count = 1
api_max_count = 2
web_cpu       = 256
web_memory    = 512
web_min_count = 1
web_max_count = 2

clabe_bank_code  = "999"
clabe_plaza_code = "180"

dmarc_report_address = "dmarc@dev.treowallet.example"

audit_object_lock_mode = "GOVERNANCE"
audit_retention_days   = 1

log_retention_days          = 30
secret_recovery_window_days = 0
