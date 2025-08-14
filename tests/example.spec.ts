import { test, expect } from '@playwright/test';

test.describe('Basic App Tests', () => {
  test('app health endpoint returns correct protocol', async ({ page }) => {
    const response = await page.request.get('/health');
    expect(response.status()).toBe(200);
    
    const healthData = await response.json();
    expect(healthData).toHaveProperty('protocol');
    expect(healthData.protocol).toBe('HTTPS');
    expect(healthData.service).toBe('Authlete Study Session Ticket Service');
  });

  test('HTTPS security headers are present', async ({ page }) => {
    const response = await page.request.get('/health');
    expect(response.status()).toBe(200);
    
    const headers = response.headers();
    
    // HSTSヘッダーが設定されているか確認
    expect(headers).toHaveProperty('strict-transport-security');
    expect(headers['strict-transport-security']).toContain('max-age=31536000');
    
    // その他のセキュリティヘッダー
    expect(headers).toHaveProperty('x-content-type-options');
    expect(headers).toHaveProperty('x-frame-options');
  });
});
