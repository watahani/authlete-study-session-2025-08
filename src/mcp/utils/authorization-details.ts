/**
 * Authorization Details検証ユーティリティ
 */

import { AuthorizationDetailsElement } from '@authlete/typescript-sdk/models';
import { mcpLogger } from '../../utils/logger.js';

export interface AuthorizationDetailsValidationResult {
  allowed: boolean;
  reason?: string;
  restrictions: {
    maxAmount?: number;
    currency?: string;
  };
}

/**
 * Authorization Detailsをパースして検証結果を返す
 */
export function parseAndValidateAuthorizationDetails(
  authorizationDetailsObj?: { elements: AuthorizationDetailsElement[] }
): AuthorizationDetailsValidationResult {
  const defaultResult: AuthorizationDetailsValidationResult = {
    allowed: true,
    restrictions: {}
  };

  if (!authorizationDetailsObj || !authorizationDetailsObj.elements) {
    // Authorization Detailsがない場合は標準権限
    mcpLogger.debug('No authorization details found, using standard permissions');
    return defaultResult;
  }

  try {
    const authorizationDetails: AuthorizationDetailsElement[] = authorizationDetailsObj.elements;
    
    // チケット予約用のauthorization detailを検索
    const ticketDetail = authorizationDetails.find(
      detail => detail.type === 'ticket-reservation'
    );

    if (!ticketDetail) {
      // チケット予約用のdetailがない場合は標準権限
      mcpLogger.debug('No ticket booking authorization detail found, using standard permissions');
      return defaultResult;
    }

    // 制限情報を抽出（otherFieldsから取得）
    let restrictions = {
      maxAmount: undefined as number | undefined,
      currency: 'JPY' as string
    };

    // otherFieldsからカスタムフィールドを解析
    if (ticketDetail.otherFields) {
      try {
        const otherFields = JSON.parse(ticketDetail.otherFields);
        restrictions.maxAmount = otherFields.maxAmount;
        restrictions.currency = otherFields.currency || 'JPY';
      } catch (error) {
        mcpLogger.error('Failed to parse otherFields from authorization details', {
          otherFields: ticketDetail.otherFields,
          error
        });
      }
    }

    mcpLogger.debug('Parsed authorization details restrictions', restrictions);

    return {
      allowed: true,
      restrictions
    };

  } catch (error) {
    mcpLogger.error('Failed to parse authorization details', { 
      authorizationDetailsObj, 
      error 
    });
    
    return {
      allowed: false,
      reason: 'Invalid authorization details format',
      restrictions: {}
    };
  }
}

/**
 * チケット予約の制限をチェック（金額のみ）
 */
export function validateTicketBooking(
  restrictions: AuthorizationDetailsValidationResult['restrictions'],
  ticketPrice: number,
  ticketSeats: number
): { allowed: boolean; reason?: string } {
  // 最大金額の制限チェック
  if (restrictions.maxAmount !== undefined) {
    const totalAmount = ticketPrice * ticketSeats;
    if (totalAmount > restrictions.maxAmount) {
      return {
        allowed: false,
        reason: `予約金額 ¥${totalAmount.toLocaleString()} が許可された上限 ¥${restrictions.maxAmount.toLocaleString()} を超えています`
      };
    }
  }

  return { allowed: true };
}
