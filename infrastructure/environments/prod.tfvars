# prod: tres zonas, NAT por zona, Multi-AZ, backups de 35 días copiados a la región de recuperación
# y Object Lock en COMPLIANCE.
# Los valores 000000000000 y el dominio son marcadores: se reemplazan por los de la cuenta de prod.
#
# Dos valores quedan sin declarar a propósito, y terraform plan los pide hasta que se decidan:
#   - audit_retention_days: plazo legal de audit_log, lo fija el área de cumplimiento
#     (docs/aws-deploy.md, sección 5). En COMPLIANCE no se puede acortar después.
#   - clabe_bank_code: la clave de institución asignada; 999 no corresponde a ninguna.

environment         = "prod"
allowed_account_ids = ["000000000000"]
region              = "us-east-1"
dr_region           = "us-west-2"

domain_name = "treowallet.example"

vpc_cidr                   = "10.30.0.0/16"
az_count                   = 3
single_nat_gateway         = false
enable_interface_endpoints = true

db_instance_class           = "db.m7g.large"
db_multi_az                 = true
db_backup_retention_days    = 35
db_deletion_protection      = true
enable_cross_region_backups = true

cache_node_type = "cache.m7g.large"
cache_num_nodes = 2

api_image_tag = "bootstrap"
web_image_tag = "bootstrap"

api_cpu       = 1024
api_memory    = 2048
api_min_count = 2
api_max_count = 10
web_min_count = 2
web_max_count = 6

clabe_plaza_code = "180"

dmarc_report_address = "dmarc@treowallet.example"

audit_object_lock_mode = "COMPLIANCE"

alarm_emails = ["alertas@treowallet.example"]
