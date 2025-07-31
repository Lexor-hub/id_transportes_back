# 🚛 Backend ID Transportes - Documentação Completa

## 📋 Visão Geral do Sistema

O **Backend ID Transportes** é uma plataforma de gestão logística multi-tenant desenvolvida em **Node.js** com arquitetura de microserviços. O sistema gerencia entregas, rastreamento em tempo real, processamento de canhotos via OCR, relatórios avançados e gestão completa de motoristas e veículos.

### 🏗️ Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    ID TRANSPORTES BACKEND                  │
├─────────────────────────────────────────────────────────────┤
│  🔐 Auth Service (3001)     📊 Reports Service (3006)     │
│  • Login Multi-tenant       • KPIs e Dashboards           │
│  • JWT Authentication       • Relatórios Avançados        │
│  • User Management          • Performance Analytics        │
├─────────────────────────────────────────────────────────────┤
│  🚚 Deliveries Service (3003)  📍 Tracking Service (3005) │
│  • Gestão de Entregas       • Rastreamento Tempo Real     │
│  • Ocorrências              • WebSocket Updates            │
│  • Status Management        • Location History             │
├─────────────────────────────────────────────────────────────┤
│  👥 Drivers Service (3002)     📸 Receipts Service (3004) │
│  • Motoristas e Veículos    • Upload de Canhotos          │
│  • Performance Tracking     • OCR Processing               │
│  • Vehicle Management       • Document Validation          │
├─────────────────────────────────────────────────────────────┤
│  🏢 Companies Service (3007)   📊 Multi-tenant Database   │
│  • Multi-tenancy            • MySQL Database               │
│  • Company Settings         • Isolated Data per Company   │
│  • Domain Management        • Shared Infrastructure        │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Tecnologias e Stack

### **Backend Core**
- **Runtime**: Node.js v18+
- **Framework**: Express.js
- **Database**: MySQL 8.0+
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **File Upload**: Multer
- **CORS**: Cross-Origin Resource Sharing

### **Microserviços**
- **Auth Service**: Porta 3001
- **Drivers Service**: Porta 3002  
- **Deliveries Service**: Porta 3003
- **Receipts Service**: Porta 3004
- **Tracking Service**: Porta 3005
- **Reports Service**: Porta 3006
- **Companies Service**: Porta 3007

### **Dependências Principais**
```json
{
  "express": "^4.18.2",
  "mysql2": "^3.6.0",
  "jsonwebtoken": "^9.0.2",
  "bcrypt": "^5.1.0",
  "multer": "^1.4.5-lts.1",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1",
  "swagger-ui-express": "^5.0.0",
  "swagger-jsdoc": "^6.2.8"
}
```

## 🗄️ Estrutura do Banco de Dados

### **Tabelas Principais**

#### **companies** - Empresas Multi-tenant
```sql
CREATE TABLE companies (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18) UNIQUE,
  domain VARCHAR(100) UNIQUE NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  logo_url VARCHAR(500),
  primary_color VARCHAR(7) DEFAULT '#007bff',
  secondary_color VARCHAR(7) DEFAULT '#6c757d',
  is_active BOOLEAN DEFAULT TRUE,
  subscription_plan ENUM('BASIC', 'PRO', 'ENTERPRISE') DEFAULT 'BASIC',
  max_users INT DEFAULT 5,
  max_drivers INT DEFAULT 3,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### **users** - Usuários do Sistema
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  full_name VARCHAR(255) NOT NULL,
  user_type ENUM('MASTER', 'ADMIN', 'SUPERVISOR', 'DRIVER', 'OPERATOR', 'CLIENT') DEFAULT 'OPERATOR',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  UNIQUE KEY unique_username_company (username, company_id)
);
```

#### **drivers** - Motoristas
```sql
CREATE TABLE drivers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  cpf VARCHAR(14) UNIQUE,
  cnh VARCHAR(11) UNIQUE,
  phone VARCHAR(20),
  email VARCHAR(255),
  status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
  vehicle_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);
```

#### **vehicles** - Veículos
```sql
CREATE TABLE vehicles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  plate VARCHAR(8) UNIQUE NOT NULL,
  model VARCHAR(100),
  brand VARCHAR(100),
  year INT,
  color VARCHAR(50),
  status ENUM('active', 'maintenance', 'inactive') DEFAULT 'active',
  driver_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (driver_id) REFERENCES drivers(id)
);
```

#### **deliveries** - Entregas
```sql
CREATE TABLE deliveries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  nf_number VARCHAR(50),
  client_name VARCHAR(255) NOT NULL,
  client_address TEXT NOT NULL,
  client_phone VARCHAR(20),
  merchandise_value DECIMAL(10,2),
  status ENUM('PENDING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'REFUSED') DEFAULT 'PENDING',
  driver_id INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (driver_id) REFERENCES drivers(id)
);
```

