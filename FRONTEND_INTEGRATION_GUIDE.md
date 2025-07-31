# 🚀 Guia de Integração Frontend - ID Transportes

## 📋 Visão Geral

Este documento fornece todas as informações necessárias para integrar o frontend com as APIs do backend multi-tenant implementadas. Todas as funcionalidades críticas da **Fase 1** foram implementadas e estão prontas para uso.

## ✅ Status das Implementações

### **Fase 1 - IMPLEMENTADA ✅**
- ✅ **Upload e Processamento de Canhotos** - Porta 3004
- ✅ **Rastreamento em Tempo Real** - Porta 3005
- ✅ **Gestão de Ocorrências** - Porta 3003
- ✅ **Relatórios Avançados** - Porta 3006
- ✅ **Dashboard com KPIs** - Porta 3006
- ✅ **Multi-tenancy** - Porta 3007
- ✅ **Gestão de Motoristas e Veículos** - Porta 3002

### **Fase 2 - PENDENTE ⏳**
- ⏳ Sistema de Notificações
- ⏳ Importação XML NF
- ⏳ Funcionalidades Offline
- ⏳ Configurações Avançadas

## 🔐 Autenticação e Autorização

### **Login Multi-tenant**
```javascript
// Login com domínio da empresa
POST http://localhost:3001/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123",
  "company_domain": "idtransportes"
}

// Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 2,
    "username": "admin",
    "user_type": "MASTER",
    "company_id": 1,
    "company_domain": "idtransportes"
  }
}
```

### **Tipos de Usuário**
- `MASTER` - Acesso total ao sistema
- `ADMIN` - Administrador da empresa
- `SUPERVISOR` - Supervisor de entregas
- `DRIVER` - Motorista
- `OPERATOR` - Operador
- `CLIENT` - Cliente

### **Refresh Token**
```javascript
// Renovar token
POST http://localhost:3001/api/auth/refresh
Authorization: Bearer {token}

// Response
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600
}
```

### **Logout**
```javascript
// Logout
POST http://localhost:3001/api/auth/logout
Authorization: Bearer {token}

// Response
{
  "success": true,
  "message": "Logout realizado com sucesso"
}
```

## 📸 1. Upload e Processamento de Canhotos

### **Base URL**: `http://localhost:3004`

#### **Upload de Canhoto**
```javascript
// Upload de arquivo
POST /api/receipts/upload
Content-Type: multipart/form-data
Authorization: Bearer {token}

FormData:
- file: File (JPG, PNG, PDF)
- delivery_id: number
- driver_id: number
- notes: string (opcional)

// Response
{
  "success": true,
  "data": {
    "id": 1,
    "filename": "canhoto-123.jpg",
    "url": "/api/receipts/1/download",
    "processed": false,
    "status": "PENDING"
  }
}
```

#### **Processar OCR**
```javascript
// Processar OCR do canhoto
POST /api/receipts/{id}/process-ocr
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": {
    "ocr_data": {
      "nf_number": "123456",
      "client_name": "João Silva",
      "address": "Rua das Flores, 123",
      "value": 150.50,
      "items": []
    },
    "raw_text": "Texto extraído do OCR..."
  }
}
```

#### **Validar Dados OCR**
```javascript
// Validar dados extraídos
PUT /api/receipts/{id}/validate
Authorization: Bearer {token}
Content-Type: application/json

{
  "ocr_data": {
    "nf_number": "123456",
    "client_name": "João Silva",
    "address": "Rua das Flores, 123",
    "value": 150.50
  },
  "validated": true,
  "corrections": {
    "client_name": "João Silva Santos"
  }
}
```

#### **Listar Canhotos**
```javascript
// Listar canhotos com filtros
GET /api/receipts?delivery_id=1&driver_id=2&status=PROCESSED
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": [
    {
      "id": 1,
      "delivery_id": 1,
      "driver_id": 2,
      "filename": "canhoto-123.jpg",
      "status": "PROCESSED",
      "ocr_data": {...},
      "validated": true,
      "created_at": "2025-07-31T10:00:00Z"
    }
  ]
}
```

## 📍 2. Rastreamento em Tempo Real

### **Base URL**: `http://localhost:3005`

#### **Enviar Localização**
```javascript
// Enviar localização do motorista
POST /api/tracking/location
Authorization: Bearer {token}
Content-Type: application/json

{
  "driver_id": 2,
  "latitude": -23.5505,
  "longitude": -46.6333,
  "accuracy": 10,
  "speed": 50,
  "heading": 90,
  "delivery_id": 1
}

// Response
{
  "success": true,
  "message": "Localização enviada com sucesso"
}
```

#### **Localizações Atuais**
```javascript
// Obter localizações atuais de todos os motoristas
GET /api/tracking/drivers/current-locations
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": [
    {
      "driver_id": 2,
      "driver_name": "João Motorista",
      "latitude": -23.5505,
      "longitude": -46.6333,
      "accuracy": 10,
      "speed": 50,
      "heading": 90,
      "last_update": "2025-07-31T10:00:00Z",
      "status": "active",
      "current_delivery_id": 1,
      "current_delivery_client": "Cliente Teste"
    }
  ]
}
```

#### **Histórico de Rastreamento**
```javascript
// Histórico de posições do motorista
GET /api/tracking/drivers/{driverId}/history?start_date=2025-07-01&end_date=2025-07-31
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-07-31T10:00:00Z",
      "latitude": -23.5505,
      "longitude": -46.6333,
      "accuracy": 10,
      "speed": 50,
      "heading": 90,
      "delivery_id": 1
    }
  ]
}
```

#### **Atualizar Status do Motorista**
```javascript
// Atualizar status do motorista
PUT /api/tracking/drivers/{driverId}/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "busy" // active, inactive, busy, available
}
```

### **WebSocket para Tempo Real**
```javascript
// Conectar ao WebSocket
const ws = new WebSocket('ws://localhost:3005');

// Autenticar conexão
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }));
};

// Receber atualizações
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'location_update':
      console.log('Nova localização:', data);
      // Atualizar mapa
      break;
    case 'driver_status':
      console.log('Status do motorista:', data);
      // Atualizar status
      break;
  }
};
```

## ⚠️ 3. Gestão de Ocorrências

### **Base URL**: `http://localhost:3003`

#### **Registrar Ocorrência**
```javascript
// Registrar ocorrência em uma entrega
POST /api/deliveries/{deliveryId}/occurrence
Authorization: Bearer {token}
Content-Type: multipart/form-data

FormData:
- type: "reentrega" | "recusa" | "avaria"
- description: string
- photo: File (opcional)
- latitude: number (opcional)
- longitude: number (opcional)

// Response
{
  "success": true,
  "data": {
    "id": 1,
    "delivery_id": 1,
    "type": "reentrega",
    "description": "Cliente não estava em casa",
    "photo_url": "/api/occurrences/1/photo",
    "created_at": "2025-07-31T10:00:00Z"
  }
}
```

