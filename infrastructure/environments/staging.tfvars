# staging: la misma forma que prod (Multi-AZ, dos tareas por servicio, endpoints de interfaz) con
# instancias más chicas. Object Lock en GOVERNANCE para poder limpiar el bucket.
# Los valores 000000000000 y el dominio son marcadores: se reemplazan por los de la cuenta de staging.

environment         = "staging"
allowed_account_ids = ["000000000000"]
region              = "us-east-1"
dr_region           = "us-west-2"

domain_name = "staging.treowallet.example"

vpc_cidr                   = "10.20.0.0/16"
az_count                   = 2
single_nat_gateway         = false
enable_interface_endpoints = true

db_instance_class           = "db.m7g.large"
db_multi_az                 = true
db_backup_retention_days    = 14
db_deletion_protection      = true
enable_cross_region_backups = false

cache_node_type = "cache.t4g.small"
cache_num_nodes = 2

api_image_tag = "bootstrap"
web_image_tag = "bootstrap"

api_min_count = 2
api_max_count = 4
web_min_count = 2
web_max_count = 4

clabe_bank_code  = "999"
clabe_plaza_code = "180"

dmarc_report_address = "dmarc@staging.treowallet.example"

audit_object_lock_mode = "GOVERNANCE"
audit_retention_days   = 30

alarm_emails = ["alertas-staging@treowallet.example"]
