// 房间管理系统（内存存储）

class RoomManager {
    constructor() {
        this.rooms = new Map(); // roomId -> Room
        this.players = new Map(); // playerId -> { roomId, playerName }
    }

    // 生成房间号（6位数字）
    generateRoomId() {
        let roomId;
        do {
            roomId = Math.floor(100000 + Math.random() * 900000).toString();
        } while (this.rooms.has(roomId));
        return roomId;
    }

    // 生成玩家ID
    generatePlayerId() {
        return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 创建房间
    createRoom(hostName, settings) {
        const roomId = this.generateRoomId();
        const hostId = this.generatePlayerId();

        const room = {
            id: roomId,
            hostId: hostId,
            players: new Map(), // playerId -> { id, name, score, isReady, currentRound }
            settings: {
                targetRange: { min: 1, max: 100 }, // 默认目标数字范围
                poolRange: { min: 1, max: 20 },   // 默认卡池数字范围
                operators: ['+', '-', '*', '/'], // 默认运算符
                targetNumberType: 'integer',     // 默认目标数字类型
                poolNumberType: 'integer',       // 默认卡池数字类型
                poolSize: 6,                     // 默认卡池大小
                timeLimit: 60,                   // 默认时间限制
                questionCount: 1,                // 默认题目数量
                allowNegative: false,            // 默认不允许负数
                allowDecimal: false,             // 默认不允许小数
                allowDuplication: true,          // 默认允许卡池数字重复
                customTargetNumbers: '',         // 默认自定义目标数字
                customPoolNumbers: '',           // 默认自定义卡池数字
                testMode: false,                 // 默认测试模式
                ...settings, // 合并传入的设置，覆盖默认值
                // 确保子对象合并正确
                targetRange: { ...({ min: 1, max: 100 }), ...(settings.targetRange || {}) },
                poolRange: { ...({ min: 1, max: 20 }), ...(settings.poolRange || {}) },
            },
            status: 'waiting', // waiting, playing, finished
            currentRound: 0,
            gameData: null, // { target, pool } - 当前题目的数据
            scores: [], // 每轮所有玩家的分数
            availableTargetNumbers: [], // 新增：预计算的目标数字数组
            availablePoolNumbers: []    // 新增：预计算的卡池数字数组
        };

        // 在创建房间后立即预计算可用数字列表
        const targetCustomNums = this.parseCustomNumbers(room.settings.customTargetNumbers);
        const poolCustomNums = this.parseCustomNumbers(room.settings.customPoolNumbers);
        room.availableTargetNumbers = this.precalculateAvailableNumbers(room.settings.targetRange.min, room.settings.targetRange.max, room.settings.targetNumberType, targetCustomNums);
        room.availablePoolNumbers = this.precalculateAvailableNumbers(room.settings.poolRange.min, room.settings.poolRange.max, room.settings.poolNumberType, poolCustomNums);

        room.players.set(hostId, {
            id: hostId,
            name: hostName,
            score: null,
            isReady: false,
            currentRound: 0
        });

        this.rooms.set(roomId, room);
        this.players.set(hostId, { roomId, playerName: hostName });

        return { roomId, playerId: hostId, room };
    }

    // 辅助函数：解析自定义数字字符串
    parseCustomNumbers(numberString) {
        if (!numberString) {
            return [];
        }
        // 支持中文逗号和英文逗号分隔
        return numberString.split(/[,，]/).map(s => Number(s.trim())).filter(n => !isNaN(n));
    }

    // 辅助函数：检查数字是否符合类型
    isNumberOfType(num, type) {
        switch (type) {
            case 'integer': return Number.isInteger(num);
            case 'decimal1': return (num * 10) % 1 === 0;
            case 'decimal2': return (num * 100) % 1 === 0;
            case 'mul10': return num % 10 === 0;
            case 'mul100': return num % 100 === 0;
            default: return Number.isInteger(num);
        }
    }

    // 辅助函数：预计算可用数字列表
    precalculateAvailableNumbers(min, max, type, customNumbers) {
        const uniqueNumbers = new Set();

        // 1. 添加自定义数字：只需要检查是否是有效数字，范围和类型在生成时再筛选
        customNumbers.forEach(num => {
            if (!isNaN(num)) { // 确保是有效数字
                uniqueNumbers.add(num);
            }
        });

        // 2. 添加符合范围和类型的所有数字
        // 这里生成符合范围和类型的基础数字，不与自定义数字进行重复检查，Set会自动去重
        if (type === 'integer') {
            for (let i = Math.floor(min); i <= Math.ceil(max); i++) { // 遍历整数范围
                uniqueNumbers.add(i);
            }
        } else if (type.startsWith('decimal')) {
            // 对于小数类型，我们生成一定数量的随机小数来填充，因为遍历小数范围不实际
            const precision = type === 'decimal1' ? 1 : 2;
            for (let i = 0; i < 200; i++) { // 尝试生成200个小数
                let num = Math.random() * (max - min) + min;
                num = Number(num.toFixed(precision));
                if (num >= min && num <= max) {
                    uniqueNumbers.add(num);
                }
            }
        } else if (type === 'mul10') {
            for (let i = Math.ceil(min / 10) * 10; i <= Math.floor(max / 10) * 10; i += 10) {
                uniqueNumbers.add(i);
            }
        } else if (type === 'mul100') {
            for (let i = Math.ceil(min / 100) * 100; i <= Math.floor(max / 100) * 100; i += 100) {
                uniqueNumbers.add(i);
            }
        }

        // 移除最后的筛选和空列表生成逻辑
        return Array.from(uniqueNumbers);
    }

    // 加入房间
    joinRoom(roomId, playerName) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error('房间不存在');
        }

