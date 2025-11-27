# 数字逼近游戏

一个通过加减乘除运算接近目标数字的游戏，支持单人游戏和多人对战房间模式。

## 功能特性

- 🎮 数字运算游戏：通过选择两个数字卡片进行加减乘除运算
- 🏠 对战房间：创建或加入房间，与其他玩家同台竞技
- 📊 房间排行榜：实时显示房间内所有玩家的排名和分数
- ⚙️ 自定义设置：可配置运算符、数字范围、数字类型、题目数量等
- 🎯 操作追踪：记录每次游戏的操作次数
- 🔄 实时同步：房间内所有玩家同步游戏状态（目标数字、卡池）

## 技术栈

### 前端
- HTML5
- CSS3
- 原生 JavaScript

### 后端
- Node.js
- Express.js
- SQLite3

## 安装和运行

### 1. 安装依赖

```bash
npm install
```

### 2. 启动后端服务器

```bash
npm start
```

或者使用开发模式（自动重启）：

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

### 3. 访问游戏

在浏览器中打开 `http://localhost:3000` 即可开始游戏。

## API 接口

### 房间管理

#### POST /api/rooms
创建房间

**请求体：**
```json
{
  "playerName": "玩家名称",
  "settings": {
    "operators": ["+", "-"],
    "targetRange": { "min": 10, "max": 100 },
    "poolRange": { "min": 1, "max": 50 },
    "numberType": "integer",
    "poolSize": 5,
    "questionCount": 3
  }
}
```

#### POST /api/rooms/:roomId/join
加入房间

**请求体：**
```json
{
  "playerName": "玩家名称"
}
```

#### GET /api/rooms/:roomId
获取房间信息

#### POST /api/rooms/:roomId/start
开始游戏（仅房主）

**请求体：**
```json
{
  "hostId": "player_id"
}
```

#### POST /api/rooms/:roomId/submit
提交分数

**请求体：**
```json
{
  "playerId": "player_id",
  "score": 2.5,
  "pool": [...]
}
```

#### GET /api/rooms/:roomId/leaderboard
获取房间排行榜

#### POST /api/rooms/:roomId/leave
离开房间

**请求体：**
```json
{
  "playerId": "player_id"
}
```

### 其他接口

#### POST /api/games
保存单人游戏记录

#### GET /api/health
健康检查接口

## 数据库

游戏使用 SQLite 数据库存储记录，数据库文件为 `game.db`（首次运行会自动创建）。

## 项目结构

```
number_game/
├── index.html          # 前端页面
├── script.js           # 前端逻辑
├── style.css           # 样式文件
├── server.js           # Express 服务器
├── database.js         # 数据库操作
├── package.json        # 项目配置
└── README.md          # 说明文档
```

## 游戏规则

1. 游戏会生成一个目标数字
2. 玩家需要从初始数字池中选择两个数字
3. 使用加减乘除运算来生成新数字
4. 目标是通过运算使所有数字尽可能接近目标数字
5. 最终分数 = (所有数字与目标数字的差值绝对值之和) / 数字个数
6. 分数越低越好

## 对战房间功能

### 创建房间
1. 点击主页的"对战房间"按钮
2. 选择"创建房间"
3. 输入玩家名称和题目数量
4. 获得6位房间号，分享给其他玩家

### 加入房间
1. 点击主页的"对战房间"按钮
2. 选择"加入房间"
3. 输入玩家名称和房间号
4. 等待房主开始游戏

### 游戏流程
1. 房主点击"开始游戏"后，所有玩家获得相同的目标数字和卡池
2. 玩家独立进行运算，完成后提交分数
3. 所有玩家提交后，自动进入下一题（如果还有）
4. 所有题目完成后，显示最终排行榜
5. 房间排行榜实时更新，显示所有玩家的平均分数排名

## 开发说明

- 前端代码位于 `script.js` 和 `index.html`
- 后端 API 位于 `server.js`
- 数据库操作位于 `database.js`
- 所有 API 请求使用 JSON 格式
- 前端使用 `fetch` API 与后端通信

## 许可证

MIT

