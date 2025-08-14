import { Request, Response } from 'express';
import { AuthleteClient, createAuthleteClient } from '../authlete/client.js';
import { getAuthleteConfig } from '../config/authlete-config.js';

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 * Authlete 3.0 Service Configuration APIを使用してメタデータを取得
 */
export const getAuthorizationServerMetadata = async (req: Request, res: Response) => {
  try {
    const authleteConfig = getAuthleteConfig();
    const client = createAuthleteClient(authleteConfig);

    // Authlete Service Configuration APIを呼び出し
    // このAPIは成功時にHTTP 200で直接OpenID Provider Metadataを返す
    const serviceMetadata = await client.callServiceConfigurationApi();
    
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // Authlete から取得したメタデータにMCP向けスコープを追加
    const extendedMetadata = {
      ...serviceMetadata,
    };

    res.set('Content-Type', 'application/json');
    res.set('Cache-Control', 'public, max-age=3600'); // 1時間キャッシュ
    res.set('Access-Control-Allow-Origin', '*'); // CORS for discovery
    res.json(extendedMetadata);
    
  } catch (error) {
    console.error('Authorization server metadata error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Unable to generate authorization server metadata'
    });
  }
};