#### **Listar Ocorrências**
```javascript
// Listar ocorrências com filtros
GET /api/occurrences?type=reentrega&start_date=2025-07-01&end_date=2025-07-31&driver_id=2
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": [
    {
      "id": 1,
      "delivery_id": 1,
      "type": "reentrega",
      "description": "Cliente não estava em casa",
      "photo_url": "/api/occurrences/1/photo",
      "driver_name": "João Motorista",
      "client_name": "Cliente Teste",
      "created_at": "2025-07-31T10:00:00Z"
    }
  ]
}
```

#### **Detalhes da Ocorrência**
```javascript
// Obter detalhes de uma ocorrência
GET /api/occurrences/{id}
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": {
    "id": 1,
    "delivery_id": 1,
    "type": "reentrega",
    "description": "Cliente não estava em casa",
    "photo_url": "/api/occurrences/1/photo",
    "latitude": -23.5505,
    "longitude": -46.6333,
    "driver_name": "João Motorista",
    "client_name": "Cliente Teste",
    "created_at": "2025-07-31T10:00:00Z"
  }
}
```

#### **Foto da Ocorrência**
```javascript
// Obter foto da ocorrência
GET /api/occurrences/{id}/photo
Authorization: Bearer {token}

// Response: Imagem (JPG/PNG)
```

## 📊 4. Relatórios Avançados

### **Base URL**: `http://localhost:3006`

#### **Relatório de Entregas**
```javascript
// Relatório de entregas com filtros
GET /api/reports/deliveries?start_date=2025-07-01&end_date=2025-07-31&driver_id=2&status=DELIVERED
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": {
    "summary": {
      "total": 100,
      "completed": 85,
      "pending": 10,
      "cancelled": 3,
      "refused": 2,
      "avg_delivery_time": 45.5
    },
    "daily_progress": [
      {
        "date": "2025-07-31",
        "total": 15,
        "completed": 12,
        "pending": 3
      }
    ],
    "status_distribution": [
      {
        "status": "DELIVERED",
        "count": 85,
        "percentage": 85.0
      }
    ],
    "driver_performance": [
      {
        "driver_name": "João Motorista",
        "total_deliveries": 25,
        "completed_deliveries": 23,
        "success_rate": 92.0,
        "avg_delivery_time": 42.3
      }
    ]
  }
}
```

#### **Relatório de Desempenho por Motorista**
```javascript
// Relatório de desempenho
GET /api/reports/driver-performance?start_date=2025-07-01&end_date=2025-07-31&driver_id=2
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": [
    {
      "driver_id": 2,
      "driver_name": "João Motorista",
      "total_deliveries": 25,
      "completed_deliveries": 23,
      "success_rate": 92.0,
      "average_time": 42.3,
      "occurrences": 2,
      "occurrence_rate": 8.0,
      "performance_score": 87.5
    }
  ]
}
```

#### **Relatório por Cliente**
```javascript
// Relatório por cliente
GET /api/reports/client-volume?start_date=2025-07-01&end_date=2025-07-31&client_id=1
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": [
    {
      "client_id": 1,
      "client_name": "Cliente Teste",
      "total_deliveries": 15,
      "total_value": 2500.00,
      "average_value": 166.67,
      "completed_deliveries": 14,
      "success_rate": 93.3,
      "growth_rate": 12.5
    }
  ]
}
```

## 📈 5. Dashboard com KPIs

### **KPIs do Dashboard**
```javascript
// KPIs do dashboard
GET /api/dashboard/kpis
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": {
    "today_deliveries": {
      "total": 15,
      "completed": 12,
      "pending": 3
    },
    "active_drivers": 8,
    "pending_occurrences": 2,
    "performance_score": 87.5,
    "revenue_today": 2500.00,
    "efficiency_rate": 80.0
  }
}
```

### **Estatísticas da Empresa**
```javascript
// Estatísticas da empresa
GET /api/dashboard/company-stats
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": {
    "monthly_growth": 15.5,
    "driver_efficiency": 87.3,
    "client_satisfaction": 92.1,
    "revenue_trend": [
      {
        "date": "2025-07-31",
        "revenue": 2500.00
      }
    ],
    "delivery_trend": [
      {
        "date": "2025-07-31",
        "deliveries": 15
      }
    ]
  }
}
```

## 📦 6. Gestão de Entregas

### **Base URL**: `http://localhost:3003`

#### **Listar Entregas**
```javascript
// Listar entregas com filtros
GET /api/deliveries?status=PENDING&driver_id=2&client_id=1
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": [
    {
      "id": 1,
      "nf_number": "NF001",
      "client_name": "Cliente Teste",
      "client_address": "Rua Teste, 123",
      "merchandise_value": 150.00,
      "status": "PENDING",
      "driver_name": "João Motorista",
      "created_at": "2025-07-31T10:00:00Z"
    }
  ]
}
```

#### **Detalhes da Entrega**
```javascript
// Obter detalhes de uma entrega
GET /api/deliveries/{id}
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": {
    "id": 1,
    "nf_number": "NF001",
    "client_name": "Cliente Teste",
    "client_address": "Rua Teste, 123",
    "client_phone": "(11) 99999-9999",
    "merchandise_value": 150.00,
    "status": "PENDING",
    "driver_name": "João Motorista",
    "notes": "Observações da entrega",
    "created_at": "2025-07-31T10:00:00Z",
    "occurrences": [
      {
        "id": 1,
        "type": "reentrega",
        "description": "Cliente não estava em casa",
        "created_at": "2025-07-31T10:00:00Z"
      }
    ]
  }
}
```

#### **Atualizar Status da Entrega**
```javascript
// Atualizar status da entrega
PUT /api/deliveries/{id}/status
Authorization: Bearer {token}
Content-Type: application/json

{
  "status": "DELIVERED", // PENDING, IN_TRANSIT, DELIVERED, CANCELLED, REFUSED
  "notes": "Entrega realizada com sucesso"
}

// Response
{
  "success": true,
  "message": "Status atualizado com sucesso"
}
```

## 🏢 7. Gestão de Empresas

### **Base URL**: `http://localhost:3007`

#### **Listar Empresas (MASTER)**
```javascript
// Listar todas as empresas
GET /api/companies
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "ID Transportes",
      "cnpj": "12.345.678/0001-90",
      "domain": "idtransportes",
      "logo_url": null,
      "primary_color": "#007bff",
      "secondary_color": "#6c757d",
      "email": "contato@idtransportes.com",
      "is_active": true,
      "subscription_plan": "ENTERPRISE",
      "max_users": 10,
      "max_drivers": 5,
      "created_at": "2025-07-31T10:00:00Z"
    }
  ]
}
```

#### **Criar Empresa (MASTER)**
```javascript
// Criar nova empresa
POST /api/companies
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Nova Empresa",
  "cnpj": "98.765.432/0001-10",
  "domain": "novaempresa",
  "email": "contato@novaempresa.com",
  "subscription_plan": "BASIC",
  "max_users": 5,
  "max_drivers": 3
}

// Response
{
  "message": "Empresa criada com sucesso",
  "company_id": 2,
  "admin_credentials": {
    "username": "admin",
    "password": "admin123"
  }
}
```

