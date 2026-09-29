# CampusCare — Today's setup checkpoint

## Test role mapping

| Account | Role | Approval | Password used for test accounts |
|---|---|---|---|
| Existing system-admin account | System Administrator | Active | Existing password |
| testadmin1@gmail.com | Admin | System Administrator approves | Admin@123 |
| testadmin2@gmail.com | Admin | System Administrator approves | Admin@123 |
| tech1@gmail.com | Technician | Admin approves | Admin@123 |
| tech2@gmail.com | Technician | Admin approves | Admin@123 |
| student1@gmail.com | Complainant | Immediate | Admin@123 |
| staff1@gmail.com | Complainant | Immediate | Admin@123 |

These are development/test credentials explicitly chosen during today's setup. Change them before any real deployment.

## Workflow

System Administrator → approves Admins

Admin → approves Technicians → verifies complaints → assigns Technician

Technician → starts work → marks resolved

Admin → closes resolved complaint

Complainant → submits complaint + optional photo → tracks progress → gives feedback → can reopen a closed complaint

## Complaint status

`open → verified → assigned → in_progress → resolved → closed`

Additional status: `reopened`, `rejected`.