        if (room.status !== 'waiting') {
            throw new Error('房间已开始游戏');
        }

        if (room.players.size >= 10) {
            throw new Error('房间已满');
        }

        const playerId = this.generatePlayerId();
        room.players.set(playerId, {
            id: playerId,
            name: playerName,
            score: null,
            isReady: false,
            currentRound: 0
        });

        this.players.set(playerId, { roomId, playerName });

        return { playerId, room };
    }

    // 离开房间
    leaveRoom(playerId) {
        const player = this.players.get(playerId);
        if (!player) {
            return null;
        }

        const room = this.rooms.get(player.roomId);
        if (room) {
            room.players.delete(playerId);
            
            // 如果房主离开，关闭房间
            if (room.hostId === playerId) {
                this.rooms.delete(player.roomId);
            } else if (room.players.size === 0) {
                // 如果房间为空，删除房间
                this.rooms.delete(player.roomId);
            }
        }

        this.players.delete(playerId);
        return room;
    }

    // 获取房间信息
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    // 更新玩家准备状态
    setPlayerReady(roomId, playerId, isReady) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error('房间不存在');
        }

        const player = room.players.get(playerId);
        if (!player) {
            throw new Error('玩家不在房间中');
        }

        player.isReady = isReady;
        return room;
    }

    // 开始游戏
    startGame(roomId, hostId, newSettings) { // 新增：接收 newSettings 参数
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error('房间不存在');
        }

        if (room.hostId !== hostId) {
            throw new Error('只有房主可以开始游戏');
        }

        if (room.status !== 'waiting') {
            throw new Error('游戏已经开始或已结束');
        }

        // 应用新的设置 (如果提供)
        if (newSettings) {
            // 更安全地合并设置，确保子对象不会变成 undefined
            room.settings = {
                ...room.settings,
                ...newSettings,
                targetRange: {
                    ...room.settings.targetRange,
                    ...(newSettings.targetRange || {})
                },
                poolRange: {
                    ...room.settings.poolRange,
                    ...(newSettings.poolRange || {})
                },
                operators: newSettings.operators ? [...newSettings.operators] : room.settings.operators,
                targetNumberType: newSettings.targetNumberType || room.settings.targetNumberType,
                poolNumberType: newSettings.poolNumberType || room.settings.poolNumberType,
                customTargetNumbers: newSettings.customTargetNumbers !== undefined ? newSettings.customTargetNumbers : room.settings.customTargetNumbers,
                customPoolNumbers: newSettings.customPoolNumbers !== undefined ? newSettings.customPoolNumbers : room.settings.customPoolNumbers,
                testMode: newSettings.testMode !== undefined ? newSettings.testMode : room.settings.testMode
            };

            // 重新预计算可用数字列表
            const targetCustomNums = this.parseCustomNumbers(room.settings.customTargetNumbers);
            const poolCustomNums = this.parseCustomNumbers(room.settings.customPoolNumbers);
            room.availableTargetNumbers = this.precalculateAvailableNumbers(room.settings.targetRange.min, room.settings.targetRange.max, room.settings.targetNumberType, targetCustomNums);
            room.availablePoolNumbers = this.precalculateAvailableNumbers(room.settings.poolRange.min, room.settings.poolRange.max, room.settings.poolNumberType, poolCustomNums);
        }

        room.currentRound = 1;
        room.status = 'playing';
        room.gameData = this.generateGameData(room.settings);
        
        // 重置所有玩家状态
        room.players.forEach(player => {
            player.isReady = false;
            player.currentRound = 1;
            player.score = null;
        });

        return room;
    }

    // 生成游戏数据（目标数字和卡池）
    generateGameData(settings) {
        // generateNumber 函数现在只负责根据范围和类型生成一个数字，不处理自定义列表
        const generateNumber = (min, max, type) => {
            let num = Math.random() * (max - min) + min;
            switch (type) {
                case 'integer': return Math.floor(num);
                case 'decimal1': return Number(num.toFixed(1));
                case 'decimal2': return Number(num.toFixed(2));
                case 'mul10': return Math.floor(num / 10) * 10;
                case 'mul100': return Math.floor(num / 100) * 100;
                default: return Math.floor(num);
            }
        };

        // 从预计算的数组中随机选择目标数字和卡池数字
        const target = (settings.availableTargetNumbers && settings.availableTargetNumbers.length > 0)
            ? settings.availableTargetNumbers[Math.floor(Math.random() * settings.availableTargetNumbers.length)]
            : generateNumber(settings.targetRange.min, settings.targetRange.max, settings.targetNumberType); // 如果预计算数组为空，回退到随机生成

        const pool = Array.from({ length: settings.poolSize }, () => ({
            value: (settings.availablePoolNumbers && settings.availablePoolNumbers.length > 0)
                ? settings.availablePoolNumbers[Math.floor(Math.random() * settings.availablePoolNumbers.length)]
                : generateNumber(settings.poolRange.min, settings.poolRange.max, settings.poolNumberType) // 如果预计算数组为空，回退到随机生成
        }));

        return { target, pool };
    }

    // 提交分数
    submitScore(roomId, playerId, score, pool) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error('房间不存在');
        }

        const player = room.players.get(playerId);
        if (!player) {
            throw new Error('玩家不在房间中');
        }

        player.score = score;
        player.isReady = true; // 提交分数后标记为准备下一轮

        // 检查是否所有玩家都提交了分数
        const allReady = Array.from(room.players.values()).every(p => p.isReady);

        if (allReady) {
            // 保存当前轮次分数
            const roundScores = Array.from(room.players.values()).map(p => ({
                playerId: p.id,
                playerName: p.name,
                score: p.score
            }));

            room.scores.push({
                round: room.currentRound,
                scores: roundScores
            });

            // 检查是否还有下一轮
            if (room.currentRound < room.settings.questionCount) {
                // 生成下一题
                room.currentRound++;
                room.gameData = this.generateGameData(room.settings);
                
                // 重置玩家准备状态
                room.players.forEach(p => {
                    p.isReady = false;
                    p.score = null;
                });
            } else {
                // 游戏结束
                room.status = 'finished';
            }
        }

        return room;
    }

    // 获取房间排行榜
    getRoomLeaderboard(roomId) {
        const room = this.rooms.get(roomId);
        if (!room) {
            throw new Error('房间不存在');
        }

        // 计算每个玩家的总分数（所有轮次的平均分）
        const playerTotals = new Map();

        room.scores.forEach(round => {
            round.scores.forEach(({ playerId, playerName, score }) => {
                if (!playerTotals.has(playerId)) {
                    playerTotals.set(playerId, {
                        playerId,
                        playerName,
                        scores: [],
                        totalScore: 0,
                        avgScore: 0
                    });
                }
                const player = playerTotals.get(playerId);
                player.scores.push(score);
                player.totalScore += parseFloat(score);
            });
        });

        // 计算平均分
        playerTotals.forEach(player => {
            player.avgScore = player.scores.length > 0 
                ? (player.totalScore / player.scores.length).toFixed(2)
                : '0.00';
        });

        // 转换为数组并排序
        const leaderboard = Array.from(playerTotals.values())
            .sort((a, b) => parseFloat(a.avgScore) - parseFloat(b.avgScore));

        return leaderboard;
    }

    // 清理过期房间（可选，定期清理）
    cleanup() {
        const now = Date.now();
        const maxAge = 2 * 60 * 60 * 1000; // 2小时

        for (const [roomId, room] of this.rooms.entries()) {
            // 这里可以添加时间戳来跟踪房间创建时间
            // 暂时只清理已完成的房间
            if (room.status === 'finished') {
                // 可以设置一个完成时间，超过一定时间后删除
                // 暂时保留，让玩家可以查看最终结果
            }
        }
    }
}

// 单例模式
const roomManager = new RoomManager();

module.exports = roomManager;

