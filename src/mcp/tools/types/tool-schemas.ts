/**
 * ツールのスキーマ定義
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const listTicketsToolSchema: Tool = {
  name: "list_tickets",
  description: "利用可能なチケットの一覧を取得",
  inputSchema: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "取得上限（オプション）",
        minimum: 1,
        maximum: 100
      }
    }
  }
};

export const searchTicketsToolSchema: Tool = {
  name: "search_tickets", 
  description: "条件を指定してチケットを検索",
  inputSchema: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "タイトル部分一致（オプション）"
      },
      max_price: {
        type: "number",
        description: "最大価格（オプション）",
        minimum: 0
      },
      min_available_seats: {
        type: "number",
        description: "最小席数（オプション）",
        minimum: 1
      }
    }
  }
};

export const reserveTicketToolSchema: Tool = {
  name: "reserve_ticket",
  description: "指定されたチケットを予約",
  inputSchema: {
    type: "object",
    properties: {
      ticket_id: {
        type: "number",
        description: "チケットID"
      },
      seats: {
        type: "number",
        description: "予約席数",
        minimum: 1
      }
    },
    required: ["ticket_id", "seats"]
  }
};

export const cancelReservationToolSchema: Tool = {
  name: "cancel_reservation",
  description: "予約をキャンセル", 
  inputSchema: {
    type: "object",
    properties: {
      reservation_id: {
        type: "number",
        description: "予約ID"
      }
    },
    required: ["reservation_id"]
  }
};

export const getUserReservationsToolSchema: Tool = {
  name: "get_user_reservations",
  description: "ユーザーの予約履歴を取得",
  inputSchema: {
    type: "object",
    properties: {}
  }
};