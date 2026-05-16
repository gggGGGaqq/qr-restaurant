# Production Deploy

Цель: frontend работает на Vercel, backend работает на Windows-ПК на порту `4000`, процесс backend держит PM2, публичный HTTPS для backend дает Cloudflare Tunnel. Nginx не используется.

## 1. Что нужно заранее

Понадобятся:

- Node.js LTS и npm на Windows-ПК.
- MySQL на Windows-ПК или доступный MySQL-сервер.
- Аккаунт Vercel.
- Аккаунт Cloudflare и домен, добавленный в Cloudflare DNS.
- Поддомен для API, например `api.example.com`.
- Будущий frontend URL Vercel, например `https://your-vercel-project.vercel.app`.

Проверка:

```powershell
node -v
npm -v
mysql --version
```

## 2. Установка зависимостей

В корне проекта на Windows-ПК:

```powershell
npm ci
npm install -g pm2
```

## 3. База данных

Создать базу:

```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS qr_restaurant CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p -e "CREATE USER IF NOT EXISTS 'qr_restaurant_user'@'localhost' IDENTIFIED BY 'CHANGE_ME_STRONG_PASSWORD'; GRANT ALL PRIVILEGES ON qr_restaurant.* TO 'qr_restaurant_user'@'localhost'; FLUSH PRIVILEGES;"
```

Импортировать схему и seed-данные:

```powershell
cmd /c "mysql -u root -p qr_restaurant < database\schema.sql"
cmd /c "mysql -u root -p qr_restaurant < database\seed.sql"
```

## 4. Backend .env

Создать production `.env`:

```powershell
Copy-Item .\server\.env.production.example .\server\.env
notepad .\server\.env
```

Заполнить:

```dotenv
NODE_ENV=production
PORT=4000
CLIENT_URL=https://your-vercel-project.vercel.app
SESSION_TIMEOUT_MINUTES=90
DB_HOST=localhost
DB_PORT=3306
DB_USER=qr_restaurant_user
DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD
DB_NAME=qr_restaurant
DB_CONNECTION_LIMIT=10
```

Важно: `CLIENT_URL` должен точно совпадать с Vercel frontend origin, без `/` в конце.

## 5. Backend production build

Собрать backend:

```powershell
npm run build:server
```

Проверить локально:

```powershell
npm run start:server
```

В другом PowerShell:

```powershell
Invoke-WebRequest http://localhost:4000/health | Select-Object -ExpandProperty Content
```

Остановить локальный запуск через `Ctrl+C`.

## 6. PM2

Запустить backend через PM2:

```powershell
npm run pm2:start
pm2 status
npm run pm2:logs
```

Сохранить список процессов PM2:

```powershell
npm run pm2:save
```

Перезапуск после изменения `.env` или нового build:

```powershell
npm run build:server
npm run pm2:restart
```

Остановить backend:

```powershell
npm run pm2:stop
```

## 7. Cloudflare Tunnel

Установить `cloudflared` на Windows и проверить:

```powershell
cloudflared --version
```

Авторизоваться:

```powershell
cloudflared tunnel login
```

Создать tunnel:

```powershell
cloudflared tunnel create qr-restaurant-api
cloudflared tunnel list
```

Скопировать пример конфига:

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.cloudflared"
Copy-Item .\deploy\cloudflared\config.example.yml "$env:USERPROFILE\.cloudflared\config.yml"
notepad "$env:USERPROFILE\.cloudflared\config.yml"
```

Заполнить `config.yml`:

```yaml
tunnel: <TUNNEL_ID_OR_NAME>
credentials-file: C:\Users\<WINDOWS_USER>\.cloudflared\<TUNNEL_ID>.json

ingress:
  - hostname: api.example.com
    service: http://localhost:4000
  - service: http_status:404
