# Melhorias Necessárias no Backend - ID Transporte

## 📋 Visão Geral

Este documento detalha as melhorias necessárias no backend para tornar o frontend multi-tenant completamente funcional, baseado na análise da documentação existente e funcionalidades implementadas no frontend.

## 🎯 Funcionalidades Críticas Faltantes

### 1. Upload e Processamento de Canhotos

#### **Endpoints Necessários:**

```javascript
// Upload de canhotos
POST /api/receipts/upload
Content-Type: multipart/form-data
Body: {
  file: File,
  delivery_id: string,
  driver_id: string,
  notes?: string
}
Response: {
  success: boolean,
  data: {
    id: string,
    filename: string,
    url: string,
    processed: boolean,
    ocr_data?: object
  }
}

// Processamento OCR
POST /api/receipts/:id/process-ocr
Response: {
  success: boolean,
  data: {
    ocr_data: {
      nf_number: string,
      client_name: string,
      address: string,
      value: number,
      items: array
    }
  }
}

// Validação manual de dados OCR
PUT /api/receipts/:id/validate
Body: {
  ocr_data: object,
  validated: boolean,
  corrections?: object
}
```

#### **Funcionalidades Requeridas:**
- ✅ Suporte a múltiplos formatos (JPG, PNG, PDF)
- ✅ OCR automático para extrair dados
- ✅ Validação de qualidade da imagem
- ✅ Compressão automática
- ✅ Processamento assíncrono
- ✅ Extração de dados estruturados
- ✅ Validação de dados extraídos

### 2. Importação de XML da NF

#### **Endpoints Necessários:**

```javascript
// Upload de XML da NF
POST /api/sefaz/import-xml
Content-Type: multipart/form-data
Body: {
  file: File,
  driver_id: string
}
Response: {
  success: boolean,
  data: {
    nf_data: {
      number: string,
      client: string,
      address: string,
      items: array,
      total_value: number
    },
    deliveries_created: number
  }
}

// Validação prévia do XML
GET /api/sefaz/validate-xml
Query: { xml_content: string }
Response: {
  success: boolean,
  valid: boolean,
  errors?: array
}
```

#### **Funcionalidades Requeridas:**
- ✅ Validação de XML da SEFAZ
- ✅ Extração automática de dados
- ✅ Mapeamento para entregas
- ✅ Tratamento de erros de XML
- ✅ Verificação de estrutura
- ✅ Cache de consultas

### 3. Sistema de Rastreamento em Tempo Real

#### **Endpoints Necessários:**

```javascript
// Envio de localização
POST /api/tracking/location
Body: {
  driver_id: string,
  latitude: number,
  longitude: number,
  accuracy: number,
  timestamp: string,
  speed?: number,
  heading?: number
}

// Posições atuais de todos os motoristas
GET /api/tracking/drivers/current-locations
Response: {
  success: boolean,
  data: [{
    driver_id: string,
    driver_name: string,
    latitude: number,
    longitude: number,
    last_update: string,
    status: 'active' | 'inactive',
    current_delivery?: object
  }]
}

// Histórico de rastreamento
GET /api/tracking/drivers/:driverId/history
Query: { start_date: string, end_date: string }
Response: {
  success: boolean,
  data: [{
    timestamp: string,
    latitude: number,
    longitude: number,
    speed: number,
    delivery_id?: string
  }]
}
```

#### **WebSocket para Tempo Real:**
```javascript
// WebSocket endpoint
WS /tracking/real-time
Events: {
  'location_update': { driver_id, location, timestamp },
  'delivery_status': { delivery_id, status, timestamp },
  'driver_status': { driver_id, status, timestamp }
}
```

#### **Funcionalidades Requeridas:**
- ✅ Geolocalização em tempo real
- ✅ Histórico de posições
- ✅ Otimização de bateria
- ✅ Sincronização offline
- ✅ Status de atividade
- ✅ Tempo de inatividade
- ✅ Atualizações em tempo real
- ✅ Notificações de eventos

### 4. Gestão de Ocorrências

#### **Endpoints Necessários:**

