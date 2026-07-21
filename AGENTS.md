# Database safety — absolute rule

- Never run destructive database commands against any Memurlar Akademi database, including local, test, staging, or production.
- Forbidden commands and operations include `migrate:fresh`, `migrate:refresh`, `migrate:reset`, `db:wipe`, `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, unscoped/bulk `DELETE`, and reset commands that recreate catalog, topic, question, or user data.
- Never replay binary logs or import a dump directly into the configured application database. Recovery must first target a brand-new, isolated database or temporary database server.
- Before any database mutation, verify and report the application environment plus the exact database host, port, and database name using read-only checks.
- Before running migrations, inspect them for destructive schema/data changes and require a verified, restorable full backup. If either condition is missing, stop.
- Do not infer permission to delete or reset data. If a task appears to require it, stop and ask for a non-destructive alternative.