#### **delivery_occurrences** - Ocorrências
```sql
CREATE TABLE delivery_occurrences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  delivery_id INT NOT NULL,
  type ENUM('reentrega', 'recusa', 'avaria', 'outro') NOT NULL,
  description TEXT NOT NULL,
  photo_url VARCHAR(500),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
);
```

#### **driver_locations** - Localizações dos Motoristas
```sql
CREATE TABLE driver_locations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  driver_id INT NOT NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  accuracy INT,
  speed DECIMAL(5,2),
  heading INT,
  delivery_id INT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES drivers(id),
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
);
```

#### **receipts** - Canhotos/Comprovantes
```sql
CREATE TABLE receipts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  delivery_id INT NOT NULL,
  driver_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),
  status ENUM('PENDING', 'PROCESSED', 'VALIDATED', 'ERROR') DEFAULT 'PENDING',
  ocr_data JSON,
  validated BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (delivery_id) REFERENCES deliveries(id),
  FOREIGN KEY (driver_id) REFERENCES drivers(id)
);
```

## 🔐 Sistema de Autenticação

### **Multi-tenancy com JWT**

O sistema implementa autenticação multi-tenant onde cada empresa tem seu próprio domínio e isolamento de dados:

```javascript
// Login Multi-tenant
POST /api/auth/login
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
- **MASTER**: Acesso total ao sistema (super admin)
- **ADMIN**: Administrador da empresa
- **SUPERVISOR**: Supervisor de entregas
- **DRIVER**: Motorista
- **OPERATOR**: Operador
- **CLIENT**: Cliente

### **Middleware de Autorização**
```javascript
function authorize(roles = []) {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (roles.length && !roles.includes(decoded.user_type)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    
    req.user = decoded;
    next();
  };
}
```

## 📍 Rastreamento em Tempo Real

### **WebSocket para Atualizações**
```javascript
// Conectar ao WebSocket
const ws = new WebSocket('ws://localhost:3005');

// Autenticar
ws.send(JSON.stringify({
  type: 'auth',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
}));

// Receber atualizações
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'location_update':
      // Atualizar posição no mapa
      break;
    case 'driver_status':
      // Atualizar status do motorista
      break;
  }
};
```

### **API de Localização**
```javascript
// Enviar localização
POST /api/tracking/location
{
  "driver_id": 2,
  "latitude": -23.5505,
  "longitude": -46.6333,
  "accuracy": 10,
  "speed": 50,
  "heading": 90,
  "delivery_id": 1
}

// Obter localizações atuais
GET /api/tracking/drivers/current-locations
```

## 📸 Processamento de Canhotos com OCR

### **Upload e Processamento**
```javascript
// Upload de canhoto
POST /api/receipts/upload
Content-Type: multipart/form-data

FormData:
- file: File (JPG, PNG, PDF)
- delivery_id: number
- driver_id: number
- notes: string

// Processar OCR
POST /api/receipts/{id}/process-ocr

// Validar dados extraídos
PUT /api/receipts/{id}/validate
{
  "ocr_data": {
    "nf_number": "123456",
    "client_name": "João Silva",
    "address": "Rua das Flores, 123",
    "value": 150.50
  },
  "validated": true
}
```

### **Dados Extraídos via OCR**
- Número da Nota Fiscal
- Nome do Cliente
- Endereço de Entrega
- Valor da Mercadoria
- Itens da Nota
- Data e Hora
- Assinatura (se disponível)

## 📊 Relatórios e Analytics

### **KPIs do Dashboard**
```javascript
GET /api/dashboard/kpis
{
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
```

### **Relatórios Avançados**
- **Relatório de Entregas**: Por período, motorista, status
- **Performance por Motorista**: Taxa de sucesso, tempo médio
- **Relatório por Cliente**: Volume, valor, crescimento
- **Análise de Ocorrências**: Tipos, frequência, padrões
- **Relatório Financeiro**: Receita, custos, margem

## 🚚 Gestão de Entregas

### **Fluxo de Entrega**
1. **Criação**: Sistema ou importação
2. **Atribuição**: Motorista designado
3. **Em Trânsito**: Motorista a caminho
4. **Entrega**: Concluída com sucesso
5. **Ocorrência**: Se houver problemas
6. **Finalização**: Status atualizado

### **Status das Entregas**
- **PENDING**: Aguardando atribuição
- **IN_TRANSIT**: Em trânsito
- **DELIVERED**: Entregue com sucesso
- **CANCELLED**: Cancelada
- **REFUSED**: Recusada pelo cliente

### **Ocorrências Comuns**
- **Reentrega**: Cliente não estava em casa
- **Recusa**: Cliente recusou a entrega
- **Avaria**: Produto danificado
- **Endereço Incorreto**: Dados de entrega errados

## 👥 Gestão de Motoristas e Veículos

### **Perfil do Motorista**
```javascript
{
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
    "year": 2020
  },
  "statistics": {
    "total_deliveries": 150,
    "completed_deliveries": 142,
    "success_rate": 94.7,
    "avg_delivery_time": 45.2
  }
}
```

### **Performance Tracking**
- Total de entregas realizadas
- Taxa de sucesso
- Tempo médio de entrega
- Ocorrências registradas
- Avaliação de performance

## 🏢 Multi-tenancy

### **Isolamento de Dados**
Cada empresa tem acesso apenas aos seus dados:
- Usuários da empresa
- Motoristas da empresa
- Entregas da empresa
- Relatórios da empresa

### **Configurações por Empresa**
```javascript
{
  "company_id": 1,
  "logo_url": "/uploads/logos/idtransportes-logo.png",
  "primary_color": "#007bff",
  "secondary_color": "#6c757d",
  "company_name": "ID Transportes",
  "delivery_settings": {
    "max_delivery_time": 120,
    "auto_assign_drivers": true,
    "require_signature": true,
    "require_photo": true
  }
}
```

## 🔧 Configuração e Deploy

### **Variáveis de Ambiente**
```env
# Database
DB_HOST=207.180.252.4
DB_NAME=id_transportes
DB_USER=glaubermag
DB_PASSWORD=C@C3te12
DB_PORT=3306