```javascript
// Registrar ocorrência
POST /api/deliveries/:id/occurrence
Body: {
  type: 'reentrega' | 'recusa' | 'avaria',
  description: string,
  photo?: File,
  location?: { latitude: number, longitude: number },
  timestamp: string
}
Response: {
  success: boolean,
  data: {
    id: string,
    delivery_id: string,
    type: string,
    description: string,
    photo_url?: string,
    created_at: string
  }
}

// Listar ocorrências
GET /api/occurrences
Query: { 
  company_id: string,
  type?: string,
  start_date?: string,
  end_date?: string,
  driver_id?: string
}
Response: {
  success: boolean,
  data: [{
    id: string,
    delivery_id: string,
    type: string,
    description: string,
    photo_url?: string,
    driver_name: string,
    client_name: string,
    created_at: string
  }]
}
```

#### **Funcionalidades Requeridas:**
- ✅ Tipos: reentrega, recusa, avaria
- ✅ Foto da ocorrência
- ✅ Observações detalhadas
- ✅ Notificação automática
- ✅ Lista de ocorrências por empresa
- ✅ Filtros por tipo, data, motorista
- ✅ Relatórios de ocorrências

## 📊 Melhorias no Sistema de Relatórios

### 1. Relatórios Avançados

#### **Endpoints Necessários:**

```javascript
// Relatório de entregas
GET /api/reports/deliveries
Query: {
  company_id: string,
  start_date?: string,
  end_date?: string,
  driver_id?: string,
  client_id?: string,
  status?: string,
  format?: 'json' | 'pdf' | 'excel'
}
Response: {
  success: boolean,
  data: {
    summary: {
      total: number,
      completed: number,
      pending: number,
      cancelled: number
    },
    deliveries: array,
    charts: {
      daily_progress: array,
      status_distribution: array,
      driver_performance: array
    }
  }
}

// Relatório de desempenho por motorista
GET /api/reports/driver-performance
Query: {
  company_id: string,
  start_date: string,
  end_date: string,
  driver_id?: string
}
Response: {
  success: boolean,
  data: [{
    driver_id: string,
    driver_name: string,
    total_deliveries: number,
    completed_deliveries: number,
    success_rate: number,
    average_time: number,
    occurrences: number,
    performance_score: number
  }]
}

// Relatório por cliente
GET /api/reports/client-volume
Query: {
  company_id: string,
  start_date: string,
  end_date: string,
  client_id?: string
}
Response: {
  success: boolean,
  data: [{
    client_id: string,
    client_name: string,
    total_deliveries: number,
    total_value: number,
    average_value: number,
    growth_rate: number
  }]
}
```

### 2. Dashboard com KPIs

```javascript
// KPIs do dashboard
GET /api/dashboard/kpis
Query: { company_id: string }
Response: {
  success: boolean,
  data: {
    today_deliveries: {
      total: number,
      completed: number,
      pending: number
    },
    active_drivers: number,
    pending_occurrences: number,
    performance_score: number,
    revenue_today: number,
    efficiency_rate: number
  }
}

// Estatísticas da empresa
GET /api/dashboard/company-stats
Query: { company_id: string }
Response: {
  success: boolean,
  data: {
    monthly_growth: number,
    driver_efficiency: number,
    client_satisfaction: number,
    revenue_trend: array,
    delivery_trend: array
  }
}
```

## 🔔 Sistema de Notificações

### 1. Notificações em Tempo Real

```javascript
// Enviar notificação
POST /api/notifications/send
Body: {
  company_id: string,
  user_ids?: array,
  type: 'delivery' | 'occurrence' | 'system' | 'alert',
  title: string,
  message: string,
  data?: object,
  priority: 'low' | 'medium' | 'high'
}

// Listar notificações
GET /api/notifications
Query: {
  company_id: string,
  user_id?: string,
  type?: string,
  read?: boolean
}
Response: {
  success: boolean,
  data: [{
    id: string,
    type: string,
    title: string,
    message: string,
    read: boolean,
    created_at: string,
    data?: object
  }]
}

// Marcar como lida
PUT /api/notifications/:id/read
Response: { success: boolean }
```

### 2. Eventos do Sistema

```javascript
// Eventos que devem gerar notificações automáticas:
- Início/fim de rota
- Entrega realizada
- Ocorrência registrada
- Motorista inativo
- Canhoto processado
- Sistema offline/online
- Limite de entregas atingido
- Problemas de conectividade
```

