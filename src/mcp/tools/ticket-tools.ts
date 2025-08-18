/**
 * チケット関連ツールの実装
 */

import { TicketRepository, TicketSearchOptions, ReservationOptions } from '../data/ticket-repository.js';
import { ToolResult, TicketToolArguments } from '../types/mcp-types.js';
import { Ticket, ReservationWithDetails } from '../../types/index.js';
import { AuthenticatedRequest } from '../../oauth/middleware/oauth-middleware.js';

export class TicketTools {
  private static ticketRepository = new TicketRepository();
  
  /**
   * チケット一覧取得ツール
   */
  static async listTickets(args: TicketToolArguments, _oauthInfo?: AuthenticatedRequest['oauth']): Promise<ToolResult> {
    try {
      const limit = args.limit || 10;
      const tickets = await this.ticketRepository.getAllTickets();
      
      // limit を適用
      const limitedTickets = tickets.slice(0, limit);
      
      const ticketList = limitedTickets.map(ticket => 
        `ID: ${ticket.id} | タイトル: ${ticket.title} | 価格: ¥${ticket.price.toLocaleString()} | 空席: ${ticket.available_seats}/${ticket.total_seats} | 日時: ${ticket.event_date.toISOString()}`
      ).join('\n');

      return {
        content: [
          {
            type: "text",
            text: `利用可能なチケット (${limitedTickets.length}件):\n\n${ticketList}`
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: "text",
            text: `チケット一覧取得エラー: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * チケット検索ツール
   */
  static async searchTickets(args: TicketToolArguments, _oauthInfo?: AuthenticatedRequest['oauth']): Promise<ToolResult> {
    try {
      const searchOptions: TicketSearchOptions = {
        maxPrice: args.max_price,
        availableSeatsMin: args.min_available_seats,
        limit: args.limit || 50,
        sortBy: 'event_date',
        sortOrder: 'asc'
      };

      let filteredTickets = await this.ticketRepository.searchTickets(searchOptions);
      
      // タイトル検索（repositoryで実装されていないため、ここで追加フィルタリング）
      if (args.title) {
        filteredTickets = filteredTickets.filter((ticket: Ticket) => 
          ticket.title.toLowerCase().includes(args.title!.toLowerCase())
        );
      }

      if (filteredTickets.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "検索条件に一致するチケットが見つかりませんでした。"
            }
          ]
        };
      }

      const ticketList = filteredTickets.map(ticket => 
        `ID: ${ticket.id} | タイトル: ${ticket.title} | 価格: ¥${ticket.price.toLocaleString()} | 空席: ${ticket.available_seats}/${ticket.total_seats} | 日時: ${ticket.event_date.toISOString()}`
      ).join('\n');

      const filterInfo = [];
      if (args.title) filterInfo.push(`タイトル: "${args.title}"`);
      if (args.max_price !== undefined) filterInfo.push(`最大価格: ¥${args.max_price.toLocaleString()}`);
      if (args.min_available_seats !== undefined) filterInfo.push(`最小席数: ${args.min_available_seats}`);
      
      const filterText = filterInfo.length > 0 ? `検索条件: ${filterInfo.join(', ')}\n\n` : '';

      return {
        content: [
          {
            type: "text",
            text: `${filterText}検索結果 (${filteredTickets.length}件):\n\n${ticketList}`
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: "text",
            text: `チケット検索エラー: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * チケット予約ツール
   */
  static async reserveTicket(args: TicketToolArguments, oauthInfo?: AuthenticatedRequest['oauth']): Promise<ToolResult> {
    try {
      if (!oauthInfo?.subject) {
        return {
          content: [
            {
              type: "text",
              text: "チケット予約にはアクセストークンによる認証が必要です。"
            }
          ],
          isError: true
        };
      }

      if (!args.ticket_id || !args.seats) {
        return {
          content: [
            {
              type: "text",
              text: "ticket_id と seats パラメータが必要です。"
            }
          ],
          isError: true
        };
      }

      // チケット情報を確認
      const ticket = await this.ticketRepository.getTicketById(args.ticket_id);
      if (!ticket) {
        return {
          content: [
            {
              type: "text",
              text: `チケット ID ${args.ticket_id} は存在しません。`
            }
          ],
          isError: true
        };
      }

      // 予約実行
      const userId = parseInt(oauthInfo.subject);
      if (isNaN(userId)) {
        return {
          content: [
            {
              type: "text",
              text: "無効なユーザー ID です。"
            }
          ],
          isError: true
        };
      }

      const reservationOptions: ReservationOptions = {
        userId: userId,
        ticketId: args.ticket_id,
        seats: args.seats
      };
      const reservation = await this.ticketRepository.reserveTicket(reservationOptions);

      return {
        content: [
          {
            type: "text",
            text: `チケット予約が完了しました。\n\n` +
                  `予約ID: ${reservation.id}\n` +
                  `チケット: ${ticket.title}\n` +
                  `予約席数: ${args.seats}席\n` +
                  `予約日時: ${reservation.reservation_date.toISOString()}\n` +
                  `合計金額: ¥${(ticket.price * args.seats).toLocaleString()}`
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: "text",
            text: `チケット予約エラー: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * 予約キャンセルツール
   */
  static async cancelReservation(args: TicketToolArguments, oauthInfo?: AuthenticatedRequest['oauth']): Promise<ToolResult> {
    try {
      if (!oauthInfo?.subject) {
        return {
          content: [
            {
              type: "text",
              text: "予約キャンセルにはアクセストークンによる認証が必要です。"
            }
          ],
          isError: true
        };
      }

      if (!args.reservation_id) {
        return {
          content: [
            {
              type: "text",
              text: "reservation_id パラメータが必要です。"
            }
          ],
          isError: true
        };
      }

      const userId = parseInt(oauthInfo.subject);
      if (isNaN(userId)) {
        return {
          content: [
            {
              type: "text",
              text: "無効なユーザー ID です。"
            }
          ],
          isError: true
        };
      }

      await this.ticketRepository.cancelReservation(args.reservation_id, userId);

      return {
        content: [
          {
            type: "text",
            text: `予約 ID ${args.reservation_id} のキャンセルが完了しました。`
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: "text",
            text: `予約キャンセルエラー: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * ユーザー予約履歴取得ツール
   */
  static async getUserReservations(_args: TicketToolArguments, oauthInfo?: AuthenticatedRequest['oauth']): Promise<ToolResult> {
    try {
      if (!oauthInfo?.subject) {
        return {
          content: [
            {
              type: "text",
              text: "予約履歴の取得にはアクセストークンによる認証が必要です。"
            }
          ],
          isError: true
        };
      }

      const userId = parseInt(oauthInfo.subject);
      if (isNaN(userId)) {
        return {
          content: [
            {
              type: "text",
              text: "無効なユーザー ID です。"
            }
          ],
          isError: true
        };
      }

      const reservations = await this.ticketRepository.getUserReservations(userId);

      if (reservations.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "予約履歴がありません。"
            }
          ]
        };
      }

      const reservationList = reservations.map((reservation: ReservationWithDetails) => 
        `予約ID: ${reservation.id} | チケット: ${reservation.ticket_title} | ` +
        `席数: ${reservation.seats_reserved}席 | 金額: ¥${(reservation.ticket_price * reservation.seats_reserved).toLocaleString()} | ` +
        `予約日: ${reservation.reservation_date.toISOString()} | イベント日: ${reservation.event_date.toISOString()} | ` +
        `ステータス: ${reservation.status}`
      ).join('\n\n');

      return {
        content: [
          {
            type: "text",
            text: `ユーザー ${oauthInfo.subject} の予約履歴 (${reservations.length}件):\n\n${reservationList}`
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: "text",
            text: `予約履歴取得エラー: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  }
}