import bcrypt from 'bcryptjs';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { MockDatabaseConfig as DatabaseConfig } from '../config/mock-database.js';
import { User, UserWithPassword, CreateUserRequest } from '../types/index.js';

interface ResultSetHeader {
  insertId: number;
  affectedRows?: number;
}

export class AuthService {
  static async register(userData: CreateUserRequest): Promise<User> {
    const { username, password, email } = userData;
    
    const connection = DatabaseConfig.getConnection();
    
    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    
    if ((existingUsers as unknown[]).length > 0) {
      throw new Error('Username or email already exists');
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const [result] = await connection.execute(
      'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
      [username, hashedPassword, email]
    );
    
    const insertId = (result as ResultSetHeader).insertId;
    
    const [users] = await connection.execute(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [insertId]
    );
    
    return (users as User[])[0];
  }
  
  static async findByUsername(username: string): Promise<UserWithPassword | null> {
    const connection = DatabaseConfig.getConnection();
    
    const [users] = await connection.execute(
      'SELECT id, username, password, email, created_at FROM users WHERE username = ?',
      [username]
    );
    
    const userArray = users as UserWithPassword[];
    return userArray.length > 0 ? userArray[0] : null;
  }
  
  static async findById(id: number): Promise<User | null> {
    const connection = DatabaseConfig.getConnection();
    
    const [users] = await connection.execute(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [id]
    );
    
    const userArray = users as User[];
    return userArray.length > 0 ? userArray[0] : null;
  }
  
  static async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }
  
  static initializePassport(): void {
    passport.use(new LocalStrategy(
      async (username: string, password: string, done) => {
        try {
          const user = await AuthService.findByUsername(username);
          if (!user) {
            return done(null, false);
          }
          
          const isValidPassword = await AuthService.verifyPassword(password, user.password);
          if (!isValidPassword) {
            return done(null, false);
          }
          
          const userWithoutPassword: User = {
            id: user.id,
            username: user.username,
            email: user.email,
            created_at: user.created_at
          };
          
          return done(null, userWithoutPassword);
        } catch (error) {
          return done(error);
        }
      }
    ));
    
    passport.serializeUser((user: Express.User, done) => {
      done(null, (user as User).id);
    });
    
    passport.deserializeUser(async (id: number, done) => {
      try {
        const user = await AuthService.findById(id);
        done(null, user);
      } catch (error) {
        done(error);
      }
    });
  }
}