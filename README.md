````md
## 📦 Project Structure

```text
shortly/
├─ client/             # React + Vite app
│  ├─ public/
│  │  └─ screenshots/  # README images live here
│  └─ src/             # components, pages, store, api
└─ server/             # Express API
   └─ src/             # routes, models, middlewares, utils
````

## ⚙️ Run Locally

### Backend

```bash
cd server
cp .env.example .env   # or create .env
npm install
npm run dev
# API → http://localhost:5000
```

### Frontend

```bash
cd client
cp .env.example .env   # or create client/.env
npm install
npm run dev
# Web → http://localhost:5173
```

**client/.env**

```ini
VITE_API_BASE=http://localhost:5000
```

## 🖼️ Screenshots

| Page              | Preview                                                       |
| ----------------- | ------------------------------------------------------------- |
| Dashboard (Light) | ![](client/public/screenshots/Analytics-Screenshot.png)       |
| Create Link       | ![](client/public/screenshots/create-link-Screenshot.png)     |
| Create Account    | ![](client/public/screenshots/Create-account-Screenshot.png)  |
| Edit Link         | ![](client/public/screenshots/editlink-Screenshot.png)        |
| Home (Dark)       | ![](client/public/screenshots/home-blackscreenScreenshot.png) |
| Home (Light)      | ![](client/public/screenshots/home-Screenshot.png)            |
| Login             | ![](client/public/screenshots/Login-Screenshot.png)           |
| Recent Clicks     | ![](client/public/screenshots/Recent-Clicks-Screenshot.png)   |

````

