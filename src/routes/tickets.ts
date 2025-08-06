import express from 'express';
import { TicketService } from '../services/TicketService.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/tickets', async (req, res) => {
  try {
    const tickets = await TicketService.getAllTickets();
    res.json(tickets);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch tickets';
    res.status(500).json({ error: errorMessage });
  }
});

router.get('/tickets/:id', async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json({ error: 'Invalid ticket ID' });
    }

    const ticket = await TicketService.getTicketById(ticketId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(ticket);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch ticket';
    res.status(500).json({ error: errorMessage });
  }
});

router.post('/tickets/:id/reserve', authMiddleware, async (req, res) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { seats } = req.body;
    
    if (isNaN(ticketId) || !seats || seats <= 0) {
      return res.status(400).json({ error: 'Invalid ticket ID or seat count' });
    }

    const reservation = await TicketService.reserveTicket(
      (req.user as Express.User & { id: number }).id,
      ticketId,
      seats
    );

    res.status(201).json({ message: 'Reservation successful', reservation });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Reservation failed';
    res.status(400).json({ error: errorMessage });
  }
});

router.get('/my-reservations', authMiddleware, async (req, res) => {
  try {
    const reservations = await TicketService.getUserReservations(
      (req.user as Express.User & { id: number }).id
    );
    res.json(reservations);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch reservations';
    res.status(500).json({ error: errorMessage });
  }
});

router.delete('/reservations/:id', authMiddleware, async (req, res) => {
  try {
    const reservationId = parseInt(req.params.id);
    if (isNaN(reservationId)) {
      return res.status(400).json({ error: 'Invalid reservation ID' });
    }

    await TicketService.cancelReservation(
      reservationId,
      (req.user as Express.User & { id: number }).id
    );

    res.json({ message: 'Reservation cancelled successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to cancel reservation';
    res.status(400).json({ error: errorMessage });
  }
});

export { router as ticketRoutes };