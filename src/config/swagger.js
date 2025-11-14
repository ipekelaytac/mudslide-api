import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Mudslide WhatsApp API',
      version: '1.0.0',
      description: 'WhatsApp mesajlaşma API servisi - Mudslide kullanarak WhatsApp bağlantısı ve mesaj gönderimi',
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: 'http://wp-api.nevsync.com',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API anahtarı header\'da gönderilmelidir',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Hata mesajı',
            },
            message: {
              type: 'string',
              description: 'Detaylı hata açıklaması',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['tenant', 'branchId'],
          properties: {
            tenant: {
              type: 'string',
              description: 'Tenant adı',
              example: 'test-tenant',
            },
            branchId: {
              type: 'number',
              description: 'Branch ID',
              example: 1,
            },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'İşlem başarılı mı',
            },
            message: {
              type: 'string',
              description: 'Yanıt mesajı',
            },
            qrCode: {
              type: 'string',
              description: 'QR kod URL\'si (varsa)',
              nullable: true,
            },
            qrAsciiArt: {
              type: 'string',
              description: 'ASCII art QR kodu',
              nullable: true,
            },
            qrAsciiArtBase64: {
              type: 'string',
              description: 'Base64 kodlanmış ASCII art QR kodu',
              nullable: true,
            },
            status: {
              type: 'string',
              enum: ['waiting', 'qr_ready', 'connected', 'error'],
              description: 'Login durumu',
            },
            tenant: {
              type: 'string',
              description: 'Tenant adı',
            },
            branchId: {
              type: 'number',
              description: 'Branch ID',
            },
            isExisting: {
              type: 'boolean',
              description: 'Mevcut bir process var mı',
            },
            note: {
              type: 'string',
              description: 'Ek notlar',
              nullable: true,
            },
          },
        },
        LoginStatusRequest: {
          type: 'object',
          required: ['tenant', 'branchId'],
          properties: {
            tenant: {
              type: 'string',
              description: 'Tenant adı',
              example: 'test-tenant',
            },
            branchId: {
              type: 'number',
              description: 'Branch ID',
              example: 1,
            },
          },
        },
        LoginStatusResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'İşlem başarılı mı',
            },
            message: {
              type: 'string',
              description: 'Yanıt mesajı',
            },
            status: {
              type: 'string',
              enum: ['waiting', 'qr_ready', 'connected', 'error', 'not_connected'],
              description: 'Login durumu',
            },
            qrCode: {
              type: 'string',
              description: 'QR kod URL\'si (varsa)',
              nullable: true,
            },
            qrAsciiArt: {
              type: 'string',
              description: 'ASCII art QR kodu',
              nullable: true,
            },
            qrAsciiArtBase64: {
              type: 'string',
              description: 'Base64 kodlanmış ASCII art QR kodu',
              nullable: true,
            },
            isRunning: {
              type: 'boolean',
              description: 'Process çalışıyor mu',
            },
            startTime: {
              type: 'number',
              description: 'Process başlangıç zamanı (timestamp)',
              nullable: true,
            },
            output: {
              type: 'string',
              description: 'Process çıktısı',
              nullable: true,
            },
            isFromCache: {
              type: 'boolean',
              description: 'Cache\'den mi alındı',
            },
            tenant: {
              type: 'string',
              description: 'Tenant adı',
            },
            branchId: {
              type: 'number',
              description: 'Branch ID',
            },
            note: {
              type: 'string',
              description: 'Ek notlar',
              nullable: true,
            },
          },
        },
        SendMessageRequest: {
          type: 'object',
          required: ['tenant', 'branchId', 'phone', 'message'],
          properties: {
            tenant: {
              type: 'string',
              description: 'Tenant adı',
              example: 'test-tenant',
            },
            branchId: {
              type: 'number',
              description: 'Branch ID',
              example: 1,
            },
            phone: {
              type: 'string',
              description: 'Alıcı telefon numarası (ülke kodu ile, örn: 905356071820)',
              example: '905356071820',
            },
            message: {
              type: 'string',
              description: 'Gönderilecek mesaj',
              example: 'Merhaba, bu bir test mesajıdır.',
            },
          },
        },
        SendMessageResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Mesaj başarıyla gönderildi mi',
            },
            message: {
              type: 'string',
              description: 'Yanıt mesajı',
            },
            log: {
              type: 'string',
              description: 'İşlem logu',
              nullable: true,
            },
            tenant: {
              type: 'string',
              description: 'Tenant adı',
            },
            branchId: {
              type: 'number',
              description: 'Branch ID',
            },
            note: {
              type: 'string',
              description: 'Ek notlar',
              nullable: true,
            },
            conflict: {
              type: 'boolean',
              description: 'Conflict hatası var mı',
              nullable: true,
            },
            solution: {
              type: 'object',
              description: 'Çözüm adımları (varsa)',
              nullable: true,
              properties: {
                step1: { type: 'string' },
                step2: { type: 'string' },
                step3: { type: 'string' },
              },
            },
          },
        },
        SendFileRequest: {
          type: 'object',
          required: ['tenant', 'branchId', 'phone', 'filePath', 'caption'],
          properties: {
            tenant: {
              type: 'string',
              description: 'Tenant adı',
              example: 'test-tenant',
            },
            branchId: {
              type: 'number',
              description: 'Branch ID',
              example: 1,
            },
            phone: {
              type: 'string',
              description: 'Alıcı telefon numarası (ülke kodu ile, örn: 905356071820)',
              example: '905356071820',
            },
            filePath: {
              type: 'string',
              description: 'Gönderilecek dosyanın yolu',
              example: '/path/to/file.pdf',
            },
            caption: {
              type: 'string',
              description: 'Dosya ile birlikte gönderilecek açıklama mesajı',
              example: 'Bu dosyayı gönderiyorum',
            },
          },
        },
        SendFileResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Dosya başarıyla gönderildi mi',
            },
            message: {
              type: 'string',
              description: 'Yanıt mesajı',
            },
            log: {
              type: 'string',
              description: 'İşlem logu',
              nullable: true,
            },
            tenant: {
              type: 'string',
              description: 'Tenant adı',
            },
            branchId: {
              type: 'number',
              description: 'Branch ID',
            },
            note: {
              type: 'string',
              description: 'Ek notlar',
              nullable: true,
            },
          },
        },
        LogoutRequest: {
          type: 'object',
          required: ['tenant', 'branchId'],
          properties: {
            tenant: {
              type: 'string',
              description: 'Tenant adı',
              example: 'test-tenant',
            },
            branchId: {
              type: 'number',
              description: 'Branch ID',
              example: 1,
            },
          },
        },
        LogoutResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Logout başarılı mı',
            },
            message: {
              type: 'string',
              description: 'Yanıt mesajı',
            },
            log: {
              type: 'string',
              description: 'İşlem logu',
              nullable: true,
            },
          },
        },
        CancelLoginRequest: {
          type: 'object',
          required: ['tenant', 'branchId'],
          properties: {
            tenant: {
              type: 'string',
              description: 'Tenant adı',
              example: 'test-tenant',
            },
            branchId: {
              type: 'number',
              description: 'Branch ID',
              example: 1,
            },
          },
        },
        CancelLoginResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'İptal başarılı mı',
            },
            message: {
              type: 'string',
              description: 'Yanıt mesajı',
            },
            tenant: {
              type: 'string',
              description: 'Tenant adı',
            },
            branchId: {
              type: 'number',
              description: 'Branch ID',
            },
          },
        },
      },
    },
    security: [
      {
        ApiKeyAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;

