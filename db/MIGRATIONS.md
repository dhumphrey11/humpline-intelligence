# Database Migrations (Cloud SQL Postgres)

### Preferred: `gcloud sql import sql`
1) Upload the migration file to a readable GCS location (e.g. `gs://humpline-intelligence_cloudbuild/tmp/<file>.sql`).
2) Ensure the Cloud SQL service has read access to that object/bucket (grant `storage.objectViewer` to the Cloud SQL SA or make the object temporarily world-readable).
3) Run:
   ```bash
   gcloud sql import sql humpline-db gs://humpline-intelligence_cloudbuild/tmp/<file>.sql \
     --project=humpline-intelligence \
     --database=humpline
   ```
4) Verify:
   ```bash
   gcloud sql connect humpline-db --project humpline-intelligence --user=humpline --quiet \
     --command="SELECT to_regclass('public.<your_table>');"
   ```

### Alternative: `gcloud sql connect` + psql (proxy)
1) Install `psql` locally and ensure it’s in `PATH`.
2) From repo root:
   ```bash
   gcloud sql connect humpline-db --project humpline-intelligence --user=humpline --quiet \
     < db/migrations/<file>.sql
   ```

### Notes
- DB: `humpline-db` (Postgres), project `humpline-intelligence`.
- Direct TCP to `136.111.147.250` may be firewalled; the proxy (`gcloud sql connect`) or import is more reliable.
- Keep migration files in `db/migrations/` and apply in order.
- Bucket IAM (already set): `gs://humpline-intelligence_cloudbuild` grants `storage.objectViewer` to `876191155026-compute@developer.gserviceaccount.com`, so imports via `gcloud sql import sql` should succeed without making objects public. If needed, add the Cloud SQL service identity (`service-<PROJECT_NUMBER>@gcp-sa-cloud-sql.iam.gserviceaccount.com`) with the same role.
