@echo off
netsh advfirewall firewall add rule name="TruPay Sentinel API 5000" dir=in action=allow protocol=TCP localport=5000 profile=any
echo.
echo Sentinel API firewall rule added. Press any key to close.
pause
