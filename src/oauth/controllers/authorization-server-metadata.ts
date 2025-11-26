import { Authlete, HTTPClient } from '@authlete/typescript-sdk';
import { Request as ExpressRequest, Response } from 'express';
import { getAuthleteContext } from '../authlete-sdk.js';
import { oauthLogger } from '../../utils/logger.js';

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 * Authlete 3.0 Service Configuration APIを使用してメタデータを取得
 */
export const getAuthorizationServerMetadata = async (req: ExpressRequest, res: Response) => {
  try {
    const { serviceId, serviceAccessToken, baseUrl } = getAuthleteContext();

    let serviceMetadata: unknown;

    const httpClient = new HTTPClient({
      fetcher: async (input, init) => {
        const response = await fetch(input as any, init);
        const requestUrl =
          typeof input === 'string'
            ? input
            : typeof (input as { url?: string }).url === 'string'
              ? (input as { url?: string }).url as string
              : input instanceof URL
                ? input.toString()
                : '';

        if (requestUrl.includes(`/api/${serviceId}/service/configuration`)) {
          try {
            serviceMetadata = await response.clone().json();
          } catch (error) {
            oauthLogger.error('Failed to parse service metadata', error);
          }
        }

        return response;
      }
    });

    const authlete = new Authlete({
      bearer: serviceAccessToken,
      serverURL: baseUrl,
      httpClient
    });

    await authlete.service.getConfiguration({ serviceId });

    if (!serviceMetadata) {
      throw new Error('Authlete Service Configuration API returned no metadata');
    }
    
    res.set('Content-Type', 'application/json');
    res.set('Cache-Control', 'public, max-age=3600'); // 1時間キャッシュ
    res.set('Access-Control-Allow-Origin', '*'); // CORS for discovery
    res.json(serviceMetadata);
    
  } catch (error) {
    oauthLogger.error('Authorization server metadata error', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Unable to generate authorization server metadata'
    });
  }
};
