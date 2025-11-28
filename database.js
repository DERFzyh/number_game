const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'game.db');

function initDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) {
                return reject(err);
            }
            console.log('Connected to the SQLite database.');

            // Create table if not exists
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS game_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_name TEXT,
                    target_number INTEGER,
                    final_score INTEGER,
                    details TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            db.run(createTableQuery, (err) => {
                if (err) {
                    return reject(err);
                }
                console.log('Game records table ready.');
                resolve(db);
            });
        });
    });
}

function saveGameRecord(db, record) {
    return new Promise((resolve, reject) => {
        const { playerName, targetNumber, finalScore, ...otherDetails } = record;
        const details = JSON.stringify(otherDetails);

        const query = `
            INSERT INTO game_records (player_name, target_number, final_score, details)
            VALUES (?, ?, ?, ?)
        `;

        db.run(query, [playerName || 'Anonymous', targetNumber, finalScore, details], function (err) {
            if (err) {
                return reject(err);
            }
            resolve({
                id: this.lastID,
                playerName,
                targetNumber,
                finalScore,
                createdAt: new Date()
            });
        });
    });
}

module.exports = {
    initDatabase,
    saveGameRecord
};
