@echo off
cd /d "C:\TruPay\TruPay\Dashboard\sentinel"
node "node_modules\vite\bin\vite.js" --host :: --port 5180 --strictPort > "vite-server.log" 2> "vite-server.error.log"
