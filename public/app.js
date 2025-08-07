let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkAuthStatus();
    loadTickets();
});

function setupEventListeners() {
    // ログインボタン
    document.getElementById('login-button').addEventListener('click', login);
    
    // 登録ボタン
    document.getElementById('register-button').addEventListener('click', register);
    
    // ログアウトボタン
    document.getElementById('logout-button').addEventListener('click', logout);
    
    // フォーム切り替えリンク
    document.getElementById('show-register-link').addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterForm();
    });
    
    document.getElementById('show-login-link').addEventListener('click', (e) => {
        e.preventDefault();
        showLoginForm();
    });
    
    // 予約履歴ボタン
    document.getElementById('show-reservations-button').addEventListener('click', showMyReservations);
    
    // チケット一覧に戻るボタン
    document.getElementById('show-tickets-button').addEventListener('click', showTickets);
}

function showMessage(message, type = 'info') {
    const messageDiv = document.getElementById('message');
    messageDiv.innerHTML = `<div class="${type}">${message}</div>`;
    setTimeout(() => {
        messageDiv.innerHTML = '';
    }, 3000);
}

function showLoginForm() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
}

function showRegisterForm() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
}

async function checkAuthStatus() {
    try {
        const response = await fetch('/auth/profile');
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            updateAuthUI(true);
        } else {
            updateAuthUI(false);
        }
    } catch (error) {
        updateAuthUI(false);
    }
}

function updateAuthUI(isAuthenticated) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const userInfo = document.getElementById('user-info');
    
    if (isAuthenticated && currentUser) {
        loginForm.classList.add('hidden');
        registerForm.classList.add('hidden');
        userInfo.classList.remove('hidden');
        document.getElementById('current-user').textContent = currentUser.username;
    } else {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        userInfo.classList.add('hidden');
    }
}

async function register() {
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    
    if (!username || !email || !password) {
        showMessage('すべての項目を入力してください', 'error');
        return;
    }
    
    try {
        const response = await fetch('/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('登録が完了しました。ログインしてください。', 'success');
            showLoginForm();
        } else {
            showMessage(data.error || '登録に失敗しました', 'error');
        }
    } catch (error) {
        showMessage('登録に失敗しました', 'error');
    }
}

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        showMessage('ユーザー名とパスワードを入力してください', 'error');
        return;
    }
    
    try {
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentUser = data.user;
            updateAuthUI(true);
            showMessage('ログインしました', 'success');
            loadTickets(); // ログイン後にチケット一覧を再読み込み
        } else {
            showMessage(data.error || 'ログインに失敗しました', 'error');
        }
    } catch (error) {
        showMessage('ログインに失敗しました', 'error');
    }
}

async function logout() {
    try {
        const response = await fetch('/auth/logout', { method: 'POST' });
        
        if (response.ok) {
            currentUser = null;
            updateAuthUI(false);
            showMessage('ログアウトしました', 'success');
            showTickets();
        }
    } catch (error) {
        showMessage('ログアウトに失敗しました', 'error');
    }
}

async function loadTickets() {
    try {
        const response = await fetch('/api/tickets');
        const tickets = await response.json();
        
        const ticketsList = document.getElementById('tickets-list');
        ticketsList.innerHTML = tickets.map(ticket => `
            <div class="ticket-card">
                <h3>${ticket.title}</h3>
                <p>${ticket.description}</p>
                <p class="ticket-price">¥${ticket.price.toLocaleString()}</p>
                <p>空席: ${ticket.available_seats} / ${ticket.total_seats}</p>
                <p>開催日時: ${new Date(ticket.event_date).toLocaleString('ja-JP')}</p>
                ${currentUser ? `
                    <input type="number" id="seats-${ticket.id}" min="1" max="${ticket.available_seats}" value="1" style="width: 60px;">
                    <button class="button reserve-button" data-ticket-id="${ticket.id}" ${ticket.available_seats === 0 ? 'disabled' : ''}>
                        ${ticket.available_seats === 0 ? '完売' : '予約する'}
                    </button>
                ` : '<p>予約するにはログインしてください</p>'}
            </div>
        `).join('');
        
        // 予約ボタンにイベントリスナーを追加
        document.querySelectorAll('.reserve-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const ticketId = e.target.getAttribute('data-ticket-id');
                reserveTicket(parseInt(ticketId));
            });
        });
    } catch (error) {
        showMessage('チケット情報の取得に失敗しました', 'error');
    }
}

async function reserveTicket(ticketId) {
    if (!currentUser) {
        showMessage('ログインが必要です', 'error');
        return;
    }
    
    const seats = parseInt(document.getElementById(`seats-${ticketId}`).value);
    if (!seats || seats <= 0) {
        showMessage('正しい座席数を入力してください', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/tickets/${ticketId}/reserve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ seats })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(`${seats}席を予約しました`, 'success');
            loadTickets(); // 更新
        } else {
            showMessage(data.error || '予約に失敗しました', 'error');
        }
    } catch (error) {
        showMessage('予約に失敗しました', 'error');
    }
}

async function showMyReservations() {
    if (!currentUser) {
        showMessage('ログインが必要です', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/my-reservations');
        const reservations = await response.json();
        
        document.getElementById('tickets-section').classList.add('hidden');
        document.getElementById('reservations-section').classList.remove('hidden');
        
        const reservationsList = document.getElementById('reservations-list');
        if (reservations.length === 0) {
            reservationsList.innerHTML = '<p>予約はありません</p>';
        } else {
            reservationsList.innerHTML = reservations.map(reservation => `
                <div class="ticket-card">
                    <h3>${reservation.ticket_title}</h3>
                    <p>予約席数: ${reservation.seats_reserved}席</p>
                    <p>単価: ¥${reservation.ticket_price.toLocaleString()}</p>
                    <p>合計: ¥${(reservation.ticket_price * reservation.seats_reserved).toLocaleString()}</p>
                    <p>開催日時: ${new Date(reservation.event_date).toLocaleString('ja-JP')}</p>
                    <p>予約日時: ${new Date(reservation.reservation_date).toLocaleString('ja-JP')}</p>
                    <button class="button cancel-button" data-reservation-id="${reservation.id}" style="background-color: #dc3545;">
                        予約キャンセル
                    </button>
                </div>
            `).join('');
            
            // キャンセルボタンにイベントリスナーを追加
            document.querySelectorAll('.cancel-button').forEach(button => {
                button.addEventListener('click', (e) => {
                    const reservationId = e.target.getAttribute('data-reservation-id');
                    cancelReservation(parseInt(reservationId));
                });
            });
        }
    } catch (error) {
        showMessage('予約履歴の取得に失敗しました', 'error');
    }
}

async function cancelReservation(reservationId) {
    if (!confirm('本当に予約をキャンセルしますか？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/reservations/${reservationId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('予約をキャンセルしました', 'success');
            showMyReservations(); // 更新
        } else {
            showMessage(data.error || 'キャンセルに失敗しました', 'error');
        }
    } catch (error) {
        showMessage('キャンセルに失敗しました', 'error');
    }
}

function showTickets() {
    document.getElementById('tickets-section').classList.remove('hidden');
    document.getElementById('reservations-section').classList.add('hidden');
    loadTickets();
}