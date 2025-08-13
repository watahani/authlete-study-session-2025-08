import { test, expect } from '@playwright/test';

// Helper function to get base URL from test context
function getBaseURL(page: any): string {
  return page.context()._options.baseURL || 'http://localhost:3000';
}

test.describe('チケット販売サービス', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('ホームページが正常に表示される', async ({ page }) => {
    await expect(page).toHaveTitle(/チケット販売サービス/);
    await expect(page.locator('h1')).toContainText('チケット販売サービス');
  });

  test('チケット一覧が表示される', async ({ page }) => {
    await expect(page.locator('#tickets-section h2')).toContainText('利用可能なチケット');
    await expect(page.locator('.ticket-card')).toHaveCount(3); // サンプルデータは3件
  });

  test('未ログイン時は予約ボタンが表示されない', async ({ page }) => {
    const ticketCards = page.locator('.ticket-card');
    const firstCard = ticketCards.first();
    await expect(firstCard.locator('button')).not.toBeVisible();
    await expect(firstCard).toContainText('予約するにはログインしてください');
  });

  test('ユーザー登録ができる', async ({ page }) => {
    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState('networkidle');
    
    // 新規登録フォームを表示
    await page.click('#show-register-link');
    
    // 登録フォームが表示されるまで待機
    await expect(page.locator('#register-form')).toBeVisible();
    
    // 登録フォームに入力
    const timestamp = Date.now();
    await page.fill('#register-username', `testuser${timestamp}`);
    await page.fill('#register-email', `test${timestamp}@example.com`);
    await page.fill('#register-password', 'password123');
    
    // 登録実行
    await page.click('#register-button');
    
    // 成功メッセージの確認
    await expect(page.locator('.success')).toContainText('登録が完了しました');
  });

  test('登録からログインまでの一連の流れ', async ({ page }) => {
    const timestamp = Date.now();
    const username = `testuser${timestamp}`;
    const email = `test${timestamp}@example.com`;
    const password = 'password123';

    // 1. 新規登録
    await page.waitForLoadState('networkidle');
    await page.click('#show-register-link');
    await expect(page.locator('#register-form')).toBeVisible();
    
    await page.fill('#register-username', username);
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.click('#register-button');
    
    await expect(page.locator('.success')).toContainText('登録が完了しました');

    // 2. ログイン
    await page.fill('#login-username', username);
    await page.fill('#login-password', password);
    await page.click('#login-button');
    
    await expect(page.locator('.success')).toContainText('ログインしました');
    await expect(page.locator('#user-info')).toContainText(`ログイン中: ${username}`);

    // 3. チケット予約機能の確認
    await page.waitForLoadState('networkidle');
    const ticketCards = page.locator('.ticket-card');
    const firstCard = ticketCards.first();
    await expect(firstCard.locator('button').filter({ hasText: '予約する' })).toBeVisible();
  });

  test('ログアウト機能', async ({ page }) => {
    // まずログイン（簡略化のため事前にユーザーが存在すると仮定）
    const timestamp = Date.now();
    const username = `testuser${timestamp}`;
    
    await page.waitForLoadState('networkidle');
    await page.click('#show-register-link');
    await expect(page.locator('#register-form')).toBeVisible();
    
    await page.fill('#register-username', username);
    await page.fill('#register-email', `test${timestamp}@example.com`);
    await page.fill('#register-password', 'password123');
    await page.click('#register-button');
    
    // 登録完了後、ログインフォームに戻る
    await expect(page.locator('.success')).toContainText('登録が完了しました');
    
    await page.fill('#login-username', username);
    await page.fill('#login-password', 'password123');
    await page.click('#login-button');
    
    // ログイン成功確認
    await expect(page.locator('#user-info')).toBeVisible();
    
    // ログアウト実行
    await page.click('#logout-button');
    
    // ログアウトの確認
    await expect(page.locator('.success')).toContainText('ログアウトしました');
    await expect(page.locator('#login-form')).toBeVisible();
  });
});