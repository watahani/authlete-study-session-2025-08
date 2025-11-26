import { Authlete } from '@authlete/typescript-sdk';
import { getAuthleteConfig } from './config/authlete-config.js';

type AuthleteContext = {
  authlete: Authlete;
  serviceId: string;
  baseUrl: string;
  serviceAccessToken: string;
};

let cachedContext: AuthleteContext | null = null;

export const getAuthleteContext = (): AuthleteContext => {
  if (!cachedContext) {
    const config = getAuthleteConfig();
    cachedContext = {
      authlete: new Authlete({
        bearer: config.serviceAccessToken,
        serverURL: config.baseUrl
      }),
      serviceId: config.serviceId,
      baseUrl: config.baseUrl,
      serviceAccessToken: config.serviceAccessToken
    };
  }

  return cachedContext;
};
