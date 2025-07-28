#!/bin/bash

CONTAINER_NAME="mysql-test"
VOLUME_NAME="mysql-data"
MYSQL_IMAGE="mysql:8"
ROOT_PASSWORD="SuperSecret"

echo "Pulling MySQL Docker image..."
docker pull $MYSQL_IMAGE

echo "Creating Docker volume (if not exists)..."
docker volume create $VOLUME_NAME

# Check if container exists
if [ "$(docker ps -aq -f name=^/${CONTAINER_NAME}$)" ]; then
  echo "Container $CONTAINER_NAME already exists."
  # Check if it's running
  if [ "$(docker ps -q -f name=^/${CONTAINER_NAME}$)" ]; then
    echo "Container $CONTAINER_NAME is already running."
  else
    echo "Starting existing container $CONTAINER_NAME..."
    docker start $CONTAINER_NAME
  fi
else
  echo "Running MySQL container '$CONTAINER_NAME' with volume '$VOLUME_NAME'..."
  docker run -d \
    --name $CONTAINER_NAME \
    -v $VOLUME_NAME:/var/lib/mysql \
    -e MYSQL_ROOT_PASSWORD=$ROOT_PASSWORD \
    -p 3306:3306 \
    $MYSQL_IMAGE
fi

echo ""
echo "Container status:"
docker ps -f name=^/${CONTAINER_NAME}$

# Pause for 10 seconds to let you see the status
sleep 10

echo ""
echo "MySQL container is running with root password set to '$ROOT_PASSWORD'."
echo "You can connect and create your database and tables with:"
echo "  docker exec -it $CONTAINER_NAME mysql -u root -p"
echo "  # enter password: $ROOT_PASSWORD"
echo ""
echo "Then run SQL commands like:"
echo "  CREATE DATABASE patients_db;"
echo "  USE patients_db;"
echo "  CREATE TABLE patients ("
echo "    id INT AUTO_INCREMENT PRIMARY KEY,"
echo "    name VARCHAR(255) NOT NULL,"
echo "    patient_number VARCHAR(100) NOT NULL"
echo "  );"
echo ""
echo "Remember to update your app config with the root password."
