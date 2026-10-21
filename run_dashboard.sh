#!/bin/bash
# Launcher for MERIDIAN Enterprise Analytics Dashboard
cd "$(dirname "$0")"

PORT=8080
echo "=========================================================="
echo " Starting MERIDIAN Retail Analytics & Mining Platform..."
echo " Project: CSI3010 Data Warehousing & Data Mining"
echo " Dashboard Local URL: http://127.0.0.1:$PORT"
echo "=========================================================="

python3 server.py

