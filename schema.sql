-- チケット販売サービス データベーススキーマ
CREATE DATABASE IF NOT EXISTS ticket_sales;
USE ticket_sales;

-- ユーザーテーブル
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- チケットテーブル
CREATE TABLE tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    available_seats INT NOT NULL,
    total_seats INT NOT NULL,
    event_date DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 予約テーブル
CREATE TABLE reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ticket_id INT NOT NULL,
    seats_reserved INT NOT NULL,
    reservation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'cancelled') DEFAULT 'active',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

-- インデックスの追加
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_ticket_id ON reservations(ticket_id);
CREATE INDEX idx_tickets_event_date ON tickets(event_date);

-- サンプルデータの挿入
INSERT INTO tickets (title, description, price, available_seats, total_seats, event_date) VALUES
('Authlete勉強会 2025-08', 'OAuth 2.1とMCPプロトコルについて学ぶ勉強会', 5000.00, 50, 50, '2025-08-15 14:00:00'),
('Node.js ワークショップ', 'Express.jsとTypeScriptを使った開発実践', 8000.00, 30, 30, '2025-08-20 10:00:00'),
('セキュリティ入門セミナー', '認証・認可の基礎を学ぶセミナー', 3000.00, 100, 100, '2025-08-25 13:00:00');