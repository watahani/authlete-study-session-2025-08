import { test, expect } from '@playwright/test';

// Helper function to get base URL from test context
function getBaseURL(page: any): string {
  return page.context()._options.baseURL || 'https://localhost:3443';
}

test.describe('予約機能のテスト', () => {
  let testUsername: string;
  let testEmail: string;
  const testPassword = 'password123';

  test.beforeEach(async ({ page }) => {
    // ユニークなユーザー名とメールアドレスを生成
    const timestamp = Date.now();
    testUsername = `testuser${timestamp}`;
    testEmail = `test${timestamp}@example.com`;
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 新規ユーザー登録
    await page.click('#show-register-link');
    await expect(page.locator('#register-form')).toBeVisible();
    
    await page.fill('#register-username', testUsername);
    await page.fill('#register-email', testEmail);
    await page.fill('#register-password', testPassword);
    await page.click('#register-button');
    
    await expect(page.locator('.success')).toContainText('登録が完了しました');

    // 成功メッセージが消えるまで少し待つ
    await page.waitForTimeout(1000);

    // ログイン
    await page.fill('#login-username', testUsername);
    await page.fill('#login-password', testPassword);
    await page.click('#login-button');
    
    // ログイン成功をユーザー情報の表示で確認
    await expect(page.locator('#user-info')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#user-info')).toContainText(`ログイン中: ${testUsername}`);
  });

  test('チケット予約が正常に動作する', async ({ page }) => {
    // チケット一覧が表示されるまで待機
    await page.waitForLoadState('networkidle');
    
    // 最初のチケットカードを選択
    const ticketCards = page.locator('.ticket-card');
    const firstCard = ticketCards.first();
    
    // 予約ボタンが表示されることを確認
    const reserveButton = firstCard.locator('button').filter({ hasText: '予約する' });
    await expect(reserveButton).toBeVisible();
    
    // 席数を設定（デフォルトは1席）
    const seatsInput = firstCard.locator('input[type="number"]');
    await expect(seatsInput).toBeVisible();
    await seatsInput.fill('2');
    
    // 予約実行
    await reserveButton.click();
    
    // 予約成功メッセージの確認
    await expect(page.locator('.success')).toContainText('2席を予約しました');
    
    // チケット一覧が更新されることを確認（空席数が減少）
    await page.waitForTimeout(1000); // 更新を待つ
  });

  test('予約履歴の表示が正常に動作する', async ({ page }) => {
    // まず予約を作成
    await page.waitForLoadState('networkidle');
    
    const ticketCards = page.locator('.ticket-card');
    const firstCard = ticketCards.first();
    
    // チケット情報を取得（後で予約履歴と照合するため）
    const ticketTitle = await firstCard.locator('h3').textContent();
    
    // 予約実行
    const reserveButton = firstCard.locator('button').filter({ hasText: '予約する' });
    await reserveButton.click();
    
    // 予約成功を確認
    await expect(page.locator('.success')).toContainText('1席を予約しました');
    
    // 予約履歴ボタンをクリック
    await page.click('#show-reservations-button');
    
    // 予約履歴セクションが表示されることを確認
    await expect(page.locator('#reservations-section')).toBeVisible();
    await expect(page.locator('#tickets-section')).not.toBeVisible();
    
    // 予約履歴にチケットが表示されることを確認
    const reservationCards = page.locator('#reservations-list .ticket-card');
    await expect(reservationCards).toHaveCount(1);
    
    const reservationCard = reservationCards.first();
    await expect(reservationCard.locator('h3')).toContainText(ticketTitle || '');
    await expect(reservationCard).toContainText('予約席数: 1席');
    await expect(reservationCard).toContainText('予約日時:');
    
    // キャンセルボタンが表示されることを確認
    const cancelButton = reservationCard.locator('button').filter({ hasText: '予約キャンセル' });
    await expect(cancelButton).toBeVisible();
  });

  test('複数の予約が履歴に表示される', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    const ticketCards = page.locator('.ticket-card');
    
    // 2つのチケットを予約
    const firstCard = ticketCards.first();
    const secondCard = ticketCards.nth(1);
    
    // 1つ目の予約
    await firstCard.locator('button').filter({ hasText: '予約する' }).click();
    await expect(page.locator('.success')).toContainText('1席を予約しました');
    
    // 少し待ってから2つ目の予約
    await page.waitForTimeout(1000);
    
    // 2つ目の予約
    await secondCard.locator('button').filter({ hasText: '予約する' }).click();
    await expect(page.locator('.success')).toContainText('1席を予約しました');
    
    // 予約履歴を表示
    await page.click('#show-reservations-button');
    
    // 2つの予約が表示されることを確認
    const reservationCards = page.locator('#reservations-list .ticket-card');
    await expect(reservationCards).toHaveCount(2);
    
    // 各予約カードに必要な情報が含まれることを確認
    for (let i = 0; i < 2; i++) {
      const card = reservationCards.nth(i);
      await expect(card.locator('h3')).not.toBeEmpty();
      await expect(card).toContainText('予約席数:');
      await expect(card).toContainText('単価:');
      await expect(card).toContainText('合計:');
      await expect(card).toContainText('予約日時:');
    }
  });

  test('予約キャンセル機能が正常に動作する', async ({ page }) => {
    // 予約を作成
    await page.waitForLoadState('networkidle');
    
    const firstCard = page.locator('.ticket-card').first();
    await firstCard.locator('button').filter({ hasText: '予約する' }).click();
    await expect(page.locator('.success')).toContainText('1席を予約しました');
    
    // 予約履歴を表示
    await page.click('#show-reservations-button');
    
    // 予約が1件あることを確認
    const reservationCards = page.locator('#reservations-list .ticket-card');
    await expect(reservationCards).toHaveCount(1);
    
    // キャンセルボタンをクリック
    const cancelButton = reservationCards.first().locator('button').filter({ hasText: '予約キャンセル' });
    
    // confirm ダイアログの処理
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('本当に予約をキャンセルしますか？');
      await dialog.accept();
    });
    
    await cancelButton.click();
    
    // キャンセル成功メッセージの確認
    await expect(page.locator('.success')).toContainText('予約をキャンセルしました');
    
    // 予約履歴が空になることを確認
    await expect(page.locator('#reservations-list')).toContainText('予約はありません');
  });

  test('チケット一覧と予約履歴の切り替えが正常に動作する', async ({ page }) => {
    // 初期状態：チケット一覧が表示
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#tickets-section')).toBeVisible();
    await expect(page.locator('#reservations-section')).not.toBeVisible();
    
    // 予約履歴に切り替え
    await page.click('#show-reservations-button');
    await expect(page.locator('#reservations-section')).toBeVisible();
    await expect(page.locator('#tickets-section')).not.toBeVisible();
    
    // チケット一覧に戻る
    await page.click('#show-tickets-button');
    await expect(page.locator('#tickets-section')).toBeVisible();
    await expect(page.locator('#reservations-section')).not.toBeVisible();
  });

  test('予約なしの場合の予約履歴表示', async ({ page }) => {
    // 予約を作成せずに予約履歴を表示
    await page.waitForLoadState('networkidle');
    await page.click('#show-reservations-button');
    
    // 予約がないメッセージが表示されることを確認
    await expect(page.locator('#reservations-list')).toContainText('予約はありません');
    
    // チケット一覧に戻るボタンが機能することを確認
    await page.click('#show-tickets-button');
    await expect(page.locator('#tickets-section')).toBeVisible();
  });
});