
@echo off
title APE 04 - Inicio de servicios
cd /d C:\soaApe

echo =========================================
echo    APE 04 - VENTA DE VEHICULOS
echo =========================================
echo.
echo Iniciando los tres servicios principales...
echo.

if not exist "C:\soaApe\API\venta-vehiculos-api-0.0.1-SNAPSHOT.jar" (
    echo ERROR: No se encontro el JAR de vehiculos.
    pause
    exit /b 1
)

if not exist "C:\soaApe\python_ventas-api\.venv\Scripts\python.exe" (
    echo ERROR: No se encontro el entorno virtual de Python.
    pause
    exit /b 1
)

echo [1] Iniciando Java Vehiculos - Puerto 8083
start "JAVA VEHICULOS 8083" cmd /k "cd /d C:\soaApe\API && java -jar venta-vehiculos-api-0.0.1-SNAPSHOT.jar --server.port=8083"

echo [2] Iniciando Java Notificaciones - Puerto 8081
start "JAVA NOTIFICACIONES 8081" cmd /k "cd /d C:\soaApe\java_notificaciones-service && mvn spring-boot:run -Dspring-boot.run.arguments=--server.port=8081"

echo [3] Iniciando Python FastAPI - Puerto 8002
start "PYTHON VENTAS 8002" cmd /k "cd /d C:\soaApe\python_ventas-api && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8002 --reload"

echo.
echo Servicios enviados a sus respectivas consolas.
echo Compruebe que todos hayan iniciado correctamente.
echo.
pause
