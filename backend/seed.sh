#!/bin/bash
set -e

echo "Copying sample seed SQL into database container..."
sudo docker cp docker/init/003_sample_data.sql backend-database-1:/tmp/sample.sql

echo "Executing SQL seed in Oracle Database..."
sudo docker exec backend-database-1 sqlplus -S 'pkl_app/LocalApp_2026!@localhost:1521/FREEPDB1' @/tmp/sample.sql

echo "Done! Sample data has been successfully seeded."
