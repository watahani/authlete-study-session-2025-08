import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('チケット販売サービス', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
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
    // 新規登録フォームを表示
    await page.click('a:has-text("新規登録はこちら")');
    
    // 登録フォームに入力
    const timestamp = Date.now();
    await page.fill('#register-username', `testuser${timestamp}`);
    await page.fill('#register-email', `test${timestamp}@example.com`);
    await page.fill('#register-password', 'password123');
    
    // 登録実行
    await page.click('button:has-text("登録")');
    
    // 成功メッセージの確認
    await expect(page.locator('.success')).toContainText('登録が完了しました');
  });

  test('登録からログインまでの一連の流れ', async ({ page }) => {
    const timestamp = Date.now();
    const username = `testuser${timestamp}`;
    const email = `test${timestamp}@example.com`;
    const password = 'password123';

    // 1. 新規登録
    await page.click('a:has-text("新規登録はこちら")');
    await page.fill('#register-username', username);
    await page.fill('#register-email', email);
    await page.fill('#register-password', password);
    await page.click('button:has-text("登録")');
    
    await expect(page.locator('.success')).toContainText('登録が完了しました');

    // 2. ログイン
    await page.fill('#login-username', username);
    await page.fill('#login-password', password);
    await page.click('button:has-text("ログイン")');
    
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
    
    await page.click('a:has-text("新規登録はこちら")');
    await page.fill('#register-username', username);
    await page.fill('#register-email', `test${timestamp}@example.com`);
    await page.fill('#register-password', 'password123');
    await page.click('button:has-text("登録")');
    
    await page.fill('#login-username', username);
    await page.fill('#login-password', 'password123');
    await page.click('button:has-text("ログイン")');
    
    // ログアウト実行
    await page.click('button:has-text("ログアウト")');
    
    // ログアウトの確認
    await expect(page.locator('.success')).toContainText('ログアウトしました');
    await expect(page.locator('#login-form')).toBeVisible();
  });
});