#### **Estatísticas da Empresa**
```javascript
// Estatísticas da empresa
GET /api/companies/{id}/stats
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": {
    "users": 5,
    "drivers": 3,
    "vehicles": 2,
    "clients": 10,
    "total_deliveries": 150,
    "active_deliveries": 15
  }
}
```

## 👥 8. Gestão de Motoristas e Veículos

### **Base URL**: `http://localhost:3002`

#### **Listar Motoristas**
```javascript
// Listar motoristas com filtros
GET /api/drivers?status=active&vehicle_id=1
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": [
    {
      "id": 2,
      "name": "João Motorista",
      "cpf": "123.456.789-00",
      "cnh": "12345678900",
      "phone": "(11) 99999-9999",
      "email": "joao@idtransportes.com",
      "status": "active",
      "vehicle_id": 1,
      "vehicle_plate": "ABC-1234",
      "vehicle_model": "Fiat Fiorino",
      "created_at": "2025-07-31T10:00:00Z"
    }
  ]
}
```

#### **Criar Motorista**
```javascript
// Criar novo motorista
POST /api/drivers
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Novo Motorista",
  "cpf": "987.654.321-00",
  "cnh": "98765432100",
  "phone": "(11) 88888-8888",
  "email": "novo@idtransportes.com",
  "vehicle_id": 1
}

// Response
{
  "success": true,
  "data": {
    "id": 3,
    "name": "Novo Motorista",
    "cpf": "987.654.321-00",
    "cnh": "98765432100",
    "phone": "(11) 88888-8888",
    "email": "novo@idtransportes.com",
    "status": "active",
    "vehicle_id": 1,
    "created_at": "2025-07-31T10:00:00Z"
  }
}
```

#### **Atualizar Motorista**
```javascript
// Atualizar dados do motorista
PUT /api/drivers/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "João Motorista Atualizado",
  "phone": "(11) 77777-7777",
  "email": "joao.novo@idtransportes.com",
  "status": "inactive"
}

// Response
{
  "success": true,
  "message": "Motorista atualizado com sucesso"
}
```

#### **Detalhes do Motorista**
```javascript
// Obter detalhes do motorista
GET /api/drivers/{id}
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": {
    "id": 2,
    "name": "João Motorista",
    "cpf": "123.456.789-00",
    "cnh": "12345678900",
    "phone": "(11) 99999-9999",
    "email": "joao@idtransportes.com",
    "status": "active",
    "vehicle": {
      "id": 1,
      "plate": "ABC-1234",
      "model": "Fiat Fiorino",
      "year": 2020,
      "color": "Branco"
    },
    "statistics": {
      "total_deliveries": 150,
      "completed_deliveries": 142,
      "success_rate": 94.7,
      "avg_delivery_time": 45.2
    },
    "created_at": "2025-07-31T10:00:00Z"
  }
}
```

#### **Listar Veículos**
```javascript
// Listar veículos
GET /api/vehicles?status=active
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": [
    {
      "id": 1,
      "plate": "ABC-1234",
      "model": "Fiat Fiorino",
      "brand": "Fiat",
      "year": 2020,
      "color": "Branco",
      "status": "active",
      "driver_name": "João Motorista",
      "created_at": "2025-07-31T10:00:00Z"
    }
  ]
}
```

#### **Criar Veículo**
```javascript
// Criar novo veículo
POST /api/vehicles
Authorization: Bearer {token}
Content-Type: application/json

{
  "plate": "XYZ-5678",
  "model": "Renault Kangoo",
  "brand": "Renault",
  "year": 2021,
  "color": "Prata",
  "driver_id": 2
}

// Response
{
  "success": true,
  "data": {
    "id": 2,
    "plate": "XYZ-5678",
    "model": "Renault Kangoo",
    "brand": "Renault",
    "year": 2021,
    "color": "Prata",
    "status": "active",
    "driver_id": 2,
    "created_at": "2025-07-31T10:00:00Z"
  }
}
```

## ⚙️ 9. Configurações de Empresa

### **Base URL**: `http://localhost:3007`

#### **Obter Configurações**
```javascript
// Obter configurações da empresa
GET /api/companies/{id}/settings
Authorization: Bearer {token}

// Response
{
  "success": true,
  "data": {
    "company_id": 1,
    "logo_url": "/uploads/logos/idtransportes-logo.png",
    "primary_color": "#007bff",
    "secondary_color": "#6c757d",
    "company_name": "ID Transportes",
    "address": "Rua das Empresas, 123",
    "phone": "(11) 3333-3333",
    "email": "contato@idtransportes.com",
    "website": "https://idtransportes.com",
    "timezone": "America/Sao_Paulo",
    "currency": "BRL",
    "language": "pt-BR",
    "notifications": {
      "email_notifications": true,
      "sms_notifications": false,
      "push_notifications": true
    },
    "delivery_settings": {
      "max_delivery_time": 120,
      "auto_assign_drivers": true,
      "require_signature": true,
      "require_photo": true
    }
  }
}
```

#### **Atualizar Configurações**
```javascript
// Atualizar configurações
PUT /api/companies/{id}/settings
Authorization: Bearer {token}
Content-Type: application/json

{
  "primary_color": "#28a745",
  "secondary_color": "#ffc107",
  "company_name": "ID Transportes Ltda",
  "phone": "(11) 4444-4444",
  "delivery_settings": {
    "max_delivery_time": 90,
    "auto_assign_drivers": false,
    "require_signature": true,
    "require_photo": false
  }
}

// Response
{
  "success": true,
  "message": "Configurações atualizadas com sucesso"
}
```

#### **Upload de Logo**
```javascript
// Upload de logo da empresa
POST /api/companies/{id}/logo
Authorization: Bearer {token}
Content-Type: multipart/form-data

FormData:
- logo: File (JPG, PNG, SVG)

// Response
{
  "success": true,
  "data": {
    "logo_url": "/uploads/logos/idtransportes-logo-123.png",
    "message": "Logo atualizada com sucesso"
  }
}
```

## 🚨 10. Tratamento de Erros

### **Códigos de Erro Comuns**
```javascript
// Estrutura de erro padrão
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos",
    "details": [
      {
        "field": "email",
        "message": "Email inválido"
      }
    ]
  }
}
```

### **Códigos de Status HTTP**
- `200` - Sucesso
- `201` - Criado com sucesso
- `400` - Dados inválidos
- `401` - Não autorizado
- `403` - Acesso negado
- `404` - Recurso não encontrado
- `422` - Erro de validação
- `500` - Erro interno do servidor

