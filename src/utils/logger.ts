/**
 * ログレベル定義
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

/**
 * ログ設定
 */
interface LoggerConfig {
  level: LogLevel;
  enableColors: boolean;
  enableTimestamp: boolean;
  context?: string;
}

/**
 * ログ色設定
 */
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

/**
 * 統一ロガークラス
 */
export class Logger {
  private config: LoggerConfig;

  constructor(context?: string, config?: Partial<LoggerConfig>) {
    // 環境変数からログレベルを取得
    const envLogLevel = this.parseLogLevel(process.env.LOG_LEVEL || 'info');
    
    this.config = {
      level: envLogLevel,
      enableColors: process.env.NODE_ENV !== 'production' && process.stdout.isTTY,
      enableTimestamp: true,
      context,
      ...config
    };
  }

  /**
   * 環境変数からログレベルをパース
   */
  private parseLogLevel(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      case 'trace': return LogLevel.TRACE;
      default: return LogLevel.INFO;
    }
  }

  /**
   * ログレベルの文字列表現
   */
  private getLevelString(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR: return 'ERROR';
      case LogLevel.WARN: return 'WARN';
      case LogLevel.INFO: return 'INFO';
      case LogLevel.DEBUG: return 'DEBUG';
      case LogLevel.TRACE: return 'TRACE';
      default: return 'INFO';
    }
  }

  /**
   * レベルに応じた色を取得
   */
  private getLevelColor(level: LogLevel): string {
    if (!this.config.enableColors) return '';
    
    switch (level) {
      case LogLevel.ERROR: return COLORS.red;
      case LogLevel.WARN: return COLORS.yellow;
      case LogLevel.INFO: return COLORS.blue;
      case LogLevel.DEBUG: return COLORS.green;
      case LogLevel.TRACE: return COLORS.cyan;
      default: return '';
    }
  }

  /**
   * ログメッセージをフォーマット
   */
  private formatMessage(level: LogLevel, message: string, data?: any): string {
    let formattedMessage = '';

    // タイムスタンプ
    if (this.config.enableTimestamp) {
      const timestamp = new Date().toISOString();
      formattedMessage += this.config.enableColors 
        ? `${COLORS.gray}${timestamp}${COLORS.reset} `
        : `${timestamp} `;
    }

    // ログレベル
    const levelStr = this.getLevelString(level);
    const levelColor = this.getLevelColor(level);
    formattedMessage += this.config.enableColors
      ? `${levelColor}[${levelStr.padEnd(5)}]${COLORS.reset} `
      : `[${levelStr.padEnd(5)}] `;

    // コンテキスト
    if (this.config.context) {
      formattedMessage += this.config.enableColors
        ? `${COLORS.cyan}[${this.config.context}]${COLORS.reset} `
        : `[${this.config.context}] `;
    }

    // メッセージ
    formattedMessage += message;

    // データがある場合は追加
    if (data !== undefined) {
      if (typeof data === 'object') {
        formattedMessage += '\n' + JSON.stringify(data, null, 2);
      } else {
        formattedMessage += ` ${data}`;
      }
    }

    return formattedMessage;
  }

  /**
   * ログを出力するかどうかの判定
   */
  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level;
  }

  /**
   * ログ出力の共通処理
   */
  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, data);
    
    if (level <= LogLevel.WARN) {
      console.error(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  }

  /**
   * エラーログ
   */
  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * 警告ログ
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * 情報ログ
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * デバッグログ
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * トレースログ
   */
  trace(message: string, data?: any): void {
    this.log(LogLevel.TRACE, message, data);
  }

  /**
   * 子ロガーを作成（コンテキストを追加）
   */
  child(context: string): Logger {
    const childContext = this.config.context 
      ? `${this.config.context}:${context}`
      : context;
    
    return new Logger(childContext, this.config);
  }

  /**
   * ログレベルを一時的に変更
   */
  withLevel(level: LogLevel): Logger {
    return new Logger(this.config.context, { ...this.config, level });
  }
}

/**
 * デフォルトロガーインスタンス
 */
export const logger = new Logger();

/**
 * コンテキスト付きロガーを作成するヘルパー関数
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}

/**
 * テスト用ロガー設定
 */
export function configureTestLogger(): Logger {
  const testLogLevel = process.env.TEST_LOG_LEVEL 
    ? new Logger().parseLogLevel(process.env.TEST_LOG_LEVEL)
    : LogLevel.WARN; // テストではデフォルトでWARN以上のみ

  return new Logger('TEST', {
    level: testLogLevel,
    enableColors: false, // テストでは色を無効
    enableTimestamp: true
  });
}

/**
 * OAuth関連の専用ロガー
 */
export const oauthLogger = createLogger('OAuth');

/**
 * MCP関連の専用ロガー
 */
export const mcpLogger = createLogger('MCP');

/**
 * Authlete関連の専用ロガー
 */
export const authleteLogger = createLogger('Authlete');