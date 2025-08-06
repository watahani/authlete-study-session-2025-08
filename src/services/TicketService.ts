import { MockDatabaseConfig as DatabaseConfig } from '../config/mock-database.js';
import { Ticket, Reservation, ReservationWithDetails } from '../types/index.js';

interface ResultSetHeader {
  insertId: number;
  affectedRows?: number;
}

export class TicketService {
  static async getAllTickets(): Promise<Ticket[]> {
    const connection = DatabaseConfig.getConnection();
    
    const [tickets] = await connection.execute(
      'SELECT * FROM tickets WHERE event_date > NOW() ORDER BY event_date ASC'
    );
    
    return tickets as Ticket[];
  }
  
  static async getTicketById(ticketId: number): Promise<Ticket | null> {
    const connection = DatabaseConfig.getConnection();
    
    const [tickets] = await connection.execute(
      'SELECT * FROM tickets WHERE id = ?',
      [ticketId]
    );
    
    const ticketArray = tickets as Ticket[];
    return ticketArray.length > 0 ? ticketArray[0] : null;
  }
  
  static async reserveTicket(userId: number, ticketId: number, seats: number): Promise<Reservation> {
    const connection = DatabaseConfig.getConnection();
    
    await connection.execute('START TRANSACTION');
    
    try {
      const [tickets] = await connection.execute(
        'SELECT available_seats FROM tickets WHERE id = ? FOR UPDATE',
        [ticketId]
      );
      
      const ticketArray = tickets as { available_seats: number }[];
      if (ticketArray.length === 0) {
        throw new Error('Ticket not found');
      }
      
      const availableSeats = ticketArray[0].available_seats;
      if (availableSeats < seats) {
        throw new Error(`Only ${availableSeats} seats available`);
      }
      
      await connection.execute(
        'UPDATE tickets SET available_seats = available_seats - ? WHERE id = ?',
        [seats, ticketId]
      );
      
      const [result] = await connection.execute(
        'INSERT INTO reservations (user_id, ticket_id, seats_reserved) VALUES (?, ?, ?)',
        [userId, ticketId, seats]
      );
      
      const reservationId = (result as ResultSetHeader).insertId;
      
      const [reservations] = await connection.execute(
        'SELECT * FROM reservations WHERE id = ?',
        [reservationId]
      );
      
      await connection.execute('COMMIT');
      return (reservations as Reservation[])[0];
      
    } catch (error) {
      await connection.execute('ROLLBACK');
      throw error;
    }
  }
  
  static async getUserReservations(userId: number): Promise<ReservationWithDetails[]> {
    const connection = DatabaseConfig.getConnection();
    
    const [reservations] = await connection.execute(`
      SELECT 
        r.*,
        t.title as ticket_title,
        t.price as ticket_price,
        t.event_date
      FROM reservations r
      JOIN tickets t ON r.ticket_id = t.id
      WHERE r.user_id = ? AND r.status = 'active'
      ORDER BY r.reservation_date DESC
    `, [userId]);
    
    return reservations as ReservationWithDetails[];
  }
  
  static async cancelReservation(reservationId: number, userId: number): Promise<void> {
    const connection = DatabaseConfig.getConnection();
    
    await connection.execute('START TRANSACTION');
    
    try {
      const [reservations] = await connection.execute(
        'SELECT * FROM reservations WHERE id = ? AND user_id = ? AND status = "active" FOR UPDATE',
        [reservationId, userId]
      );
      
      const reservationArray = reservations as Reservation[];
      if (reservationArray.length === 0) {
        throw new Error('Reservation not found or already cancelled');
      }
      
      const reservation = reservationArray[0];
      
      await connection.execute(
        'UPDATE reservations SET status = "cancelled" WHERE id = ?',
        [reservationId]
      );
      
      await connection.execute(
        'UPDATE tickets SET available_seats = available_seats + ? WHERE id = ?',
        [reservation.seats_reserved, reservation.ticket_id]
      );
      
      await connection.execute('COMMIT');
      
    } catch (error) {
      await connection.execute('ROLLBACK');
      throw error;
    }
  }
}