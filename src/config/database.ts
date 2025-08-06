import mysql from 'mysql2/promise';

interface DatabaseConnection {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export class DatabaseConfig {
  private static connection: mysql.Connection;

  private static getConfig(): DatabaseConnection {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'ticket_sales'
    };
  }

  static async initialize(): Promise<void> {
    try {
      this.connection = await mysql.createConnection(this.getConfig());
      console.log('Database connected successfully');
    } catch (error) {
      console.error('Database connection failed:', error);
      throw error;
    }
  }

  static getConnection(): mysql.Connection {
    if (!this.connection) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.connection;
  }

  static async close(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
    }
  }
}