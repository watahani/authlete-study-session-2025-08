import {
  AuthleteApiClient,
  AuthorizationRequest,
  AuthorizationResponse,
  TokenRequest,
  TokenResponse,
  UserinfoRequest,
  UserinfoResponse,
  RevocationRequest,
  RevocationResponse,
  IntrospectionRequest,
  IntrospectionResponse,
  AuthleteError
} from './types/index.js';
import { AuthleteConfig } from '../config/authlete-config.js';

export class AuthleteClient implements AuthleteApiClient {
  private config: AuthleteConfig;

  constructor(config: AuthleteConfig) {
    this.config = config;
  }

  private async makeRequest<T>(
    endpoint: string,
    body: Record<string, unknown> | { [key: string]: unknown }
  ): Promise<T> {
    const url = `${this.config.baseUrl}/api/${this.config.serviceId}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.serviceAccessToken}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const responseData = await response.json();

      if (!response.ok) {
        const error = new Error(
          `Authlete API error: ${response.status} ${response.statusText}`
        ) as AuthleteError;
        error.status = response.status;
        error.response = responseData as { resultCode?: string; resultMessage?: string };
        throw error;
      }

      return responseData as T;
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        throw error;
      }
      
      const authleteError = new Error(
        `Authlete API request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      ) as AuthleteError;
      
      throw authleteError;
    }
  }

  async authorize(request: AuthorizationRequest): Promise<AuthorizationResponse> {
    return this.makeRequest<AuthorizationResponse>('/auth/authorization', request);
  }

  async token(request: TokenRequest): Promise<TokenResponse> {
    return this.makeRequest<TokenResponse>('/auth/token', request);
  }

  async userinfo(request: UserinfoRequest): Promise<UserinfoResponse> {
    return this.makeRequest<UserinfoResponse>('/auth/userinfo', request);
  }

  async revoke(request: RevocationRequest): Promise<RevocationResponse> {
    return this.makeRequest<RevocationResponse>('/auth/revocation', request);
  }

  async introspect(request: IntrospectionRequest): Promise<IntrospectionResponse> {
    return this.makeRequest<IntrospectionResponse>('/auth/introspection', request);
  }

  /**
   * Service Configuration API (GET /api/{serviceId}/service/configuration)
   * OpenID Provider Metadataを直接返すAPI
   */
  async callServiceConfigurationApi(): Promise<any> {
    const url = `${this.config.baseUrl}/api/${this.config.serviceId}/service/configuration`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.serviceAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Authlete Service Configuration API failed: ${response.status} ${errorBody}`);
    }

    // このAPIは成功時に直接OpenID Provider Metadataを返す
    return response.json();
  }
}

export const createAuthleteClient = (config: AuthleteConfig): AuthleteClient => {
  return new AuthleteClient(config);
};