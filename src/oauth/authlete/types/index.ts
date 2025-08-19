export interface AuthleteApiClient {
  authorize(request: AuthorizationRequest): Promise<AuthorizationResponse>;
  token(request: TokenRequest): Promise<TokenResponse>;
  userinfo(request: UserinfoRequest): Promise<UserinfoResponse>;
  revoke(request: RevocationRequest): Promise<RevocationResponse>;
  introspect(request: IntrospectionRequest): Promise<IntrospectionResponse>;
}

export interface AuthorizationRequest {
  parameters: string;
  [key: string]: unknown;
}

export interface AuthorizationResponse {
  resultCode: string;
  resultMessage: string;
  action: 'INTERNAL_SERVER_ERROR' | 'BAD_REQUEST' | 'LOCATION' | 'FORM' | 'NO_INTERACTION' | 'INTERACTION';
  client?: {
    clientId: number;
    clientIdAlias?: string;
    clientIdAliasEnabled?: boolean;
    clientName?: string;
    logoUri?: string;
    number?: number;
    authorizationDetailsTypes?: string[];
  };
  display?: string;
  maxAge?: number;
  service?: {
    apiKey: number;
    clientIdAliasEnabled?: boolean;
    number?: number;
    serviceName?: string;
  };
  scopes?: Array<{
    defaultEntry: boolean;
    description: string;
    name: string;
  }>;
  uiLocales?: string[];
  claimsLocales?: string[];
  claims?: string[];
  acrEssential?: boolean;
  clientIdAliasUsed?: boolean;
  acrs?: string[];
  subject?: string;
  loginHint?: string;
  prompts?: string[];
  lowestPrompt?: string;
  requestObjectPayload?: string;
  idTokenClaims?: string;
  userInfoClaims?: string;
  resources?: string[];
  authorizationDetails?: { elements: AuthorizationDetail[] };
  purpose?: string;
  responseContent?: string;
  ticket?: string;
  dynamicScopes?: string[];
  gmAction?: string;
  grantId?: string;
  grant?: {
    [key: string]: unknown;
  };
  grantSubject?: string;
  requestedClaimsForTx?: string[];
  requestedVerifiedClaimsForTx?: string[][];
  transformedClaims?: string;
  clientEntityIdUsed?: boolean;
  claimsAtUserInfo?: string[];
  credentialOfferInfo?: string;
  issuableCredentials?: string;
}

export interface TokenRequest {
  parameters: string;
  clientId?: string;
  clientSecret?: string;
  clientCertificate?: string;
  clientCertificatePath?: string;
  properties?: string;
  dpop?: string;
  htm?: string;
  htu?: string;
  accessToken?: string;
  jwtAtClaims?: string;
  [key: string]: unknown;
}

export interface TokenResponse {
  resultCode: string;
  resultMessage: string;
  action: string;
  responseContent?: string;
  username?: string;
  password?: string;
  ticket?: string;
  accessToken?: string;
  accessTokenExpiresAt?: number;
  accessTokenDuration?: number;
  refreshToken?: string;
  refreshTokenExpiresAt?: number;
  refreshTokenDuration?: number;
  idToken?: string;
  grantType?: string;
  clientId?: number;
  clientIdAlias?: string;
  clientIdAliasUsed?: boolean;
  subject?: string;
  scopes?: string[];
  properties?: Array<{ key: string; value: string }>;
  jwtAccessToken?: string;
  resources?: string[];
  accessTokenResources?: string[];
  authorizationDetails?: { elements: AuthorizationDetail[] };
  serviceAttributes?: Array<{ key: string; value: string }>;
  clientAttributes?: Array<{ key: string; value: string }>;
  clientAuthMethod?: string;
  grantId?: string;
  audiences?: string[];
  requestedTokenType?: string;
  subjectToken?: string;
  subjectTokenType?: string;
  subjectTokenInfo?: string;
  actorToken?: string;
  actorTokenType?: string;
  actorTokenInfo?: {
    [key: string]: unknown;
  };
  assertion?: string;
  previousRefreshTokenUsed?: boolean;
  clientEntityId?: string;
  clientEntityIdUsed?: boolean;
  cnonceDuration?: number;
  dpopNonce?: string;
  cnonce?: string;
  cnonceExpiresAt?: number;
  requestedIdTokenClaims?: string[];
  refreshTokenScopes?: string[];
}

export interface UserinfoRequest {
  token: string;
  dpop?: string;
  htm?: string;
  htu?: string;
  headers?: string;
  message?: string;
  [key: string]: unknown;
}

export interface UserinfoResponse {
  resultCode: string;
  resultMessage: string;
  action: string;
  responseContent?: string;
  token?: string;
  clientId?: number;
  subject?: string;
  scopes?: string[];
  properties?: Array<{ key: string; value: string }>;
  clientEntityId?: string;
  clientEntityIdUsed?: boolean;
}

export interface RevocationRequest {
  parameters: string;
  clientId?: string;
  clientSecret?: string;
  clientCertificate?: string;
  clientCertificatePath?: string;
  [key: string]: unknown;
}

export interface RevocationResponse {
  resultCode: string;
  resultMessage: string;
  action: string;
  responseContent?: string;
}

export interface IntrospectionRequest {
  token: string;
  scopes?: string[];
  subject?: string;
  dpop?: string;
  htm?: string;
  htu?: string;
  [key: string]: unknown;
}

export interface IntrospectionResponse {
  resultCode: string;
  resultMessage: string;
  action: string;
  responseContent?: string;
  active?: boolean;
  token?: string;
  clientId?: number;
  subject?: string;
  scopes?: string[];
  expiresAt?: number;
  properties?: Array<{ key: string; value: string }>;
  clientEntityId?: string;
  clientEntityIdUsed?: boolean;
  accessTokenResources?: string[];
  authorizationDetails?: { elements: AuthorizationDetail[] };
}

export interface AuthleteError extends Error {
  status?: number;
  response?: {
    resultCode?: string;
    resultMessage?: string;
  };
}

// Authorization Details Types
export interface AuthorizationDetail {
  type: string;
  locations?: string[];
  actions?: string[];
  datatypes?: string[];
  identifier?: string;
  privileges?: string[];
  // Authleteスキーマ準拠：カスタムフィールドはotherFieldsにJSON文字列として格納
  otherFields?: string;
}

export interface AuthorizationDetailsRequest {
  authorizationDetails?: AuthorizationDetail[];
}

export interface AuthorizationDetailsResponse {
  authorizationDetails?: AuthorizationDetail[];
}