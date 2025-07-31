# 🔐 Credenciais de Teste - ID Transportes

## 📋 Visão Geral

Este documento contém todas as credenciais de teste para acessar o sistema ID Transportes com diferentes tipos de usuários e empresas.

**⚠️ IMPORTANTE**: Estas são credenciais de teste. Em produção, use senhas fortes e únicas.

---

## 🏢 Empresa Principal: ID Transportes

**Domínio**: `idtransportes`

### 👥 Usuários Disponíveis

#### 🔐 **MASTER** (Super Administrador)
- **Username**: `master`
- **Password**: `password`
- **Email**: `master@idtransportes.com`
- **Nome**: Administrador Master
- **Permissões**: Acesso total ao sistema
- **Login**: `POST /api/auth/login` com `company_domain: "idtransportes"`

#### 👨‍💼 **ADMIN** (Administrador)
- **Username**: `admin`
- **Password**: `password`
- **Email**: `admin@idtransportes.com`
- **Nome**: Administrador Geral
- **Permissões**: Administração da empresa
- **Login**: `POST /api/auth/login` com `company_domain: "idtransportes"`

#### 👨‍💼 **SUPERVISOR** (Supervisor)
- **Username**: `supervisor`
- **Password**: `password`
- **Email**: `supervisor@idtransportes.com`
- **Nome**: João Supervisor
- **Permissões**: Supervisão de entregas e motoristas
- **Login**: `POST /api/auth/login` com `company_domain: "idtransportes"`

#### 👩‍💻 **OPERATOR** (Operador)
- **Username**: `operator`
- **Password**: `password`
- **Email**: `operator@idtransportes.com`
- **Nome**: Maria Operadora
- **Permissões**: Operações básicas
- **Login**: `POST /api/auth/login` com `company_domain: "idtransportes"`

#### 👤 **CLIENT** (Cliente)
- **Username**: `client`
- **Password**: `password`
- **Email**: `client@idtransportes.com`
- **Nome**: Cliente Teste
- **Permissões**: Visualização de entregas próprias
- **Login**: `POST /api/auth/login` com `company_domain: "idtransportes"`

---

## 🚛 Motoristas da ID Transportes

### 👨‍💼 **João Motorista** (Ativo)
- **Username**: `joao_motorista`
- **Password**: `password`
- **Email**: `joao@idtransportes.com`
- **Nome**: João Motorista
- **CPF**: 123.456.789-00
- **Telefone**: (11) 99999-9999
- **Status**: `active`
- **Login**: `POST /api/auth/login` com `company_domain: "idtransportes"`

### 👩‍💼 **Maria Condutora** (Ativo)
- **Username**: `maria_motorista`
- **Password**: `password`
- **Email**: `maria@idtransportes.com`
- **Nome**: Maria Condutora
- **CPF**: 987.654.321-00
- **Telefone**: (11) 88888-8888
- **Status**: `active`
- **Login**: `POST /api/auth/login` com `company_domain: "idtransportes"`

### 👨‍💼 **Pedro Entregador** (Ativo)
- **Username**: `pedro_motorista`
- **Password**: `password`
- **Email**: `pedro@idtransportes.com`
- **Nome**: Pedro Entregador
- **CPF**: 456.789.123-00
- **Telefone**: (11) 77777-7777
- **Status**: `active`
- **Login**: `POST /api/auth/login` com `company_domain: "idtransportes"`

---

## 🏢 Empresa Secundária: Transportes Rápidos

**Domínio**: `transportesrapidos`

### 👥 Usuários Disponíveis

#### 👨‍💼 **ADMIN** (Administrador)
- **Username**: `admin2`
- **Password**: `password`
- **Email**: `admin@transportesrapidos.com`
- **Nome**: Admin Transportes Rápidos
- **Permissões**: Administração da empresa
- **Login**: `POST /api/auth/login` com `company_domain: "transportesrapidos"`

#### 👨‍💼 **DRIVER** (Motorista)
- **Username**: `driver2`
- **Password**: `password`
- **Email**: `driver@transportesrapidos.com`
- **Nome**: Carlos Motorista
- **Permissões**: Acesso de motorista
- **Login**: `POST /api/auth/login` com `company_domain: "transportesrapidos"`

---

## 🚗 Veículos Disponíveis

### 🏢 ID Transportes

| Placa | Modelo | Ano | Status |
|-------|--------|-----|--------|
| ABC-1234 | Fiat Fiorino | 2020 | active |
| XYZ-5678 | Renault Kangoo | 2021 | active |
| DEF-9012 | Peugeot Partner | 2019 | active |
| GHI-3456 | Fiat Doblo | 2022 | active |

### 🏢 Transportes Rápidos

| Placa | Modelo | Ano | Status |
|-------|--------|-----|--------|
| RAP-1234 | Mercedes Sprinter | 2021 | active |

---

## 🔧 Como Usar as Credenciais

### 1. **Login via API**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password",
    "company_domain": "idtransportes"
  }'
```

### 2. **Login via Frontend**
- URL: `http://localhost:8080`
- Username: `admin`
- Password: `password`
- Company Domain: `idtransportes`

### 3. **Testar Diferentes Perfis**
- **MASTER**: Acesso total ao sistema
- **ADMIN**: Gestão da empresa
- **SUPERVISOR**: Supervisão de entregas
- **OPERATOR**: Operações básicas
- **DRIVER**: Acesso de motorista
- **CLIENT**: Visualização de entregas

---

## 🧪 Cenários de Teste

### 📊 **Dashboard e KPIs**
- Login como `master` ou `admin`
- Verificar KPIs do dashboard
- Analisar relatórios de performance

### 🚚 **Gestão de Entregas**
- Login como `supervisor` ou `admin`
- Criar novas entregas
- Atribuir motoristas
- Atualizar status

### 📍 **Rastreamento em Tempo Real**
- Login como `joao_motorista`, `maria_motorista` ou `pedro_motorista`
- Enviar localizações via API
- Testar WebSocket para atualizações

### 📸 **Upload de Canhotos**
- Login como motorista
- Fazer upload de imagens
- Testar processamento OCR

### 👥 **Gestão de Motoristas**
- Login como `admin`
- Criar/editar motoristas
- Atribuir veículos
- Verificar performance

---

## 🔒 Segurança

### ⚠️ **Importante**
- Estas são credenciais de **TESTE**
- Senha padrão: `password` (hash bcrypt)
- Em produção, use senhas fortes
- Troque as senhas após primeiro acesso

### 🔐 **Hash da Senha**
```
password = $2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi
```

---

## 📊 Status dos Testes

### ✅ **Credenciais Funcionando (90% de sucesso)**
- ✅ `master` / `password` - ID Transportes
- ✅ `supervisor` / `password` - ID Transportes
- ✅ `operator` / `password` - ID Transportes
- ✅ `client` / `password` - ID Transportes
- ✅ `joao_motorista` / `password` - ID Transportes
- ✅ `maria_motorista` / `password` - ID Transportes
- ✅ `pedro_motorista` / `password` - ID Transportes
- ✅ `admin2` / `password` - Transportes Rápidos
- ✅ `driver2` / `password` - Transportes Rápidos

### ❌ **Credenciais com Problema**
- ❌ `admin` / `password` - ID Transportes (Senha inválida)

---

## 📞 Suporte

Para dúvidas sobre as credenciais de teste:
- **Email**: glaubermag@gmail.com
- **Sistema**: ID Transportes Backend
- **Versão**: 1.0.0 (Fase 1)

---

**🎯 Objetivo**: Facilitar testes de todos os fluxos do sistema com dados realistas e credenciais organizadas por tipo de usuário. 