### **Implementação de Interceptor de Erros**
```javascript
// services/api.js
import axios from 'axios';

const api = axios.create({
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para tratamento de erros
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Token expirado - redirecionar para login
          localStorage.removeItem('token');
          window.location.href = '/login';
          break;
          
        case 403:
          // Acesso negado
          showNotification('error', 'Você não tem permissão para esta ação');
          break;
          
        case 422:
          // Erro de validação
          const errors = data.error?.details || [];
          errors.forEach(err => {
            showNotification('error', `${err.field}: ${err.message}`);
          });
          break;
          
        case 500:
          // Erro interno
          showNotification('error', 'Erro interno do servidor. Tente novamente.');
          break;
          
        default:
          showNotification('error', data.error?.message || 'Erro desconhecido');
      }
    } else if (error.request) {
      // Erro de rede
      showNotification('error', 'Erro de conexão. Verifique sua internet.');
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

### **Função de Notificação**
```javascript
// utils/notifications.js
export function showNotification(type, message, duration = 5000) {
  // Implementar com sua biblioteca de notificações preferida
  // Exemplo com toastr ou similar
  if (type === 'success') {
    toastr.success(message);
  } else if (type === 'error') {
    toastr.error(message);
  } else if (type === 'warning') {
    toastr.warning(message);
  } else {
    toastr.info(message);
  }
}
```

## 📱 11. Exemplos de Implementação Avançados

### **Componente de Upload com Preview**
```javascript
// components/FileUpload.vue
<template>
  <div class="file-upload">
    <div class="upload-area" @click="triggerFileInput" @drop="handleDrop" @dragover.prevent>
      <input 
        ref="fileInput" 
        type="file" 
        :accept="accept" 
        @change="handleFileSelect" 
        style="display: none"
      />
      
      <div v-if="!preview" class="upload-placeholder">
        <i class="fas fa-cloud-upload-alt"></i>
        <p>Clique ou arraste arquivos aqui</p>
      </div>
      
      <div v-else class="preview-container">
        <img v-if="isImage" :src="preview" class="preview-image" />
        <div v-else class="file-info">
          <i class="fas fa-file"></i>
          <span>{{ fileName }}</span>
        </div>
        <button @click="removeFile" class="remove-btn">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
    
    <div v-if="uploading" class="upload-progress">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <span>{{ progress }}%</span>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    accept: {
      type: String,
      default: 'image/*'
    },
    maxSize: {
      type: Number,
      default: 5 * 1024 * 1024 // 5MB
    }
  },
  
  data() {
    return {
      file: null,
      preview: null,
      fileName: '',
      uploading: false,
      progress: 0
    };
  },
  
  computed: {
    isImage() {
      return this.file && this.file.type.startsWith('image/');
    }
  },
  
  methods: {
    triggerFileInput() {
      this.$refs.fileInput.click();
    },
    
    handleFileSelect(event) {
      const file = event.target.files[0];
      this.processFile(file);
    },
    
    handleDrop(event) {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      this.processFile(file);
    },
    
    processFile(file) {
      if (!file) return;
      
      // Validar tamanho
      if (file.size > this.maxSize) {
        this.$emit('error', 'Arquivo muito grande. Máximo 5MB.');
        return;
      }
      
      // Validar tipo
      if (!file.type.match(this.accept.replace('*', '.*'))) {
        this.$emit('error', 'Tipo de arquivo não suportado.');
        return;
      }
      
      this.file = file;
      this.fileName = file.name;
      
      // Criar preview
      if (this.isImage) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.preview = e.target.result;
        };
        reader.readAsDataURL(file);
      }
      
      this.$emit('file-selected', file);
    },
    
    removeFile() {
      this.file = null;
      this.preview = null;
      this.fileName = '';
      this.$emit('file-removed');
    },
    
    async uploadFile(uploadUrl, additionalData = {}) {
      if (!this.file) return;
      
      this.uploading = true;
      this.progress = 0;
      
      const formData = new FormData();
      formData.append('file', this.file);
      
      // Adicionar dados adicionais
      Object.keys(additionalData).forEach(key => {
        formData.append(key, additionalData[key]);
      });
      
      try {
        const response = await this.$api.post(uploadUrl, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            this.progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
          }
        });
        
        this.$emit('upload-success', response.data);
        this.showNotification('success', 'Arquivo enviado com sucesso!');
        
      } catch (error) {
        this.$emit('upload-error', error);
        this.showNotification('error', 'Erro ao enviar arquivo');
      } finally {
        this.uploading = false;
      }
    }
  }
};
</script>

<style scoped>
.file-upload {
  width: 100%;
}

.upload-area {
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.3s;
}

.upload-area:hover {
  border-color: #007bff;
}

.upload-placeholder i {
  font-size: 48px;
  color: #ccc;
  margin-bottom: 10px;
}

.preview-container {
  position: relative;
  display: inline-block;
}

