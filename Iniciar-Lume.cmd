@echo off
setlocal
cd /d "%~dp0"
set "LUME_NODE=C:\Program Files\nodejs\node.exe"
if not exist "%LUME_NODE%" set "LUME_NODE=node"
echo Iniciando a copia de trabalho do Lume em http://localhost:5173
echo Mantenha esta janela aberta. Feche outro servidor Lume antes de iniciar.
"%LUME_NODE%" "scripts\dev.mjs"
if errorlevel 1 pause
endlocal
