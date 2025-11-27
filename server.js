const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { initDatabase, saveGameRecord } = require('./database');
const roomManager = require('./roomManager');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // 提供静态文件服务

let db;

// 初始化数据库
initDatabase()
    .then((database) => {
        db = database;
        console.log('数据库初始化完成');
    })
    .catch((err) => {
        console.error('数据库初始化失败:', err);
        process.exit(1);
    });

// API 路由

// 保存游戏记录
app.post('/api/games', async (req, res) => {
    try {
        const record = req.body;
        
        // 验证必需字段
        if (record.targetNumber === undefined || record.finalScore === undefined) {
            return res.status(400).json({ error: '缺少必需字段: targetNumber, finalScore' });
        }

        const savedRecord = await saveGameRecord(db, record);
        res.status(201).json({ success: true, data: savedRecord });
    } catch (error) {
        console.error('保存游戏记录错误:', error);
        res.status(500).json({ error: '保存游戏记录失败', message: error.message });
    }
});

// 房间管理 API

// 创建房间
app.post('/api/rooms', (req, res) => {
    try {
        const { playerName, settings } = req.body;
        
        if (!playerName) {
            return res.status(400).json({ error: '缺少玩家名称' });
        }

        const { roomId, playerId, room } = roomManager.createRoom(playerName, settings);
        
        res.json({
            success: true,
            data: {
                roomId,
                playerId,
                room: {
                    id: room.id,
                    hostId: room.hostId,
                    players: Array.from(room.players.values()),
                    settings: room.settings,
                    status: room.status
                }
            }
        });
    } catch (error) {
        console.error('创建房间错误:', error);
        res.status(500).json({ error: '创建房间失败', message: error.message });
    }
});

// 加入房间
app.post('/api/rooms/:roomId/join', (req, res) => {
    try {
        const { roomId } = req.params;
        const { playerName } = req.body;

        if (!playerName) {
            return res.status(400).json({ error: '缺少玩家名称' });
        }

        const { playerId, room } = roomManager.joinRoom(roomId, playerName);

        res.json({
            success: true,
            data: {
                playerId,
                room: {
                    id: room.id,
                    hostId: room.hostId,
                    players: Array.from(room.players.values()),
                    settings: room.settings,
                    status: room.status
                }
            }
        });
    } catch (error) {
        console.error('加入房间错误:', error);
        res.status(400).json({ error: error.message || '加入房间失败' });
    }
});

// 获取房间信息
app.get('/api/rooms/:roomId', (req, res) => {
    try {
        const { roomId } = req.params;
        const room = roomManager.getRoom(roomId);

        if (!room) {
            return res.status(404).json({ error: '房间不存在' });
        }

        res.json({
            success: true,
            data: {
                id: room.id,
                hostId: room.hostId,
                players: Array.from(room.players.values()),
                settings: room.settings,
                status: room.status,
                currentRound: room.currentRound,
                gameData: room.gameData,
                scores: room.scores
            }
        });
    } catch (error) {
        console.error('获取房间信息错误:', error);
        res.status(500).json({ error: '获取房间信息失败', message: error.message });
    }
});

// 离开房间
app.post('/api/rooms/:roomId/leave', (req, res) => {
    try {
        const { playerId } = req.body;
        roomManager.leaveRoom(playerId);
        res.json({ success: true });
    } catch (error) {
        console.error('离开房间错误:', error);
        res.status(500).json({ error: '离开房间失败', message: error.message });
    }
});

// 开始游戏
app.post('/api/rooms/:roomId/start', (req, res) => {
    try {
        const { roomId } = req.params;
        const { hostId } = req.body;

        const room = roomManager.startGame(roomId, hostId);

        res.json({
            success: true,
            data: {
                currentRound: room.currentRound,
                gameData: room.gameData,
                status: room.status
            }
        });
    } catch (error) {
        console.error('开始游戏错误:', error);
        res.status(400).json({ error: error.message || '开始游戏失败' });
    }
});

// 提交分数
app.post('/api/rooms/:roomId/submit', (req, res) => {
    try {
        const { roomId } = req.params;
        const { playerId, score, pool } = req.body;

        const room = roomManager.submitScore(roomId, playerId, score, pool);

        res.json({
            success: true,
            data: {
                status: room.status,
                currentRound: room.currentRound,
                gameData: room.currentRound <= room.settings.questionCount ? room.gameData : null,
                allReady: Array.from(room.players.values()).every(p => p.isReady)
            }
        });
    } catch (error) {
        console.error('提交分数错误:', error);
        res.status(400).json({ error: error.message || '提交分数失败' });
    }
});

// 获取房间排行榜
app.get('/api/rooms/:roomId/leaderboard', (req, res) => {
    try {
        const { roomId } = req.params;
        const leaderboard = roomManager.getRoomLeaderboard(roomId);
        res.json({ success: true, data: leaderboard });
    } catch (error) {
        console.error('获取房间排行榜错误:', error);
        res.status(400).json({ error: error.message || '获取排行榜失败' });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: '服务器运行正常', timestamp: new Date().toISOString() });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`API 文档:`);
    console.log(`  房间管理:`);
    console.log(`    POST /api/rooms - 创建房间`);
    console.log(`    POST /api/rooms/:roomId/join - 加入房间`);
    console.log(`    GET  /api/rooms/:roomId - 获取房间信息`);
    console.log(`    POST /api/rooms/:roomId/start - 开始游戏`);
    console.log(`    POST /api/rooms/:roomId/submit - 提交分数`);
    console.log(`    GET  /api/rooms/:roomId/leaderboard - 获取房间排行榜`);
    console.log(`    POST /api/rooms/:roomId/leave - 离开房间`);
});

