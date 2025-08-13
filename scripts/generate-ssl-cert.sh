#!/bin/bash

# SSL証明書生成スクリプト
# Self-signed証明書をlocalhost用に生成

CERT_DIR="ssl"
DAYS=365

echo "Self-signed SSL証明書を生成中..."

# sslディレクトリが存在しない場合は作成
if [ ! -d "$CERT_DIR" ]; then
    mkdir -p "$CERT_DIR"
fi

# 既存の証明書ファイルをバックアップ
if [ -f "$CERT_DIR/localhost.key" ] || [ -f "$CERT_DIR/localhost.crt" ]; then
    echo "既存の証明書ファイルをバックアップ中..."
    timestamp=$(date +%Y%m%d_%H%M%S)
    [ -f "$CERT_DIR/localhost.key" ] && mv "$CERT_DIR/localhost.key" "$CERT_DIR/localhost.key.backup_$timestamp"
    [ -f "$CERT_DIR/localhost.crt" ] && mv "$CERT_DIR/localhost.crt" "$CERT_DIR/localhost.crt.backup_$timestamp"
fi

# OpenSSL設定ファイルを作成
cat > "$CERT_DIR/localhost.conf" << EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
req_extensions = v3_req

[dn]
C=JP
ST=Tokyo
L=Tokyo
O=Authlete Study Session
OU=Development
CN=localhost

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

# 秘密鍵を生成
echo "秘密鍵を生成中..."
openssl genrsa -out "$CERT_DIR/localhost.key" 2048

# 証明書を生成
echo "証明書を生成中..."
openssl req -new -x509 -key "$CERT_DIR/localhost.key" -out "$CERT_DIR/localhost.crt" -days $DAYS -config "$CERT_DIR/localhost.conf" -extensions v3_req

# ファイル権限を設定
chmod 600 "$CERT_DIR/localhost.key"
chmod 644 "$CERT_DIR/localhost.crt"

echo ""
echo "✅ SSL証明書が正常に生成されました！"
echo "📁 証明書の場所:"
echo "   秘密鍵: $CERT_DIR/localhost.key"
echo "   証明書: $CERT_DIR/localhost.crt"
echo ""
echo "⚠️  この証明書はself-signedのため、ブラウザで警告が表示されます。"
echo "開発環境では安全に「詳細設定」→「localhost にアクセスする（安全ではありません）」を選択してください。"
echo ""
echo "🔧 証明書の有効期限: $DAYS 日"

# 証明書情報を表示
echo ""
echo "📋 証明書の詳細情報:"
openssl x509 -in "$CERT_DIR/localhost.crt" -text -noout | grep -A 1 "Subject:" || true
openssl x509 -in "$CERT_DIR/localhost.crt" -text -noout | grep -A 10 "Subject Alternative Name:" || true