@echo off
REM =============================================================================
REM [FUSION P1/P4] Lance la collection Postman "Dashboards (P4)" avec Newman (CMD Windows)
REM
REM Prérequis : serveur P4 lancé dans un autre terminal :
REM     cd backend
REM     npm run dev:dashboards
REM
REM Utilisation (depuis n'importe quel dossier) :
REM     postman\run-p4.cmd
REM =============================================================================
setlocal
set "ROOT=%~dp0.."

pushd "%ROOT%\backend"
for /f "delims=" %%i in ('node --env-file-if-exists=.env database\demo-token.js alice@example.com') do set "TOKEN=%%i"
for /f "delims=" %%i in ('node --env-file-if-exists=.env database\demo-token.js admin@example.com') do set "ADMIN_TOKEN=%%i"
popd

if not defined TOKEN (
  echo Impossible de generer le jeton d'Alice. Verifier backend\.env et lancer : npm run db:seed
  exit /b 1
)
if not defined ADMIN_TOKEN (
  echo Impossible de generer le jeton admin. Verifier backend\.env et lancer : npm run db:seed
  exit /b 1
)

call npx --yes newman run "%ROOT%\postman\dashboards.postman_collection.json" ^
  -e "%ROOT%\postman\local-p4.postman_environment.json" ^
  --env-var "token=%TOKEN%" --env-var "adminToken=%ADMIN_TOKEN%"

endlocal
