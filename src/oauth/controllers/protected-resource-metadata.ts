import { Request, Response } from 'express';
import { oauthLogger } from '../../utils/logger.js';

/**
 * OAuth 2.0 Protected Resource Metadata (RFC 8414)
 * MCPサーバーがOAuth保護されたリソースであることを宣言するメタデータ
 */
export const getProtectedResourceMetadata = async (req: Request, res: Response) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    const metadata = {
      // Required fields (RFC 8414 Section 5)
      resource: `${baseUrl}/mcp`, // MCPサーバーのリソースURL
      authorization_servers: [baseUrl], // この認可サーバー自身を指定
      
      // Recommended metadata
      scopes_supported: [
        'mcp:tickets:read',
        'mcp:tickets:write'
      ],
      
      // Bearer token methods (RFC 6750, OAuth 2.1 compliant)
      bearer_methods_supported: [
        'header' // Authorization: Bearer <token> only (OAuth 2.1)
      ],
      
      // Documentation and policy (RFC 8414)
      resource_documentation: `${baseUrl}/docs/mcp`,
      resource_policy_uri: `${baseUrl}/policy/mcp`,
      
      // Authorization details type
      authorization_details_types_supported: [
        'ticket-reservation'
      ]
    };

    res.set('Content-Type', 'application/json');
    res.set('Cache-Control', 'public, max-age=3600'); // 1時間キャッシュ
    res.set('Access-Control-Allow-Origin', '*'); // CORS for discovery
    res.json(metadata);
    
  } catch (error) {
    oauthLogger.error('Protected resource metadata error', error);
    res.status(500).json({
      error: 'server_error', 
      error_description: 'Unable to generate protected resource metadata'
    });
  }
};
