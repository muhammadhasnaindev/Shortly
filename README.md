# 🔗 Shortly — Link Shortener & Analytics (MERN)

A production-ready link shortener with authentication, custom domains, QR codes, password-protected links, click analytics (time/device/browser/country), saved views, CSV export, and shareable analytics links.

---

## 🚀 Tech Stack

| Layer      | Technologies |
|-----------|--------------|
| Frontend  | React 18, Vite, MUI, Tailwind, React Router, Recharts, Axios |
| Backend   | Node.js, Express, MongoDB (Mongoose), JWT, BullMQ (optional), Nodemailer |
| Dev Tools | Git, VS Code, NPM |

---

## 📦 Project Structure

shortly/
├─ client/ # React + Vite app
│ ├─ public/
│ │ └─ screenshots/ # README images live here
│ └─ src/ # components, pages, store, api
└─ server/ # Express API
└─ src/ # routes, models, middlewares, utils

yaml
Copy code

---

## ⚙️ Run Locally

### Backend
```bash
cd server
cp .env.example .env   # or create .env
npm install
npm run dev
API → http://localhost:5000

Frontend
bash
Copy code
cd client
cp .env.example .env   # or create client/.env
npm install
npm run dev
Web → http://localhost:5173

Common client env

ini
Copy code
VITE_API_BASE=http://localhost:5000
🖼️ Screenshots
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
