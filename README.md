# Mudslide API

WhatsApp mesajlaşma için Mudslide CLI'yi API üzerinden yöneten Node.js servisi.

## Özellikler

- ✅ Tenant ve Branch ID bazlı WhatsApp yönetimi
- ✅ QR kod ile login (base64 formatında)
- ✅ Arka planda çalışan login process'leri
- ✅ Mesaj gönderme
- ✅ Dosya gönderme
- ✅ Login durumu kontrolü
- ✅ Çoklu tenant/branch desteği

## Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. `.env` dosyası oluşturun:
```bash
cp .env.example .env
```

3. `.env` dosyasını düzenleyin:
```env
API_KEY=your-secret-api-key-here
PORT=4000
```

4. Server'ı başlatın:
```bash
npm start
```

veya development mode için:
```bash
npm run dev
```

## API Endpoints

### 1. Login - QR Kod Al
```bash
POST /api/whatsapp/login
Headers:
  x-api-key: your-api-key
  Content-Type: application/json
Body:
{
  "tenant": "test-tenant",
  "branchId": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "QR oluşturuldu...",
  "qr": "data:image/png;base64,...",
  "qrCode": "https://...",
  "status": "qr_ready",
  "tenant": "test-tenant",
  "branchId": 1
}
```

### 2. Login Status - Durum Kontrolü
```bash
POST /api/whatsapp/login/status
Headers:
  x-api-key: your-api-key
  Content-Type: application/json
Body:
{
  "tenant": "test-tenant",
  "branchId": 1
}
```

### 3. Cancel Login - Login İptal Et
```bash
POST /api/whatsapp/login/cancel
Headers:
  x-api-key: your-api-key
  Content-Type: application/json
Body:
{
  "tenant": "test-tenant",
  "branchId": 1
}
```

### 4. Send Message - Mesaj Gönder
```bash
POST /api/whatsapp/send
Headers:
  x-api-key: your-api-key
  Content-Type: application/json
Body:
{
  "tenant": "test-tenant",
  "branchId": 1,
  "phone": "905051234567",
  "message": "Merhaba!"
}
```

### 5. Send File - Dosya Gönder
```bash
POST /api/whatsapp/send-file
Headers:
  x-api-key: your-api-key
  Content-Type: application/json
Body:
{
  "tenant": "test-tenant",
  "branchId": 1,
  "phone": "905051234567",
  "filePath": "/path/to/file.pdf",
  "caption": "Optional caption"
}
```

### 6. Logout - Çıkış Yap
```bash
POST /api/whatsapp/logout
Headers:
  x-api-key: your-api-key
  Content-Type: application/json
Body:
{
  "tenant": "test-tenant",
  "branchId": 1
}
```

## Test

### 1. cURL ile Test

```bash
# Login
curl -X POST http://wp-api.nevsync.com/api/whatsapp/login \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"tenant": "test-tenant", "branchId": 1}'

# Status Check
curl -X POST http://wp-api.nevsync.com/api/whatsapp/login/status \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"tenant": "test-tenant", "branchId": 1}'

# Send Message
curl -X POST http://wp-api.nevsync.com/api/whatsapp/send \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key" \
  -d '{"tenant": "test-tenant", "branchId": 1, "phone": "905051234567", "message": "Test mesajı"}'
```

### 2. Test Script ile

```bash
# Script'i çalıştırılabilir yap
chmod +x test-api.sh

# Script'i düzenle (API_KEY'i güncelle)
# Sonra çalıştır
./test-api.sh
```

### 3. VS Code REST Client ile

`test-api.http` dosyasını VS Code'da açın ve REST Client extension'ı ile test edin.

## Klasör Yapısı

```
whatsapp/
  └── {tenant}/
      └── {branchId}/
          └── (mudslide cache files)
```

Her tenant ve branchId için ayrı cache klasörü kullanılır.

## Önemli Notlar

1. **QR Kod Geçerliliği**: Login process'i arka planda çalışmaya devam eder, QR kod okutulana kadar geçerlidir.

2. **Process Yönetimi**: Her tenant-branchId için ayrı process çalışır. Process'ler Map'te saklanır ve durumları kontrol edilebilir.

3. **API Key**: Tüm isteklerde `x-api-key` header'ı gerekli.

4. **Phone Format**: Telefon numaraları ülke kodu ile birlikte gönderilmelidir (örn: 905051234567).

## Geliştirme

```bash
# Development mode (auto-reload)
npm run dev

# Production mode
npm start
```

## Sorun Giderme

1. **QR kod gelmiyor**: Login process'inin çalıştığını kontrol edin. `/login/status` endpoint'i ile durumu kontrol edebilirsiniz.

2. **Mesaj gönderilmiyor**: Login durumunu kontrol edin. Bağlantı kurulmuş olmalı.

3. **Process çalışmıyor**: `whatsapp/` klasörünün yazılabilir olduğundan emin olun.

## Lisans

ISC

