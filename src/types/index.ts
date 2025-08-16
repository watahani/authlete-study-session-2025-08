export interface User {
  id: number;
  username: string;
  email: string;
  created_at: Date;
}

export interface UserWithPassword extends User {
  password: string;
}

export interface Ticket {
  id: number;
  title: string;
  description: string;
  price: number;
  available_seats: number;
  total_seats: number;
  event_date: Date;
  created_at: Date;
}

export interface Reservation {
  id: number;
  user_id: number;
  ticket_id: number;
  seats_reserved: number;
  reservation_date: Date;
  status: 'active' | 'cancelled';
}

export interface ReservationWithDetails extends Reservation {
  ticket_title: string;
  ticket_price: number;
  event_date: Date;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  email: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ReserveTicketRequest {
  seats: number;
}

export interface OAuthClient {
  clientId: number;
  clientIdAlias?: string;
  clientIdAliasEnabled?: boolean;
  clientName?: string;
  logoUri?: string;
  number?: number;
}

export interface OAuthScope {
  defaultEntry: boolean;
  description: string;
  name: string;
}

declare module 'express-session' {
  interface SessionData {
    oauthTicket?: string;
    oauthClient?: OAuthClient;
    oauthScopes?: OAuthScope[];
  }
}