# JWT
JWT_SECRET=fda76ff877a92f9a86e7831fad372e2d9e777419e155aab4f5b18b37d280d05a

# Services
AUTH_SERVICE_PORT=3001
DELIVERIES_SERVICE_PORT=3002
DRIVERS_SERVICE_PORT=3003
RECEIPTS_SERVICE_PORT=3004
TRACKING_SERVICE_PORT=3005
REPORTS_SERVICE_PORT=3006
```

### **Instalação e Setup**
```bash
# 1. Clonar repositório
git clone [repository-url]
cd backend-id-transportes

# 2. Instalar dependências
npm install

# 3. Configurar .env
cp env.example .env
# Editar .env com suas configurações

# 4. Criar banco de dados
mysql -u root -p < banco_id_transportes_multi_tenant.sql

# 5. Iniciar serviços
cd services/auth-users-service && node index.js
cd services/drivers-vehicles-service && node index.js
cd services/deliveries-routes-service && node index.js
cd services/receipts-ocr-service && node index.js
cd services/tracking-service && node index.js
cd services/reports-service && node index.js
cd services/companies-service && node index.js
```

## 📈 Métricas e Monitoramento

### **KPIs Principais**
- **Taxa de Entrega**: % de entregas realizadas com sucesso
- **Tempo Médio**: Tempo médio de entrega
- **Eficiência**: Entregas por hora/motorista
- **Satisfação**: Avaliação dos clientes
- **Custo por Entrega**: Análise de custos

### **Alertas e Notificações**
- Motorista offline por muito tempo
- Entrega atrasada
- Ocorrência registrada
- Sistema de manutenção
- Limite de usuários atingido

## 🔒 Segurança

### **Medidas Implementadas**
- **JWT Authentication**: Tokens seguros com expiração
- **Password Hashing**: bcrypt para senhas
- **CORS**: Configuração de origens permitidas
- **Input Validation**: Validação de dados de entrada
- **SQL Injection Protection**: Prepared statements
- **File Upload Security**: Validação de tipos e tamanhos
- **Multi-tenancy Isolation**: Isolamento completo de dados

### **Boas Práticas**
- Senhas fortes obrigatórias
- Logs de auditoria
- Backup automático do banco
- Monitoramento de performance
- Rate limiting em APIs críticas

## 🚀 Funcionalidades Futuras (Fase 2)

### **Planejadas**
- **Sistema de Notificações**: Push notifications
- **Importação XML NF**: Integração SEFAZ
- **Funcionalidades Offline**: Cache e sincronização
- **Configurações Avançadas**: Personalização avançada
- **API Mobile**: Endpoints otimizados para apps
- **Integração GPS**: Rastreamento mais preciso
- **Relatórios Customizados**: Builder de relatórios
- **Dashboard Avançado**: Gráficos interativos

## 📞 Suporte e Manutenção

### **Logs e Debugging**
- Logs estruturados por serviço
- Monitoramento de performance
- Alertas de erro automáticos
- Backup automático diário

### **Documentação**
- **Swagger UI**: `http://localhost:3001/api-docs`
- **API Documentation**: ENDPOINTS_DOCUMENTATION.md
- **Frontend Integration**: FRONTEND_INTEGRATION_GUIDE.md
- **Database Schema**: banco_id_transportes_multi_tenant.sql

### **Contatos**
- **Desenvolvedor**: Glauber Magalhães
- **Email**: glaubermag@gmail.com
- **Empresa**: ID Transportes
- **Versão**: 1.0.0 (Fase 1)

---

**🎯 Objetivo**: Sistema completo de gestão logística multi-tenant com rastreamento em tempo real, processamento de documentos e analytics avançados para otimizar operações de transporte e entrega.

**💡 Diferencial**: Arquitetura microserviços, multi-tenancy robusto, OCR para processamento de documentos e rastreamento em tempo real via WebSocket. 