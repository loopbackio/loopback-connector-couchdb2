#!/bin/bash		
 		
 # Shell script to start the database and app services before running the tests.		
 		
 ## color codes		
 RED='\033[1;31m'		
 GREEN='\033[1;32m'		
 YELLOW='\033[1;33m'		
 CYAN='\033[1;36m'		
 PLAIN='\033[0m'		
 		
 ## variables		
 COUCH_CONTAINER="couch_c"
 COUCH_IMAGE="klaemo/couchdb"
 COUCH_IMAGE_TAG="latest"

 HOST=localhost		
 USER='admin'		
 PASSWORD='pass'		
 PORT=5984		
 DATABASE='testdb'		
 if [ "$1" ]; then		
     HOST=$1		
 fi		
 if [ "$2" ]; then		
     PORT=$2		
 fi		
 if [ "$2" ]; then		
     USER=$3		
 fi		
 if [ "$4" ]; then		
     PASSWORD=$4		
 fi		
 if [ "$5" ]; then		
     DATABASE=$5		
 fi		
 		
 ## check if docker exists		
 printf "\n${RED}>> Checking for docker${PLAIN} ${GREEN}...${PLAIN}"		
 docker -v > /dev/null 2>&1
 DOCKER_EXISTS=$?
 if [ "$DOCKER_EXISTS" -ne 0 ]; then		
     printf "\n\n${CYAN}Status: ${PLAIN}${RED}Docker not found. Terminating setup.${PLAIN}\n\n"		
     exit 1		
 fi	
 printf "\n${CYAN}Found docker. Moving on with the setup.${PLAIN}\n"

## cleaning up previous builds
printf "\n${RED}>> Finding old builds and cleaning up${PLAIN} ${GREEN}...${PLAIN}"
docker rm -f $COUCH_CONTAINER > /dev/null 2>&1
printf "\n${CYAN}Clean up complete.${PLAIN}\n"

## pull latest couch image
printf "\n${RED}>> Pulling latest couch image${PLAIN} ${GREEN}...${PLAIN}"
docker pull $COUCH_IMAGE:$COUCH_IMAGE_TAG > /dev/null 2>&1
printf "\n${CYAN}Image successfully built.${PLAIN}\n"

## run the couch container
printf "\n${RED}>> Starting the couch container${PLAIN} ${GREEN}...${PLAIN}"
CONTAINER_STATUS=$(docker run -d -e COUCHDB_USER=$USER -e COUCHDB_PASSWORD=$PASSWORD -p $PORT:5984 --name $COUCH_CONTAINER $COUCH_IMAGE:$COUCH_IMAGE_TAG 2>&1)
if [[ "$CONTAINER_STATUS" == *"Error"* ]]; then
    printf "\n\n${CYAN}Status: ${PLAIN}${RED}Error starting container. Terminating setup.${PLAIN}\n\n"
    exit 1
fi
printf "\n${CYAN}Container is up and running.${PLAIN}\n"
 		
 ## wait for couch service	
 OUTPUT=$?		
 TIMEOUT=120		
 TIME_PASSED=0		
 WAIT_STRING="."		
 		
 printf "\n${GREEN}Waiting for couch service to be up $WAIT_STRING${PLAIN}"		
 while [ "$OUTPUT" -ne 200 ] && [ "$TIMEOUT" -gt 0 ]		
     do		
         OUTPUT=$(curl -s -o /dev/null -w "%{http_code}" --request GET --url http://$USER:$PASSWORD@$HOST:$PORT/_all_dbs)		
         sleep 1s		
         TIMEOUT=$((TIMEOUT - 1))		
         TIME_PASSED=$((TIME_PASSED + 1))		
 		
         if [ "$TIME_PASSED" -eq 5 ]; then		
             printf "${GREEN}.${PLAIN}"		
            TIME_PASSED=0		
         fi		
    done		
		
if [ "$TIMEOUT" -le 0 ]; then		
    printf "\n\n${CYAN}Status: ${PLAIN}${RED}Failed to start Couch service. Terminating setup.${PLAIN}\n\n"		
    exit 1		
fi		
printf "\n${CYAN}Couch started.${PLAIN}\n"		

## create database		
printf "\n${RED}>> Creating database in Couch${PLAIN}"		
curl --request PUT --url http://$USER:$PASSWORD@$HOST:$PORT/$DATABASE > /dev/null 2>&1		
DB_OUTPUT=$?		
if [ "$DB_OUTPUT" -ne 0 ]; then		
    printf "\n\n${CYAN}Status: ${PLAIN}${RED}Database could not be created. Terminating setup.${PLAIN}\n\n"		
    exit 1		
fi		
printf "\n${CYAN}Database created succesfully.${PLAIN}\n"		

 ## set env variables for running test		
 printf "\n${RED}>> Setting env variables to run test${PLAIN} ${GREEN}...${PLAIN}"		
 export COUCHDB_URL=http://$USER:$PASSWORD@$HOST:$PORT		
 export COUCHDB_USERNAME=$USER		
 export COUCHDB_PASSWORD=$PASSWORD		
 export COUCHDB_PORT=$PORT		
 export COUCHDB_DATABASE=$DATABASE		
 export CI=true		
 printf "\n${CYAN}Env variables set.${PLAIN}\n"		
 		
 printf "\n${CYAN}Status: ${PLAIN}${GREEN}Set up completed successfully.${PLAIN}\n"		
 printf "\n${CYAN}Instance url: ${YELLOW}http://$USER:$PASSWORD@$HOST:$PORT/$DATABASE${PLAIN}\n"		
 printf "\n${CYAN}To run the test suite:${PLAIN} ${YELLOW}npm run mocha${PLAIN}\n\n"
