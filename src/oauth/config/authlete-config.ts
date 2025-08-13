export interface AuthleteConfig {
  serviceAccessToken: string;
  baseUrl: string;
  serviceId: string;
}

export const getAuthleteConfig = (): AuthleteConfig => {
  const serviceAccessToken = process.env.AUTHLETE_SERVICE_ACCESS_TOKEN;
  const baseUrl = process.env.AUTHLETE_BASE_URL || 'https://api.authlete.com';
  const serviceId = process.env.AUTHLETE_SERVICE_ID;

  if (!serviceAccessToken) {
    throw new Error('AUTHLETE_SERVICE_ACCESS_TOKEN environment variable is required');
  }
  if (!serviceId) {
    throw new Error('AUTHLETE_SERVICE_ID environment variable is required');
  }

  return {
    serviceAccessToken,
    baseUrl,
    serviceId
  };
};