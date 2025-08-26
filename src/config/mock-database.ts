// モックデータベース（テスト用）
import { logger } from '../utils/logger.js';
interface MockUser {
  id: number;
  username: string;
  password: string;
  email: string;
  created_at: Date;
}

interface ResultSetHeader {
  insertId: number;
  affectedRows?: number;
}

interface UserPartial {
  id: number;
  username: string;
  email: string;
  created_at: Date;
}

interface TicketAvailabilityRow {
  available_seats: number;
}

type QueryResult = 
  | MockUser[] 
  | MockTicket[] 
  | MockReservation[] 
  | UserPartial[]
  | TicketAvailabilityRow[]
  | ResultSetHeader;

interface MockTicket {
  id: number;
  title: string;
  description: string;
  price: number;
  available_seats: number;
  total_seats: number;
  event_date: Date;
  created_at: Date;
}

interface MockReservation {
  id: number;
  user_id: number;
  ticket_id: number;
  seats_reserved: number;
  reservation_date: Date;
  status: 'active' | 'cancelled';
}

let users: MockUser[] = [];
let tickets: MockTicket[] = [
  {
    id: 1,
    title: 'Authlete勉強会 2025-08-27',
    description: 'OAuth 2.1とMCPプロトコルについて学ぶ勉強会',
    price: 5000.00,
    available_seats: 50,
    total_seats: 50,
    event_date: new Date('2025-08-28 18:30:00'),
    created_at: new Date()
  },
  {
    id: 2,
    title: 'Node.js ワークショップ',
    description: 'Express.jsとTypeScriptを使った開発実践',
    price: 8000.00,
    available_seats: 30,
    total_seats: 30,
    event_date: new Date('2025-08-20 10:00:00'),
    created_at: new Date()
  },
  {
    id: 3,
    title: 'セキュリティ入門セミナー',
    description: '認証・認可の基礎を学ぶセミナー',
    price: 3000.00,
    available_seats: 100,
    total_seats: 100,
    event_date: new Date('2025-08-25 13:00:00'),
    created_at: new Date()
  }
];
let reservations: MockReservation[] = [];
let nextUserId = 2;
let nextReservationId = 1;

export class MockDatabaseConfig {
  static async initialize(): Promise<void> {
    // テスト用ユーザーを初期化
    const bcrypt = await import('bcryptjs');
    const testUserPassword = await bcrypt.default.hash('testpass', 10);
    
    users.push({
      id: 1,
      username: 'testuser',
      password: testUserPassword,
      email: 'test@example.com',
      created_at: new Date()
    });
    
    logger.info('Mock database initialized');
  }

  static getConnection() {
    return {
      async execute(query: string, params: any[] = []): Promise<[QueryResult, any]> {
        if (query.includes('SELECT id FROM users WHERE username = ? OR email = ?')) {
          const [username, email] = params;
          const existingUsers = users.filter(u => u.username === username || u.email === email);
          return [existingUsers, {}];
        }
        
        if (query.includes('INSERT INTO users')) {
          const [username, password, email] = params;
          const newUser: MockUser = {
            id: nextUserId++,
            username,
            password,
            email,
            created_at: new Date()
          };
          users.push(newUser);
          return [{ insertId: newUser.id } as ResultSetHeader, {}];
        }
        
        if (query.includes('SELECT id, username, email, created_at FROM users WHERE id = ?')) {
          const [id] = params;
          const user = users.find(u => u.id === id);
          return [user ? [{ id: user.id, username: user.username, email: user.email, created_at: user.created_at }] : [], {}];
        }
        
        if (query.includes('SELECT id, username, password, email, created_at FROM users WHERE username = ?')) {
          const [username] = params;
          const user = users.find(u => u.username === username);
          return [user ? [user] : [], {}];
        }
        
        if (query.includes('SELECT * FROM tickets WHERE event_date > NOW()')) {
          return [tickets, {}];
        }
        
        if (query.includes('SELECT * FROM tickets WHERE id = ?')) {
          const [id] = params;
          const ticket = tickets.find(t => t.id === id);
          return [ticket ? [ticket] : [], {}];
        }
        
        if (query.includes('SELECT available_seats FROM tickets WHERE id = ? FOR UPDATE')) {
          const [id] = params;
          const ticket = tickets.find(t => t.id === id);
          return [ticket ? [{ available_seats: ticket.available_seats }] : [], {}];
        }
        
        if (query.includes('UPDATE tickets SET available_seats = available_seats - ? WHERE id = ?')) {
          const [seats, id] = params;
          const ticket = tickets.find(t => t.id === id);
          if (ticket) {
            ticket.available_seats -= seats;
          }
          return [{ insertId: 0, affectedRows: 1 } as ResultSetHeader, {}];
        }
        
        if (query.includes('INSERT INTO reservations')) {
          const [userId, ticketId, seats] = params;
          const newReservation: MockReservation = {
            id: nextReservationId++,
            user_id: userId,
            ticket_id: ticketId,
            seats_reserved: seats,
            reservation_date: new Date(),
            status: 'active'
          };
          reservations.push(newReservation);
          return [{ insertId: newReservation.id } as ResultSetHeader, {}];
        }
        
        if (query.includes('SELECT * FROM reservations WHERE id = ?')) {
          const [id] = params;
          const reservation = reservations.find(r => r.id === id);
          return [reservation ? [reservation] : [], {}];
        }

        // getUserReservations用クエリ
        if (query.includes('SELECT') && query.includes('FROM reservations r') && query.includes('JOIN tickets t')) {
          const [userId] = params;
          const userReservations = reservations
            .filter(r => r.user_id === userId && r.status === 'active')
            .map(reservation => {
              const ticket = tickets.find(t => t.id === reservation.ticket_id);
              if (!ticket) return null;
              
              return {
                ...reservation,
                ticket_title: ticket.title,
                ticket_price: ticket.price,
                event_date: ticket.event_date
              };
            })
            .filter(r => r !== null)
            .sort((a, b) => b!.reservation_date.getTime() - a!.reservation_date.getTime());
          
          return [userReservations, {}];
        }

        // 予約キャンセル用クエリ
        if (query.includes('SELECT * FROM reservations WHERE id = ? AND user_id = ? AND status = "active"')) {
          const [reservationId, userId] = params;
          const reservation = reservations.find(r => 
            r.id === reservationId && 
            r.user_id === userId && 
            r.status === 'active'
          );
          return [reservation ? [reservation] : [], {}];
        }

        if (query.includes('UPDATE reservations SET status = "cancelled" WHERE id = ?')) {
          const [reservationId] = params;
          const reservation = reservations.find(r => r.id === reservationId);
          if (reservation) {
            reservation.status = 'cancelled';
          }
          return [{ insertId: 0, affectedRows: 1 } as ResultSetHeader, {}];
        }

        if (query.includes('UPDATE tickets SET available_seats = available_seats + ? WHERE id = ?')) {
          const [seats, ticketId] = params;
          const ticket = tickets.find(t => t.id === ticketId);
          if (ticket) {
            ticket.available_seats += seats;
          }
          return [{ insertId: 0, affectedRows: 1 } as ResultSetHeader, {}];
        }

        // トランザクション用クエリ（モックなので何もしない）
        if (query.includes('START TRANSACTION') || query.includes('COMMIT') || query.includes('ROLLBACK')) {
          return [{ insertId: 0, affectedRows: 0 } as ResultSetHeader, {}];
        }
        
        return [[], {}];
      },
      
      async end() {
        // Mock - do nothing
      }
    };
  }

  static async close(): Promise<void> {
    // Mock - do nothing
  }
}