.preview-image {
  max-width: 200px;
  max-height: 200px;
  border-radius: 4px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.remove-btn {
  position: absolute;
  top: -10px;
  right: -10px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
}

.upload-progress {
  margin-top: 10px;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background: #eee;
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #007bff;
  transition: width 0.3s;
}
</style>
```

### **Componente de Mapa Interativo**
```javascript
// components/LiveMap.vue
<template>
  <div class="live-map">
    <div ref="mapContainer" class="map-container"></div>
    
    <div class="map-controls">
      <button @click="centerOnDrivers" class="control-btn">
        <i class="fas fa-crosshairs"></i>
        Centralizar
      </button>
      
      <button @click="toggleHeatmap" class="control-btn">
        <i class="fas fa-fire"></i>
        Mapa de Calor
      </button>
      
      <div class="driver-list">
        <div 
          v-for="driver in drivers" 
          :key="driver.id"
          class="driver-item"
          :class="{ active: selectedDriver?.id === driver.id }"
          @click="selectDriver(driver)"
        >
          <div class="driver-avatar">
            <i class="fas fa-user"></i>
          </div>
          <div class="driver-info">
            <span class="driver-name">{{ driver.name }}</span>
            <span class="driver-status" :class="driver.status">
              {{ getStatusText(driver.status) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { Loader } from '@googlemaps/js-api-loader';

export default {
  data() {
    return {
      map: null,
      markers: {},
      heatmap: null,
      selectedDriver: null,
      drivers: [],
      showHeatmap: false,
      mapLoader: null
    };
  },
  
  async mounted() {
    await this.initializeMap();
    await this.loadDrivers();
    this.startWebSocket();
    this.startAutoRefresh();
  },
  
  methods: {
    async initializeMap() {
      this.mapLoader = new Loader({
        apiKey: process.env.VUE_APP_GOOGLE_MAPS_API_KEY,
        version: 'weekly'
      });
      
      const google = await this.mapLoader.load();
      
      this.map = new google.maps.Map(this.$refs.mapContainer, {
        center: { lat: -23.5505, lng: -46.6333 },
        zoom: 12,
        styles: this.getMapStyles()
      });
    },
    
    async loadDrivers() {
      try {
        const response = await this.$api.get('/tracking/drivers/current-locations');
        this.drivers = response.data.data;
        this.updateMarkers();
      } catch (error) {
        console.error('Erro ao carregar motoristas:', error);
      }
    },
    
    updateMarkers() {
      // Limpar marcadores antigos
      Object.values(this.markers).forEach(marker => {
        marker.setMap(null);
      });
      this.markers = {};
      
      // Criar novos marcadores
      this.drivers.forEach(driver => {
        if (driver.latitude && driver.longitude) {
          const marker = new google.maps.Marker({
            position: { lat: driver.latitude, lng: driver.longitude },
            map: this.map,
            title: driver.name,
            icon: this.getDriverIcon(driver.status)
          });
          
          // Info window
          const infoWindow = new google.maps.InfoWindow({
            content: this.createInfoWindowContent(driver)
          });
          
          marker.addListener('click', () => {
            infoWindow.open(this.map, marker);
          });
          
          this.markers[driver.id] = marker;
        }
      });
    },
    
    getDriverIcon(status) {
      const icons = {
        active: '🚗',
        busy: '🚛',
        inactive: '⏸️',
        available: '✅'
      };
      
      return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg width="40" height="40" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="18" fill="${this.getStatusColor(status)}" stroke="white" stroke-width="2"/>
            <text x="20" y="25" text-anchor="middle" fill="white" font-size="16">${icons[status] || '🚗'}</text>
          </svg>
        `)}`,
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 20)
      };
    },
    
    getStatusColor(status) {
      const colors = {
        active: '#28a745',
        busy: '#ffc107',
        inactive: '#6c757d',
        available: '#17a2b8'
      };
      return colors[status] || '#6c757d';
    },
    
    createInfoWindowContent(driver) {
      return `
        <div class="driver-info-window">
          <h4>${driver.name}</h4>
          <p><strong>Status:</strong> ${this.getStatusText(driver.status)}</p>
          <p><strong>Velocidade:</strong> ${driver.speed || 0} km/h</p>
          <p><strong>Última atualização:</strong> ${new Date(driver.last_update).toLocaleTimeString()}</p>
          ${driver.current_delivery_client ? `<p><strong>Entrega atual:</strong> ${driver.current_delivery_client}</p>` : ''}
        </div>
      `;
    },
    
    getStatusText(status) {
      const texts = {
        active: 'Ativo',
        busy: 'Ocupado',
        inactive: 'Inativo',
        available: 'Disponível'
      };
      return texts[status] || 'Desconhecido';
    },
    
    centerOnDrivers() {
      if (this.drivers.length === 0) return;
      
      const bounds = new google.maps.LatLngBounds();
      this.drivers.forEach(driver => {
        if (driver.latitude && driver.longitude) {
          bounds.extend({ lat: driver.latitude, lng: driver.longitude });
        }
      });
      
      this.map.fitBounds(bounds);
    },
    
    toggleHeatmap() {
      this.showHeatmap = !this.showHeatmap;
      
      if (this.showHeatmap) {
        const heatmapData = this.drivers
          .filter(driver => driver.latitude && driver.longitude)
          .map(driver => ({
            location: new google.maps.LatLng(driver.latitude, driver.longitude),
            weight: 1
          }));
        
        this.heatmap = new google.maps.visualization.HeatmapLayer({
          data: heatmapData,
          map: this.map,
          radius: 50
        });
      } else if (this.heatmap) {
        this.heatmap.setMap(null);
        this.heatmap = null;
      }
    },
    
    selectDriver(driver) {
      this.selectedDriver = driver;
      
      if (driver.latitude && driver.longitude) {
        this.map.setCenter({ lat: driver.latitude, lng: driver.longitude });
        this.map.setZoom(15);
      }
    },
    
    startWebSocket() {
      this.ws = new WebSocket(process.env.VUE_APP_WS_URL);
      
      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({
          type: 'auth',
          token: this.$store.state.auth.token
        }));
      };
      
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'location_update') {
          this.updateDriverLocation(data);
        }
      };
    },
    
    updateDriverLocation(data) {
      const driverIndex = this.drivers.findIndex(d => d.id === data.driver_id);
      
      if (driverIndex !== -1) {
        this.drivers[driverIndex] = { ...this.drivers[driverIndex], ...data };
        this.updateMarker(data.driver_id, data);
      }
    },
    
    updateMarker(driverId, locationData) {
      const marker = this.markers[driverId];
      if (marker && locationData.latitude && locationData.longitude) {
        marker.setPosition({ lat: locationData.latitude, lng: locationData.longitude });
      }
    },
    
    startAutoRefresh() {
      setInterval(() => {
        this.loadDrivers();
      }, 30000); // Atualizar a cada 30 segundos
    },
    
    getMapStyles() {
      return [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ];
    }
  },
  
  beforeDestroy() {
    if (this.ws) {
      this.ws.close();
    }
  }
};
</script>

<style scoped>
.live-map {
  position: relative;
  height: 600px;
  width: 100%;
}

.map-container {
  height: 100%;
  width: 100%;
}

.map-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  background: white;
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  z-index: 1000;
}

.control-btn {
  display: block;
  width: 100%;
  padding: 8px 12px;
  margin-bottom: 8px;
  border: none;
  background: #007bff;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.control-btn:hover {
  background: #0056b3;
}

.driver-list {
  max-height: 200px;
  overflow-y: auto;
}

.driver-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.driver-item:hover {
  background: #f8f9fa;
}

.driver-item.active {
  background: #e3f2fd;
}

.driver-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #007bff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
}

.driver-info {
  flex: 1;
}

.driver-name {
  display: block;
  font-weight: 500;
  font-size: 12px;
}

.driver-status {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  color: white;
}

.driver-status.active {
  background: #28a745;
}

.driver-status.busy {
  background: #ffc107;
  color: #212529;
}

.driver-status.inactive {
  background: #6c757d;
}

