# Migração para Sistema Multi-Tenant

## Visão Geral

Este documento explica as mudanças necessárias para transformar o sistema atual em um sistema multi-tenant, onde múltiplas empresas podem ter suas próprias instâncias do sistema.

## Principais Mudanças

### 1. Estrutura do Banco de Dados

#### Novas Tabelas:
- **companies**: Armazena informações das empresas
- **company_settings**: Configurações específicas por empresa
- **activity_logs**: Log de atividades por empresa

#### Modificações nas Tabelas Existentes:
- Adicionada coluna `company_id` em todas as tabelas
- Constraints únicas agora são por empresa (ex: username único por empresa)
- Foreign keys para `companies`

### 2. Tipos de Usuário

#### Novos Tipos:
- **MASTER**: Administrador do sistema que pode gerenciar todas as empresas
- **ADMIN**: Administrador de uma empresa específica
- **SUPERVISOR**: Supervisor de uma empresa
- **OPERATOR**: Operador de uma empresa
- **DRIVER**: Motorista de uma empresa
- **CLIENT**: Cliente de uma empresa

### 3. Autenticação

#### Login Multi-Tenant:
```json
{
  "username": "admin",
  "password": "admin123",
  "company_domain": "empresa1" // opcional
}
```

#### Resposta do Login:
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "name": "Administrador",
    "email": "admin@empresa1.com",
    "role": "ADMIN",
    "company_id": 1,
    "company_name": "Empresa 1",
    "company_domain": "empresa1"
  },
  "token": "jwt_token_here"
}
```

### 4. Novos Serviços

#### Companies Service (Porta 3007):
- `GET /api/companies` - Listar empresas (MASTER)
- `POST /api/companies` - Criar empresa (MASTER)
- `GET /api/companies/:id` - Detalhes da empresa
- `PUT /api/companies/:id` - Atualizar empresa
- `GET /api/companies/:id/stats` - Estatísticas da empresa
- `PUT /api/companies/:id/settings` - Configurações da empresa

### 5. Middleware de Autorização

#### Verificação de Acesso:
- Usuários MASTER podem acessar qualquer empresa
- Outros usuários só podem acessar dados da sua empresa
- Middleware `checkCompanyAccess()` para verificar permissões

### 6. URLs e Domínios

#### Estrutura de URLs:
- **Master Dashboard**: `https://admin.idtransportes.com`
- **Empresa 1**: `https://empresa1.idtransportes.com`
- **Empresa 2**: `https://empresa2.idtransportes.com`

#### Subdomínios:
- Cada empresa terá seu subdomínio
- Configuração via DNS e proxy reverso

## Passos para Migração

### 1. Backup do Banco Atual
```sql
mysqldump -u root -p id_transportes > backup_antes_migracao.sql
```

### 2. Executar Script de Migração
```sql
mysql -u root -p id_transportes < migrate_to_multi_tenant.sql
```

### 3. Atualizar Serviços
- Reiniciar todos os serviços com as novas configurações
- Testar login com usuário master

### 4. Configurar Proxy Reverso
```nginx
# Exemplo de configuração Nginx
server {
    listen 80;
    server_name *.idtransportes.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Estrutura de Arquivos

### Novos Arquivos:
- `banco_id_transportes_multi_tenant.sql` - Nova estrutura do banco
- `migrate_to_multi_tenant.sql` - Script de migração
- `services/companies-service/` - Serviço de gerenciamento de empresas

### Arquivos Modificados:
- `services/auth-users-service/index.js` - Suporte multi-tenant
- `shared/db.js` - Configurações do banco

## Configurações por Empresa

### Personalização:
- **Logo**: Upload de logo personalizada
- **Cores**: Cores primária e secundária
- **Configurações**: Horário de trabalho, timezone, notificações
- **Limites**: Número máximo de usuários, motoristas, etc.

### Planos de Assinatura:
- **BASIC**: Até 5 usuários, 2 motoristas
- **PRO**: Até 20 usuários, 10 motoristas
- **ENTERPRISE**: Ilimitado

## Segurança

### Isolamento de Dados:
- Todos os dados são filtrados por `company_id`
- Usuários não podem acessar dados de outras empresas
- Logs de atividade por empresa

### Auditoria:
- Log de todas as ações dos usuários
- Rastreamento de IP e user agent
- Histórico de logins

## Frontend

### Adaptações Necessárias:
1. **Login**: Adicionar campo para domínio da empresa
2. **Dashboard**: Mostrar informações da empresa atual
3. **Navegação**: Adaptar para contexto da empresa
4. **Configurações**: Interface para personalização

### Exemplo de Login:
```javascript
const loginData = {
  username: 'admin',
  password: 'admin123',
  company_domain: 'empresa1' // opcional
};

const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(loginData)
});
```

## Testes

### Usuários de Teste:
- **Master**: `master` / `admin123`
- **Admin Empresa 1**: `admin` / `admin123` (empresa: idtransportes)

### Endpoints de Teste:
```bash
# Login master
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"master","password":"admin123"}'

# Criar nova empresa
curl -X POST http://localhost:3007/api/companies \
  -H "Authorization: Bearer MASTER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nova Empresa","domain":"novaempresa","email":"contato@novaempresa.com"}'
```

## Próximos Passos

1. **Executar migração** do banco de dados
2. **Testar** todos os endpoints
3. **Configurar** proxy reverso
4. **Adaptar** frontend
5. **Implementar** upload de logos
6. **Configurar** notificações por empresa
7. **Testar** isolamento de dados
8. **Documentar** APIs atualizadas 