## 📱 Funcionalidades Offline

### 1. Sincronização Offline

```javascript
// Sincronizar dados offline
POST /api/sync/offline-data
Body: {
  company_id: string,
  user_id: string,
  data: {
    deliveries: array,
    receipts: array,
    locations: array,
    occurrences: array
  },
  last_sync: string
}
Response: {
  success: boolean,
  data: {
    synced: number,
    conflicts: array,
    errors: array
  }
}

// Status da sincronização
GET /api/sync/status
Query: { company_id: string, user_id: string }
Response: {
  success: boolean,
  data: {
    last_sync: string,
    pending_changes: number,
    sync_status: 'idle' | 'syncing' | 'error',
    errors: array
  }
}
```

### 2. Cache Inteligente

```javascript
// Limpar cache
POST /api/cache/clear
Body: { company_id: string, cache_type?: string }

// Status do cache
GET /api/cache/status
Query: { company_id: string }
Response: {
  success: boolean,
  data: {
    size: number,
    entries: number,
    hit_rate: number,
    last_cleanup: string
  }
}
```

## 🏢 Melhorias na API de Empresas

### 1. Configurações Avançadas

```javascript
// Atualizar configurações da empresa
PUT /api/companies/:id/settings
Body: {
  primary_color: string,
  secondary_color: string,
  logo_url?: string,
  notification_settings: {
    email_enabled: boolean,
    push_enabled: boolean,
    sms_enabled: boolean
  },
  delivery_settings: {
    max_deliveries_per_day: number,
    working_hours: object,
    timezone: string
  },
  limits: {
    max_users: number,
    max_drivers: number,
    max_deliveries: number
  }
}

// Upload de logo
POST /api/companies/:id/upload-logo
Content-Type: multipart/form-data
Body: { file: File }
Response: {
  success: boolean,
  data: { logo_url: string }
}
```

### 2. Planos de Assinatura

```javascript
// Informações do plano
GET /api/companies/:id/plan
Response: {
  success: boolean,
  data: {
    plan_name: string,
    limits: {
      users: { max: number, used: number },
      drivers: { max: number, used: number },
      deliveries: { max: number, used: number }
    },
    features: array,
    billing: {
      amount: number,
      currency: string,
      next_billing: string
    }
  }
}

// Upgrade de plano
POST /api/companies/:id/upgrade-plan
Body: { plan_name: string }
Response: { success: boolean }
```

## 🔒 Segurança e Auditoria

### 1. Logs Detalhados

```javascript
// Listar logs de auditoria
GET /api/audit/logs
Query: {
  company_id: string,
  user_id?: string,
  action?: string,
  start_date?: string,
  end_date?: string,
  limit?: number
}
Response: {
  success: boolean,
  data: [{
    id: string,
    user_id: string,
    user_name: string,
    action: string,
    resource: string,
    details: object,
    ip_address: string,
    user_agent: string,
    timestamp: string
  }]
}

// Log automático
POST /api/audit/log
Body: {
  user_id: string,
  action: string,
  resource: string,
  details: object
}
```

### 2. Controle de Acesso

```javascript
// Verificar permissões
GET /api/permissions/check
Query: {
  user_id: string,
  resource: string,
  action: string
}
Response: {
  success: boolean,
  allowed: boolean,
  reason?: string
}
```

## 🔗 APIs de Integração

### 1. Integração com SEFAZ

```javascript
// Consultar NFe
GET /api/sefaz/consult-nfe
Query: { nf_number: string }
Response: {
  success: boolean,
  data: {
    nf_data: object,
    cached: boolean,
    last_updated: string
  }
}
```

### 2. Integração com Mapas

```javascript
// Geocodificação
GET /api/maps/geocode
Query: { address: string }
Response: {
  success: boolean,
  data: {
    latitude: number,
    longitude: number,
    formatted_address: string
  }
}

// Otimização de rotas
POST /api/maps/optimize-route
Body: {
  deliveries: array,
  vehicle_capacity: number
}
Response: {
  success: boolean,
  data: {
    optimized_route: array,
    total_distance: number,
    estimated_time: number
  }
}
```