.driver-status.available {
  background: #17a2b8;
}
</style>
```

### **Componente de Dashboard Avançado**
```javascript
// components/AdvancedDashboard.vue
<template>
  <div class="advanced-dashboard">
    <!-- KPIs Cards -->
    <div class="kpi-cards">
      <div class="kpi-card" v-for="kpi in kpis" :key="kpi.key">
        <div class="kpi-icon" :style="{ background: kpi.color }">
          <i :class="kpi.icon"></i>
        </div>
        <div class="kpi-content">
          <h3>{{ kpi.value }}</h3>
          <p>{{ kpi.label }}</p>
          <span class="kpi-change" :class="kpi.trend">
            <i :class="kpi.trend === 'up' ? 'fas fa-arrow-up' : 'fas fa-arrow-down'"></i>
            {{ kpi.change }}%
          </span>
        </div>
      </div>
    </div>
    
    <!-- Charts Section -->
    <div class="charts-section">
      <div class="chart-container">
        <h3>Entregas por Status</h3>
        <canvas ref="deliveryChart"></canvas>
      </div>
      
      <div class="chart-container">
        <h3>Performance dos Motoristas</h3>
        <canvas ref="driverChart"></canvas>
      </div>
    </div>
    
    <!-- Real-time Updates -->
    <div class="realtime-section">
      <h3>Atualizações em Tempo Real</h3>
      <div class="updates-list">
        <div 
          v-for="update in recentUpdates" 
          :key="update.id"
          class="update-item"
          :class="update.type"
        >
          <div class="update-icon">
            <i :class="getUpdateIcon(update.type)"></i>
          </div>
          <div class="update-content">
            <p>{{ update.message }}</p>
            <span class="update-time">{{ formatTime(update.timestamp) }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Alerts Section -->
    <div class="alerts-section">
      <h3>Alertas</h3>
      <div class="alerts-list">
        <div 
          v-for="alert in alerts" 
          :key="alert.id"
          class="alert-item"
          :class="alert.severity"
        >
          <div class="alert-icon">
            <i :class="getAlertIcon(alert.severity)"></i>
          </div>
          <div class="alert-content">
            <h4>{{ alert.title }}</h4>
            <p>{{ alert.message }}</p>
            <span class="alert-time">{{ formatTime(alert.timestamp) }}</span>
          </div>
          <button @click="dismissAlert(alert.id)" class="dismiss-btn">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Chart from 'chart.js/auto';

export default {
  data() {
    return {
      kpis: [],
      recentUpdates: [],
      alerts: [],
      deliveryChart: null,
      driverChart: null,
      updateInterval: null
    };
  },
  
  async mounted() {
    await this.loadDashboardData();
    this.initializeCharts();
    this.startRealTimeUpdates();
  },
  
  methods: {
    async loadDashboardData() {
      try {
        const [kpisResponse, updatesResponse, alertsResponse] = await Promise.all([
          this.$api.get('/dashboard/kpis'),
          this.$api.get('/dashboard/recent-updates'),
          this.$api.get('/dashboard/alerts')
        ]);
        
        this.kpis = this.formatKPIs(kpisResponse.data.data);
        this.recentUpdates = updatesResponse.data.data;
        this.alerts = alertsResponse.data.data;
        
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      }
    },
    
    formatKPIs(data) {
      return [
        {
          key: 'today_deliveries',
          label: 'Entregas Hoje',
          value: data.today_deliveries.total,
          icon: 'fas fa-truck',
          color: '#007bff',
          change: 12.5,
          trend: 'up'
        },
        {
          key: 'active_drivers',
          label: 'Motoristas Ativos',
          value: data.active_drivers,
          icon: 'fas fa-users',
          color: '#28a745',
          change: 5.2,
          trend: 'up'
        },
        {
          key: 'performance_score',
          label: 'Performance',
          value: data.performance_score + '%',
          icon: 'fas fa-chart-line',
          color: '#ffc107',
          change: -2.1,
          trend: 'down'
        },
        {
          key: 'revenue_today',
          label: 'Receita Hoje',
          value: 'R$ ' + data.revenue_today.toFixed(2),
          icon: 'fas fa-dollar-sign',
          color: '#dc3545',
          change: 8.7,
          trend: 'up'
        }
      ];
    },
    
    initializeCharts() {
      this.createDeliveryChart();
      this.createDriverChart();
    },
    
    createDeliveryChart() {
      const ctx = this.$refs.deliveryChart.getContext('2d');
      
      this.deliveryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Entregues', 'Pendentes', 'Em Trânsito', 'Canceladas'],
          datasets: [{
            data: [85, 10, 3, 2],
            backgroundColor: ['#28a745', '#ffc107', '#17a2b8', '#dc3545']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    },
    
    createDriverChart() {
      const ctx = this.$refs.driverChart.getContext('2d');
      
      this.driverChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['João', 'Maria', 'Pedro', 'Ana', 'Carlos'],
          datasets: [{
            label: 'Entregas Realizadas',
            data: [25, 23, 20, 18, 15],
            backgroundColor: '#007bff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    },
    
    startRealTimeUpdates() {
      this.updateInterval = setInterval(() => {
        this.loadDashboardData();
      }, 30000);
    },
    
    getUpdateIcon(type) {
      const icons = {
        delivery: 'fas fa-truck',
        driver: 'fas fa-user',
        alert: 'fas fa-exclamation-triangle',
        system: 'fas fa-cog'
      };
      return icons[type] || 'fas fa-info-circle';
    },
    
    getAlertIcon(severity) {
      const icons = {
        low: 'fas fa-info-circle',
        medium: 'fas fa-exclamation-triangle',
        high: 'fas fa-exclamation-circle',
        critical: 'fas fa-times-circle'
      };
      return icons[severity] || 'fas fa-info-circle';
    },
    
    formatTime(timestamp) {
      const date = new Date(timestamp);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 60000) return 'Agora';
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m atrás`;
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
      return date.toLocaleDateString();
    },
    
    dismissAlert(alertId) {
      this.alerts = this.alerts.filter(alert => alert.id !== alertId);
    }
  },
  
  beforeDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    if (this.deliveryChart) {
      this.deliveryChart.destroy();
    }
    
    if (this.driverChart) {
      this.driverChart.destroy();
    }
  }
};
</script>

<style scoped>
.advanced-dashboard {
  padding: 20px;
}

.kpi-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.kpi-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
}

.kpi-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 24px;
  margin-right: 15px;
}

.kpi-content h3 {
  margin: 0 0 5px 0;
  font-size: 24px;
  font-weight: 600;
}

.kpi-content p {
  margin: 0 0 5px 0;
  color: #6c757d;
  font-size: 14px;
}

.kpi-change {
  font-size: 12px;
  font-weight: 500;
}

.kpi-change.up {
  color: #28a745;
}

.kpi-change.down {
  color: #dc3545;
}

.charts-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 30px;
}

.chart-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  height: 300px;
}

.chart-container h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
}

.realtime-section,
.alerts-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.updates-list,
.alerts-list {
  max-height: 300px;
  overflow-y: auto;
}

.update-item,
.alert-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #eee;
}

.update-icon,
.alert-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 15px;
  color: white;
}

.update-item.delivery .update-icon {
  background: #007bff;
}

.update-item.driver .update-icon {
  background: #28a745;
}

.update-item.alert .update-icon {
  background: #ffc107;
}

.update-item.system .update-icon {
  background: #6c757d;
}

.alert-item.low .alert-icon {
  background: #17a2b8;
}

.alert-item.medium .alert-icon {
  background: #ffc107;
}

.alert-item.high .alert-icon {
  background: #fd7e14;
}

.alert-item.critical .alert-icon {
  background: #dc3545;
}

.update-content,
.alert-content {
  flex: 1;
}

.update-content p,
.alert-content h4 {
  margin: 0 0 5px 0;
}

.update-time,
.alert-time {
  font-size: 12px;
  color: #6c757d;
}

.dismiss-btn {
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 5px;
}

.dismiss-btn:hover {
  color: #dc3545;
}
</style>
```

## 🚀 Próximos Passos

### **Implementações Pendentes (Fase 2)**
1. **Sistema de Notificações** - Porta 3008
2. **Importação XML NF** - Integração SEFAZ
3. **Funcionalidades Offline** - Cache e sincronização
4. **Configurações Avançadas** - Personalização por empresa

### **Melhorias Recomendadas**
1. **Implementar WebSocket** para atualizações em tempo real
2. **Adicionar upload de arquivos** com preview
3. **Criar dashboard interativo** com gráficos
4. **Implementar notificações push** para eventos importantes
5. **Adicionar cache offline** para dados críticos

## 🔧 12. Configuração do Frontend

### **Configuração Base**
```javascript
// config/api.js
const API_CONFIG = {
  AUTH_URL: 'http://localhost:3001',
  COMPANIES_URL: 'http://localhost:3007',
  RECEIPTS_URL: 'http://localhost:3004',
  TRACKING_URL: 'http://localhost:3005',
  DELIVERIES_URL: 'http://localhost:3003',
  REPORTS_URL: 'http://localhost:3006',
  DRIVERS_URL: 'http://localhost:3002',
  WS_URL: 'ws://localhost:3005'
};

// Interceptor para adicionar token
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### **Gerenciamento de Estado**
```javascript
// store/auth.js
const authStore = {
  token: null,
  user: null,
  company: null,
  
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    authStore.token = response.data.token;
    authStore.user = response.data.user;
    localStorage.setItem('token', response.data.token);
  },
  
  logout: () => {
    authStore.token = null;
    authStore.user = null;
    localStorage.removeItem('token');
  }
};
```

### **WebSocket Manager**
```javascript
// services/websocket.js
class WebSocketManager {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
  }
  
  connect(token) {
    this.ws = new WebSocket(`${API_CONFIG.WS_URL}`);
    
    this.ws.onopen = () => {
      console.log('WebSocket conectado');
      this.reconnectAttempts = 0;
      this.ws.send(JSON.stringify({
        type: 'auth',
        token: token
      }));
    };
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket desconectado');
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => this.reconnect(token), this.reconnectDelay);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('Erro no WebSocket:', error);
    };
  }
  
  handleMessage(data) {
    switch(data.type) {
      case 'location_update':
        store.dispatch('tracking/updateLocation', data);
        break;
      case 'driver_status':
        store.dispatch('tracking/updateDriverStatus', data);
        break;
      case 'delivery_update':
        store.dispatch('deliveries/updateDelivery', data);
        break;
      case 'alert':
        this.showAlert(data);
        break;
      default:
        console.log('Mensagem WebSocket não tratada:', data);
    }
  }
  
  reconnect(token) {
    this.reconnectAttempts++;
    console.log(`Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
    this.connect(token);
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  
  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  showAlert(data) {
    // Implementar notificação baseada no tipo de alerta
    const alertTypes = {
      'delivery_late': 'warning',
      'driver_offline': 'error',
      'system_maintenance': 'info'
    };
    
    const type = alertTypes[data.alert_type] || 'info';
    showNotification(type, data.message);
  }
}

export default WebSocketManager;
```

### **Store Vuex/Vue 3 Composition API**
```javascript
// store/index.js (Vuex)
import { createStore } from 'vuex';

export default createStore({
  state: {
    auth: {
      token: localStorage.getItem('token') || null,
      user: null,
      company: null
    },
    tracking: {
      drivers: [],
      locations: {},
      selectedDriver: null
    },
    deliveries: {
      list: [],
      current: null,
      filters: {
        status: 'all',
        driver_id: null,
        date_range: null
      }
    },
    receipts: {
      list: [],
      processing: false
    }
  },
  
  mutations: {
    SET_TOKEN(state, token) {
      state.auth.token = token;
      localStorage.setItem('token', token);
    },
    
    SET_USER(state, user) {
      state.auth.user = user;
    },
    
    SET_DRIVERS(state, drivers) {
      state.tracking.drivers = drivers;
    },
    
    UPDATE_DRIVER_LOCATION(state, { driverId, location }) {
      const driver = state.tracking.drivers.find(d => d.id === driverId);
      if (driver) {
        Object.assign(driver, location);
      }
    },
    
    SET_DELIVERIES(state, deliveries) {
      state.deliveries.list = deliveries;
    },
    
    SET_RECEIPTS(state, receipts) {
      state.receipts.list = receipts;
    }
  },
  
  actions: {
    async login({ commit }, credentials) {
      try {
        const response = await api.post('/auth/login', credentials);
        commit('SET_TOKEN', response.data.token);
        commit('SET_USER', response.data.user);
        return response.data;
      } catch (error) {
        throw error;
      }
    },
    
    async logout({ commit }) {
      try {
        await api.post('/auth/logout');
      } catch (error) {
        console.error('Erro no logout:', error);
      } finally {
        commit('SET_TOKEN', null);
        commit('SET_USER', null);
        localStorage.removeItem('token');
      }
    },
    
    async loadDrivers({ commit }) {
      try {
        const response = await api.get('/drivers');
        commit('SET_DRIVERS', response.data.data);
      } catch (error) {
        console.error('Erro ao carregar motoristas:', error);
      }
    },
    
    async loadDeliveries({ commit }, filters = {}) {
      try {
        const params = new URLSearchParams(filters);
        const response = await api.get(`/deliveries?${params}`);
        commit('SET_DELIVERIES', response.data.data);
      } catch (error) {
        console.error('Erro ao carregar entregas:', error);
      }
    }
  },
  
  getters: {
    isAuthenticated: state => !!state.auth.token,
    currentUser: state => state.auth.user,
    activeDrivers: state => state.tracking.drivers.filter(d => d.status === 'active'),
    pendingDeliveries: state => state.deliveries.list.filter(d => d.status === 'PENDING')
  }
});
```

## 🛠️ 13. Boas Práticas e Troubleshooting

### **Estrutura de Pastas Recomendada**
```
src/
├── components/
│   ├── common/
│   │   ├── FileUpload.vue
│   │   ├── LoadingSpinner.vue
│   │   └── NotificationToast.vue
│   ├── dashboard/
│   │   ├── KPICards.vue
│   │   ├── DeliveryChart.vue
│   │   └── DriverPerformance.vue
│   ├── tracking/
│   │   ├── LiveMap.vue
│   │   ├── DriverList.vue
│   │   └── LocationHistory.vue
│   └── deliveries/
│       ├── DeliveryList.vue
│       ├── DeliveryDetails.vue
│       └── OccurrenceForm.vue
├── services/
│   ├── api.js
│   ├── websocket.js
│   └── notifications.js
├── store/
│   ├── index.js
│   ├── modules/
│   │   ├── auth.js
│   │   ├── tracking.js
│   │   └── deliveries.js
│   └── plugins/
├── utils/
│   ├── formatters.js
│   ├── validators.js
│   └── helpers.js
└── config/
    ├── api.js
    └── constants.js
```

### **Validação de Formulários**
```javascript
// utils/validators.js
export const validators = {
  required: (value) => {
    return value !== null && value !== undefined && value !== '';
  },
  
  email: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  },
  
  cpf: (value) => {
    const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
    return cpfRegex.test(value);
  },
  
  phone: (value) => {
    const phoneRegex = /^\(\d{2}\) \d{4,5}-\d{4}$/;
    return phoneRegex.test(value);
  },
  
  cnh: (value) => {
    return value.length === 11 && /^\d+$/.test(value);
  },
  
  plate: (value) => {
    const plateRegex = /^[A-Z]{3}-\d{4}$/;
    return plateRegex.test(value);
  }
};

export const validateForm = (data, rules) => {
  const errors = {};
  
  Object.keys(rules).forEach(field => {
    const fieldRules = rules[field];
    const value = data[field];
    
    fieldRules.forEach(rule => {
      if (typeof rule === 'string') {
        if (!validators[rule](value)) {
          errors[field] = `${field} é obrigatório`;
        }
      } else if (typeof rule === 'function') {
        const result = rule(value);
        if (result !== true) {
          errors[field] = result;
        }
      }
    });
  });
  
  return errors;
};
```

### **Formatadores de Dados**
```javascript
// utils/formatters.js
export const formatters = {
  currency: (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  },
  
  date: (value) => {
    return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
  },
  
  datetime: (value) => {
    return new Intl.DateTimeFormat('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  },
  
  timeAgo: (value) => {
    const now = new Date();
    const date = new Date(value);
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    if (days < 7) return `${days}d atrás`;
    
    return formatters.date(value);
  },
  
  cpf: (value) => {
    return value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  },
  
  phone: (value) => {
    return value.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
  },
  
  plate: (value) => {
    return value.replace(/([A-Z]{3})(\d{4})/, '$1-$2');
  }
};
```

### **Tratamento de Erros Avançado**
```javascript
// services/errorHandler.js
class ErrorHandler {
  constructor() {
    this.errorCounts = {};
    this.maxErrors = 3;
    this.errorWindow = 60000; // 1 minuto
  }
  
  handleError(error, context = '') {
    const errorKey = `${context}_${error.code || 'unknown'}`;
    const now = Date.now();
    
    // Limpar erros antigos
    if (this.errorCounts[errorKey]) {
      this.errorCounts[errorKey] = this.errorCounts[errorKey].filter(
        timestamp => now - timestamp < this.errorWindow
      );
    } else {
      this.errorCounts[errorKey] = [];
    }
    
    // Adicionar novo erro
    this.errorCounts[errorKey].push(now);
    
    // Verificar se excedeu o limite
    if (this.errorCounts[errorKey].length >= this.maxErrors) {
      this.handleExcessiveErrors(error, context);
      return;
    }
    
    // Tratar erro normalmente
    this.showError(error, context);
  }
  
  showError(error, context) {
    let message = 'Erro desconhecido';
    
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          message = data.error?.message || 'Dados inválidos';
          break;
        case 401:
          message = 'Sessão expirada. Faça login novamente.';
          this.handleAuthError();
          break;
        case 403:
          message = 'Você não tem permissão para esta ação';
          break;
        case 404:
          message = 'Recurso não encontrado';
          break;
        case 422:
          message = this.formatValidationErrors(data.error?.details);
          break;
        case 500:
          message = 'Erro interno do servidor';
          break;
        default:
          message = data.error?.message || 'Erro desconhecido';
      }
    } else if (error.request) {
      message = 'Erro de conexão. Verifique sua internet.';
    } else {
      message = error.message || 'Erro desconhecido';
    }
    
    // Log do erro para debugging
    console.error(`[${context}]`, error);
    
    // Mostrar notificação
    showNotification('error', message);
  }
  
  formatValidationErrors(errors) {
    if (!errors || !Array.isArray(errors)) {
      return 'Dados inválidos';
    }
    
    return errors.map(err => `${err.field}: ${err.message}`).join(', ');
  }
  
  handleAuthError() {
    // Limpar dados de autenticação
    localStorage.removeItem('token');
    store.commit('SET_TOKEN', null);
    store.commit('SET_USER', null);
    
    // Redirecionar para login
    router.push('/login');
  }
  
  handleExcessiveErrors(error, context) {
    console.error(`Muitos erros em ${context}:`, error);
    
    // Mostrar mensagem de erro crítico
    showNotification('error', 'Muitos erros detectados. Verifique sua conexão.');
    
    // Opcional: Desabilitar funcionalidade temporariamente
    if (context === 'tracking') {
      store.commit('SET_TRACKING_DISABLED', true);
    }
  }
}

export default new ErrorHandler();
```

### **Cache e Performance**
```javascript
// services/cache.js
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.maxAge = 5 * 60 * 1000; // 5 minutos
  }
  
  set(key, data, ttl = this.maxAge) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    const isExpired = Date.now() - item.timestamp > item.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  has(key) {
    return this.get(key) !== null;
  }
  
  delete(key) {
    return this.cache.delete(key);
  }
  
  clear() {
    this.cache.clear();
  }
  
  // Cache com chave baseada em parâmetros
  generateKey(endpoint, params = {}) {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    return `${endpoint}?${sortedParams}`;
  }
}

export default new CacheManager();
```

### **Troubleshooting Comum**

#### **Problema: WebSocket não conecta**
```javascript
// Verificar se o serviço está rodando
fetch('http://localhost:3005/health')
  .then(response => response.json())
  .then(data => console.log('Serviço OK:', data))
  .catch(error => console.error('Serviço offline:', error));

// Verificar se o token é válido
const token = localStorage.getItem('token');
if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const isExpired = payload.exp * 1000 < Date.now();
    if (isExpired) {
      console.log('Token expirado, fazer refresh');
      // Implementar refresh token
    }
  } catch (error) {
    console.error('Token inválido:', error);
  }
}
```

#### **Problema: Upload de arquivos falha**
```javascript
// Verificar tamanho do arquivo
const maxSize = 5 * 1024 * 1024; // 5MB
if (file.size > maxSize) {
  showNotification('error', 'Arquivo muito grande. Máximo 5MB.');
  return;
}

// Verificar tipo do arquivo
const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
if (!allowedTypes.includes(file.type)) {
  showNotification('error', 'Tipo de arquivo não suportado.');
  return;
}

// Verificar conexão
if (!navigator.onLine) {
  showNotification('error', 'Sem conexão com a internet.');
  return;
}
```

#### **Problema: Dados não atualizam em tempo real**
```javascript
// Verificar se WebSocket está conectado
if (wsManager.ws.readyState !== WebSocket.OPEN) {
  console.log('WebSocket desconectado, reconectando...');
  wsManager.connect(token);
}

// Implementar fallback para polling
const startPolling = () => {
  setInterval(async () => {
    try {
      const response = await api.get('/tracking/drivers/current-locations');
      store.commit('SET_DRIVERS', response.data.data);
    } catch (error) {
      console.error('Erro no polling:', error);
    }
  }, 30000); // 30 segundos
};
```

## 📞 Suporte

Para dúvidas sobre a integração ou problemas com as APIs, consulte:
- **Documentação Swagger**: `http://localhost:3001/api-docs`
- **Status dos Serviços**: Verificar portas 3001-3007
- **Logs**: Verificar console dos serviços Node.js
- **GitHub Issues**: Criar issue no repositório do projeto

---

**🎉 Todas as funcionalidades críticas da Fase 1 estão implementadas e prontas para uso!** 