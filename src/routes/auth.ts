import express from 'express';
import passport from 'passport';
import { AuthService } from '../services/AuthService.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;
    
    if (!username || !password || !email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await AuthService.register({ username, password, email });
    res.status(201).json({ message: 'User created successfully', user: { id: user.id, username: user.username, email: user.email } });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Registration failed';
    res.status(400).json({ error: errorMessage });
  }
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err: Error, user: Express.User | false) => {
    if (err) {
      return res.status(500).json({ error: 'Authentication error' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.logIn(user, (loginErr) => {
      if (loginErr) {
        return res.status(500).json({ error: 'Login failed' });
      }
      return res.json({ message: 'Login successful', user });
    });
  })(req, res, next);
});

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logout successful' });
  });
});

router.get('/profile', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ user: req.user });
});

export { router as authRoutes };