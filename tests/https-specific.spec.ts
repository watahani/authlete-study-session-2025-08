import { test, expect } from '@playwright/test';

// Helper function to get base URL from test context
function getBaseURL(page: any): string {
  return page.context()._options.baseURL || 'https://localhost:3443';
}

test.describe('HTTPS Specific Tests', () => {
  test('HTTPS app health endpoint returns correct protocol', async ({ page }) => {
    const baseURL = getBaseURL(page);
    const response = await page.request.get(`${baseURL}/health`);
    expect(response.status()).toBe(200);
    
    const healthData = await response.json();
    expect(healthData).toHaveProperty('protocol');
    expect(healthData.protocol).toBe('HTTPS');
    expect(healthData.service).toBe('Authlete Study Session Ticket Service');
  });

  test('HTTP to HTTPS redirect works correctly', async ({ page }) => {
    // HTTP経由でアクセスして、HTTPSにリダイレクトされることを確認
    const baseURL = getBaseURL(page);
    const httpURL = baseURL.replace('https:', 'http:').replace('3443', '3000');
    const response = await page.request.get(`${httpURL}/health`, {
      maxRedirects: 0 // リダイレクトを手動で制御
    });
    
    expect(response.status()).toBe(301);
    // リダイレクト先がHTTPS（port 3443）であることを確認
    const location = response.headers()['location'];
    expect(location).toContain('https://localhost:3443');
    expect(location).toContain('/health');
  });

  test('HTTPS security headers are present', async ({ page }) => {
    const baseURL = getBaseURL(page);
    const response = await page.request.get(`${baseURL}/health`);
    expect(response.status()).toBe(200);
    
    const headers = response.headers();
    
    // HSTSヘッダーが設定されているか確認
    expect(headers).toHaveProperty('strict-transport-security');
    expect(headers['strict-transport-security']).toContain('max-age=31536000');
    
    // その他のセキュリティヘッダー
    expect(headers).toHaveProperty('x-content-type-options');
    expect(headers).toHaveProperty('x-frame-options');
    
    // Note: CSPヘッダーは現在無効化されているため確認しない
  });
});