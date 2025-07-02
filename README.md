# 🐺 Werewolf Discord Bot - 桔梗 | Shiroku

<div align="center">

![Bot Status](https://img.shields.io/badge/Status-Online-brightgreen)
![Discord.js](https://img.shields.io/badge/Discord.js-v14-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-Latest-blue)
![License](https://img.shields.io/badge/License-Shiroku_Bot_License-red)

**Bot Discord game Soi Má (Werewolf) được viết bằng TypeScript với Discord.js v14 <(")**

[🔗  Invate](#-invite-the-bot-to-your-server) • [🚀 Commands](#-commands) • [⚙️ Installation](#️-cài-đặt--chạy) • [📝 Configuration](#-cấu-hình) • [📄 License](#%EF%B8%8F-quan-trọng---bản-quyền--sử-dụng)

</div>

> [!WARNING]
> 📢⚠️❗  
> **EN:** This application is currently distributed for free on GitHub and is open source under the [Shiroku Bot License](./LICENSE).  
> 🚫 Do not modify or redistribute it with advertising, or use it for commercial purposes.  
>   
> **VI:** Ứng dụng này hiện đang được phát hành miễn phí trên GitHub và là mã nguồn mở theo [Giấy phép Shiroku Bot](./LICENSE).  
> 🚫 Không được chỉnh sửa hoặc phân phối lại với mục đích quảng cáo, hoặc sử dụng cho mục đích thương mại.

> [!TIP]
> Vào server [Discord](https://discord.gg/naynaki) để được hỗ trợ về bot
---

## 🔗 Invite the Bot to Your Server
👉 [**Invite the Bot**](https://discord.com/oauth2/authorize?client_id=1344251907782217809&scope=bot%20applications.commands&permissions=274877990912)

## 🚀 Commands

### 🏠 **Room Management**
| Command | Description | Permission |
|---------|-------------|------------|
| `/masoi-create` | Tạo phòng chơi mới | Everyone |
| `/clear-room` | Xóa phòng chơi hiện tại | Host/Admin |
| `/status` | Xem trạng thái phòng và người chơi | Everyone |
| `/settings` | Cài đặt game (roles, time, etc.) | Host/Admin |

### 👥 **Player Management**
| Command | Description | Permission |
|---------|-------------|------------|
| `/masoi-join` | Tham gia phòng chơi | Everyone |
| `/masoi-leave` | Rời khỏi phòng chơi | Everyone |
| `/masoi-kick @user` | Kick người chơi khỏi phòng | Host/Admin |

### 🎮 **Game Control**
| Command | Description | Permission |
|---------|-------------|------------|
| `/masoi-start` | Bắt đầu game Ma Sói | Host/Admin |

### Xem đầy đủ slash command tại thư mục [`/commands`](./commands)
---

## ⚙️ Cài Đặt & Chạy

### 📋 **Requirements**
- **Node.js** v18.0.0 hoặc cao hơn
- **npm** hoặc **yarn**
- **Discord Bot Token** ([Tạo bot tại đây](https://discord.com/developers/applications))

### 🔧 **Installation Steps**

```bash
git clone https://github.com/MegumiKatou02/werewolf-discord.git
cd werewolf-discord-bot

npm install
# or
yarn install

cp .env.example .env

npm run dev:deploy
# or
npx tsx deploy-commands.ts

npm run dev
# or
npm run dev:watch
```
---

## 📝 Cấu Hình

### ⚙️ **Bot Permissions**
Bot cần các permissions sau trên Discord:
- ✅ **View Channels**
- ✅ **Send Messages**
- ✅ **Send Messages in Threads**
- ✅ **Embed Links**
- ✅ **Attach Files**
- ✅ **Read Message History**
- ✅ **Use Slash Commands**
- ✅ **Add Reactions**
- ✅ **Use External Emojis**

---

## 🛠️ Development

### 📁 **Project Structure**
```
📦 werewolf-discord-bot
├── 📂 commands/          # Slash commands
├── 📂 core/              # Game logic & room management  
├── 📂 types/             # TypeScript type definitions
├── 📂 utils/             # Utility functions
├── 📂 data/              # Roles data
...
├── 📂 dist/              # Compiled JavaScript
├── 📄 package.json       # Dependencies & scripts
├── 📄 tsconfig.json      # TypeScript configuration
└── 📄 .env.example       # Environment template
```

### **Scripts**
```bash
npm run dev          # Chạy với file Javascript sau khi build
npm run deploy       # Deploy command và chạy file Javascript
npm run dev:ts       # Chạy file ts mà không cần build
npm run dev:watch    # Chạy file ts và có hot-reload
npm run lint         # Check code style
```

---

## 🤝 Contributing

### 📋 **How to Contribute**
1. **Fork** repository này
2. **Tạo branch** cho feature: `git checkout -b feature/amazing-feature`
3. **Code** và test kỹ
4. **Commit**: `git commit -m 'Add amazing feature'`
5. **Push**: `git push origin feature/amazing-feature`
6. **Tạo Pull Request**

---

## ⚠️ QUAN TRỌNG - Bản Quyền & Sử Dụng
### Đọc file [Shiroku Bot License](./LICENSE)
---

<div align="center">

*© 2025 Yukiookii. All rights reserved.*

</div>