## 📊 Novos Microserviços Necessários

### Estrutura de Serviços:

```
- notifications-service (Porta 3008)
  - Gerenciamento de notificações
  - Templates de mensagens
  - Integração com push/email/SMS

- reports-service (Porta 3009)
  - Geração de relatórios
  - Exportação PDF/Excel
  - Dashboards e gráficos

- tracking-service (Porta 3010)
  - Rastreamento em tempo real
  - Histórico de localizações
  - Otimização de rotas

- audit-service (Porta 3011)
  - Logs de auditoria
  - Controle de acesso
  - Monitoramento de segurança

- integration-service (Porta 3012)
  - Integração com SEFAZ
  - APIs de mapas
  - Webhooks externos
```

## 🗄️ Novas Tabelas no Banco de Dados

```sql
-- Tabelas necessárias:

-- Notificações
CREATE TABLE notifications (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  data JSON,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Logs de auditoria
CREATE TABLE audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100),
  details JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Configurações da empresa
CREATE TABLE company_settings (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  logo_url VARCHAR(255),
  notification_settings JSON,
  delivery_settings JSON,
  limits JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Planos de assinatura
CREATE TABLE subscription_plans (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  plan_name VARCHAR(50) NOT NULL,
  limits JSON,
  features JSON,
  billing JSON,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Sincronização offline
CREATE TABLE offline_sync (
  id VARCHAR(36) PRIMARY KEY,
  company_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  data_type VARCHAR(50) NOT NULL,
  data JSON,
  sync_status ENUM('pending', 'synced', 'error') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  synced_at TIMESTAMP NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Histórico de rastreamento
CREATE TABLE tracking_history (
  id VARCHAR(36) PRIMARY KEY,
  driver_id VARCHAR(36) NOT NULL,
  company_id VARCHAR(36) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(5, 2),
  speed DECIMAL(5, 2),
  heading DECIMAL(5, 2),
  delivery_id VARCHAR(36),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);
```

## 📈 Priorização de Implementação

### **Fase 1 - Crítico (1-2 semanas)**
1. **Upload de Canhotos** - Funcionalidade principal
2. **Rastreamento em Tempo Real** - Essencial para motoristas
3. **Gestão de Ocorrências** - Controle de qualidade
4. **Relatórios Básicos** - Visibilidade do negócio

### **Fase 2 - Importante (2-3 semanas)**
1. **Importação XML NF** - Automação
2. **Sistema de Notificações** - Comunicação
3. **Dashboard com KPIs** - Monitoramento
4. **Funcionalidades Offline** - Robustez

### **Fase 3 - Melhorias (3-4 semanas)**
1. **Configurações Avançadas** - Personalização
2. **Planos de Assinatura** - Monetização
3. **Auditoria Detalhada** - Compliance
4. **Integrações Externas** - Escalabilidade

## 🎯 Métricas de Sucesso

### **Técnicas**
- ✅ Tempo de resposta < 200ms
- ✅ Disponibilidade > 99.9%
- ✅ Sincronização offline < 5s
- ✅ Upload de canhotos < 10s

### **Negócio**
- ✅ Redução de 50% no tempo de processamento
- ✅ Aumento de 30% na satisfação dos motoristas
- ✅ Redução de 25% em ocorrências
- ✅ Aumento de 40% na visibilidade das entregas

## 🔧 Configurações de Infraestrutura

### **Redis para Cache**
```javascript
// Configuração Redis
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: process.env.REDIS_DB || 0
};

// Uso para:
- Sessões de usuário
- Cache de relatórios
- Dados de rastreamento
- Notificações em tempo real
```

### **WebSocket para Tempo Real**
```javascript
// Configuração WebSocket
const wsConfig = {
  port: process.env.WS_PORT || 8080,
  path: '/tracking/real-time',
  heartbeat: 30000
};
```

## 📝 Conclusão

Esta documentação detalha todas as melhorias necessárias no backend para tornar o frontend multi-tenant completamente funcional. A implementação dessas funcionalidades transformará o sistema em uma solução robusta e completa para gestão de entregas.

**Prioridade máxima:** Implementar upload de canhotos e rastreamento em tempo real, pois são as funcionalidades mais críticas para o uso diário dos motoristas. 