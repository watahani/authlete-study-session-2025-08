import { TicketService } from '../../services/TicketService.js';
import { Ticket, Reservation, ReservationWithDetails } from '../../types/index.js';

export interface TicketSearchOptions {
  minPrice?: number;
  maxPrice?: number;
  eventDateAfter?: Date;
  eventDateBefore?: Date;
  availableSeatsMin?: number;
  sortBy?: 'price' | 'event_date' | 'available_seats';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ReservationOptions {
  userId: number;
  ticketId: number;
  seats: number;
}

export class TicketRepository {
  async getAllTickets(): Promise<Ticket[]> {
    try {
      return await TicketService.getAllTickets();
    } catch (error) {
      throw new Error(`Failed to fetch tickets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchTickets(options: TicketSearchOptions): Promise<Ticket[]> {
    try {
      const allTickets = await TicketService.getAllTickets();
      let filteredTickets = [...allTickets];

      if (options.minPrice !== undefined) {
        filteredTickets = filteredTickets.filter(ticket => ticket.price >= options.minPrice!);
      }

      if (options.maxPrice !== undefined) {
        filteredTickets = filteredTickets.filter(ticket => ticket.price <= options.maxPrice!);
      }

      if (options.eventDateAfter !== undefined) {
        filteredTickets = filteredTickets.filter(ticket => 
          new Date(ticket.event_date) > options.eventDateAfter!
        );
      }

      if (options.eventDateBefore !== undefined) {
        filteredTickets = filteredTickets.filter(ticket => 
          new Date(ticket.event_date) < options.eventDateBefore!
        );
      }

      if (options.availableSeatsMin !== undefined) {
        filteredTickets = filteredTickets.filter(ticket => 
          ticket.available_seats >= options.availableSeatsMin!
        );
      }

      if (options.sortBy) {
        const sortOrder = options.sortOrder === 'desc' ? -1 : 1;
        filteredTickets.sort((a, b) => {
          let valueA: number | Date;
          let valueB: number | Date;

          switch (options.sortBy) {
            case 'price':
              valueA = a.price;
              valueB = b.price;
              break;
            case 'event_date':
              valueA = new Date(a.event_date);
              valueB = new Date(b.event_date);
              break;
            case 'available_seats':
              valueA = a.available_seats;
              valueB = b.available_seats;
              break;
            default:
              return 0;
          }

          if (valueA < valueB) return -1 * sortOrder;
          if (valueA > valueB) return 1 * sortOrder;
          return 0;
        });
      }

      if (options.offset !== undefined) {
        filteredTickets = filteredTickets.slice(options.offset);
      }

      if (options.limit !== undefined) {
        filteredTickets = filteredTickets.slice(0, options.limit);
      }

      return filteredTickets;
    } catch (error) {
      throw new Error(`Failed to search tickets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTicketById(ticketId: number): Promise<Ticket | null> {
    try {
      return await TicketService.getTicketById(ticketId);
    } catch (error) {
      throw new Error(`Failed to fetch ticket: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async reserveTicket(options: ReservationOptions): Promise<Reservation> {
    try {
      return await TicketService.reserveTicket(options.userId, options.ticketId, options.seats);
    } catch (error) {
      throw new Error(`Failed to reserve ticket: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserReservations(userId: number): Promise<ReservationWithDetails[]> {
    try {
      return await TicketService.getUserReservations(userId);
    } catch (error) {
      throw new Error(`Failed to fetch user reservations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async cancelReservation(reservationId: number, userId: number): Promise<void> {
    try {
      await TicketService.cancelReservation(reservationId, userId);
    } catch (error) {
      throw new Error(`Failed to cancel reservation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}