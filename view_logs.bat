@echo off
SET GCLOUD="C:\Users\28523971\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"
SET PROJECT_ID=aicodex-lab
SET REGION=us-central1

echo Streaming logs for 'backend' service...
%GCLOUD% run logs tail backend --project %PROJECT_ID% --region %REGION%
pause
