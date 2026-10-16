@echo off
cd /d "C:\TruPay\TruPay\Dashboard\sentinel"
node server.cjs > "sentinel-api.log" 2> "sentinel-api.error.log"