```

Создать DNS route:

```powershell
cloudflared tunnel route dns qr-restaurant-api api.example.com
```

Проверить ingress:

```powershell
cloudflared tunnel ingress validate
cloudflared tunnel ingress rule https://api.example.com
```

Запустить tunnel для теста:

```powershell
cloudflared tunnel run qr-restaurant-api
```

В другом PowerShell:

```powershell
Invoke-WebRequest https://api.example.com/health | Select-Object -ExpandProperty Content
Invoke-WebRequest "https://api.example.com/socket.io/?EIO=4&transport=polling" | Select-Object -ExpandProperty Content
```

Socket.io endpoint должен вернуть строку, которая начинается с `0{...}`. Это значит, что polling handshake работает; WebSocket upgrade через Cloudflare Tunnel тоже поддерживается.

## 8. Cloudflare Tunnel как Windows service

Открыть PowerShell или CMD от имени администратора.

Cloudflare service на Windows обычно читает конфиг из системного профиля, поэтому скопировать туда config и credentials:

```powershell
New-Item -ItemType Directory -Force "C:\Cloudflared\bin"
New-Item -ItemType Directory -Force "C:\Windows\System32\config\systemprofile\.cloudflared"
Copy-Item "$env:USERPROFILE\.cloudflared\config.yml" "C:\Windows\System32\config\systemprofile\.cloudflared\config.yml"
Copy-Item "$env:USERPROFILE\.cloudflared\<TUNNEL_ID>.json" "C:\Windows\System32\config\systemprofile\.cloudflared\<TUNNEL_ID>.json"
```

Если `cloudflared.exe` не лежит в `C:\Cloudflared\bin`, скопировать его туда:

```powershell
Copy-Item "C:\Path\To\cloudflared.exe" "C:\Cloudflared\bin\cloudflared.exe"
```

Установить service:

```powershell
cd C:\Cloudflared\bin
.\cloudflared.exe service install
sc.exe start cloudflared
sc.exe query cloudflared
```

Если service не подхватил config, в Registry Editor проверить `HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\Cloudflared` и поставить `ImagePath`:

```text
C:\Cloudflared\bin\cloudflared.exe --config=C:\Windows\System32\config\systemprofile\.cloudflared\config.yml tunnel run
```

После изменения config:

```powershell
sc.exe stop cloudflared
sc.exe start cloudflared
```

## 9. Vercel frontend

В Vercel Dashboard:

- Import Project из репозитория.
- Root Directory: `client`.
- Framework Preset: `Vite`.
- Build Command: `npm run build`.
- Output Directory: `dist`.

Environment Variables для Production:

```dotenv
VITE_API_URL=https://api.example.com
VITE_SOCKET_URL=https://api.example.com
```

Через Vercel CLI:

```powershell
npm install -g vercel
cd client
vercel login
vercel link
vercel env add VITE_API_URL production
vercel env add VITE_SOCKET_URL production
vercel --prod
```

После первого production deploy взять итоговый Vercel URL и обновить `server\.env`:

```dotenv
CLIENT_URL=https://your-vercel-project.vercel.app
```

Затем перезапустить backend:

```powershell
cd ..
npm run pm2:restart
```

## 10. Socket.io checklist

Проверить:

- `VITE_SOCKET_URL` равен backend HTTPS URL из Cloudflare Tunnel, например `https://api.example.com`.
- `VITE_SOCKET_URL` без `/socket.io` и без `/` в конце.
- `VITE_API_URL` равен тому же backend HTTPS URL.
- `CLIENT_URL` на backend равен frontend origin Vercel, например `https://your-vercel-project.vercel.app`.
- Cloudflare Tunnel service указывает на `http://localhost:4000`.
- Backend реально слушает `PORT=4000`.
- После изменения Vercel env нужно сделать новый deploy frontend.
- После изменения `server\.env` нужно выполнить `npm run pm2:restart`.

## 11. Обновление production

На Windows-ПК:

```powershell
git pull
npm ci
npm run build:server
npm run pm2:restart
npm run pm2:save
```

Frontend обновляется через новый Vercel deploy. Если менялись `VITE_*`, обязательно redeploy, потому что Vite встраивает эти значения во время build.

## 12. Package scripts

Root scripts:

```json
{
  "dev": "concurrently -n server,client -c green,cyan \"npm run dev -w server\" \"npm run dev -w client\"",
  "build": "npm run build -w server && npm run build -w client",
  "build:server": "npm run build -w server",
  "build:client": "npm run build -w client",
  "start:server": "npm run start -w server",
  "pm2:start": "pm2 start ecosystem.config.js --env production",
  "pm2:restart": "pm2 restart qr-restaurant-api --update-env",
  "pm2:stop": "pm2 stop qr-restaurant-api",
  "pm2:logs": "pm2 logs qr-restaurant-api",
  "pm2:save": "pm2 save",
  "typecheck": "npm run typecheck -w server && npm run typecheck -w client"
}
```

## 13. PM2 ecosystem.config.js

Файл уже лежит в корне проекта:

```js
const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "qr-restaurant-api",
      cwd: path.join(__dirname, "server"),
      script: "dist/server.js",
      exec_mode: "fork",
      instances: 1,
      watch: false,
      autorestart: true,
      max_memory_restart: "512M",
      time: true,
      env: {
        NODE_ENV: "production",
        PORT: "4000",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: "4000",
      },
    },
  ],
};
```
