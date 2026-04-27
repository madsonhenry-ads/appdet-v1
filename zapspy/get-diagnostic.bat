@echo off
echo {"email":"admin@whatspy","password":"whatspy2024"} > login.json
C:\Windows\System32\curl.exe -X POST "https://painel.xaimonitor.com/api/admin/login" -H "Content-Type: application/json" --data-binary "@login.json" -k -s > login-response.json

for /f "tokens=2 delims=:," %%a in ('findstr /r "\"token\"" login-response.json') do set TOKEN=%%a
set TOKEN=%TOKEN:"=%
set TOKEN=%TOKEN: =%

C:\Windows\System32\curl.exe "https://painel.xaimonitor.com/api/admin/refund-diagnostic" -H "Authorization: Bearer %TOKEN%" -k -s > diagnostic-full.json

type diagnostic-full.json

del login.json
del login-response.json
