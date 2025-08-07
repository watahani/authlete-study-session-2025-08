import { AuthService } from '../../services/AuthService.js';
import { User, CreateUserRequest } from '../../types/index.js';

export interface UserSearchOptions {
  username?: string;
  email?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

export class UserRepository {
  async getUserById(userId: number): Promise<User | null> {
    try {
      return await AuthService.findById(userId);
    } catch (error) {
      throw new Error(`Failed to fetch user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserByUsername(username: string): Promise<User | null> {
    try {
      const userWithPassword = await AuthService.findByUsername(username);
      if (!userWithPassword) return null;
      
      // パスワードを除外してUserタイプとして返す
      return {
        id: userWithPassword.id,
        username: userWithPassword.username,
        email: userWithPassword.email,
        created_at: userWithPassword.created_at
      };
    } catch (error) {
      throw new Error(`Failed to fetch user by username: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createUser(options: CreateUserRequest): Promise<User> {
    try {
      return await AuthService.register(options);
    } catch (error) {
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    try {
      const userWithPassword = await AuthService.findByUsername(username);
      if (!userWithPassword) return null;
      
      const isValid = await AuthService.verifyPassword(password, userWithPassword.password);
      if (!isValid) return null;
      
      // パスワードを除外してUserタイプとして返す
      return {
        id: userWithPassword.id,
        username: userWithPassword.username,
        email: userWithPassword.email,
        created_at: userWithPassword.created_at
      };
    } catch (error) {
      throw new Error(`Failed to validate user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async userExists(username: string, email: string): Promise<boolean> {
    try {
      // この機能はAuthServiceにないため、簡易実装
      // 実際のプロダクトでは適切に実装する必要がある
      return false;
    } catch (error) {
      throw new Error(`Failed to check user existence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchUsers(options: UserSearchOptions): Promise<User[]> {
    // Note: This is a placeholder implementation as the current AuthService
    // doesn't support user listing/searching functionality
    // In a real implementation, this would query the database directly
    throw new Error('User searching is not implemented in the current system');
  }

  async getUserStats(userId: number): Promise<{
    totalReservations: number;
    activeReservations: number;
    totalSpent: number;
  }> {
    // Note: This would be implemented by joining with reservations data
    // For now, returning placeholder data
    return {
      totalReservations: 0,
      activeReservations: 0,
      totalSpent: 0
    };
  }
}