# ID Transportes - Backend API

Backend REST API para sistema de gestão de transportes, desenvolvido em Node.js com arquitetura de microserviços.

## 🚀 Tecnologias

- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **MySQL** - Banco de dados
- **JWT** - Autenticação
- **Swagger** - Documentação da API
- **Jest** - Testes
- **Tesseract.js** - OCR para canhotos
- **Multer** - Upload de arquivos

## 📋 Pré-requisitos

- Node.js (versão 14 ou superior)
- MySQL (versão 8.0 ou superior)
- Git

## 🛠️ Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/sua-organizacao/backend-id-transportes.git
cd backend-id-transportes
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure o banco de dados**
```bash
# Execute o script SQL para criar as tabelas
mysql -u root -p < banco_id_transportes.sql
```

4. **Configure as variáveis de ambiente**
```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env com suas configurações
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=id_transportes
DB_PORT=3306
JWT_SECRET=sua_chave_secreta_jwt
```

## 🏃‍♂️ Como executar

### Desenvolvimento (todos os serviços)
```bash
npm run dev
```

### Serviços individuais
```bash
# Auth/Users Service (porta 3001)
npm run start:auth

# Drivers/Vehicles Service (porta 3002)
npm run start:drivers

# Deliveries/Routes Service (porta 3003)
npm run start:deliveries

# Receipts/OCR Service (porta 3004)
npm run start:receipts

# Tracking Service (porta 3005)
npm run start:tracking

# Reports Service (porta 3006)
npm run start:reports
```

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Executar testes de um serviço específico
npm test -- services/auth-users-service
```

## 📚 Documentação da API

Acesse a documentação Swagger de cada serviço:

- **Auth/Users**: http://localhost:3001/api-docs
- **Drivers/Vehicles**: http://localhost:3002/api-docs
- **Deliveries/Routes**: http://localhost:3003/api-docs
- **Receipts/OCR**: http://localhost:3004/api-docs
- **Tracking**: http://localhost:3005/api-docs
- **Reports**: http://localhost:3006/api-docs

## 🏗️ Arquitetura

O projeto segue uma arquitetura de microserviços com os seguintes serviços:

### 1. Auth/Users Service (Porta 3001)
- Autenticação e autorização
- Gestão de usuários
- Recuperação de senha
- Middleware de autorização

### 2. Drivers/Vehicles Service (Porta 3002)
- Gestão de motoristas
- Gestão de veículos
- Validação de CPF único
- Validação de placa única

### 3. Deliveries/Routes Service (Porta 3003)
- Gestão de entregas
- Gestão de rotas
- Importação de XML SEFAZ
- Validações de negócio

### 4. Receipts/OCR Service (Porta 3004)
- Upload de canhotos
- Processamento OCR com Tesseract.js
- Gestão de recibos de entrega

### 5. Tracking Service (Porta 3005)
- Rastreamento em tempo real
- Pontos de rastreamento
- Notificações

### 6. Reports Service (Porta 3006)
- Relatórios avançados
- Filtros complexos
- Exportação de dados

## 🔐 Autenticação

O sistema utiliza JWT (JSON Web Tokens) para autenticação:

```bash
# Login
POST /api/auth/login
{
  "username": "admin",
  "password": "Admin123"
}

# Resposta
{
  "user": {
    "id": 1,
    "username": "admin",
    "name": "Administrador",
    "email": "admin@admin.com",
    "role": "ADMIN"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## 👥 Tipos de Usuário

- **ADMIN**: Acesso total ao sistema
- **MANAGER**: Gestão de entregas e relatórios
- **DRIVER**: Acesso limitado a entregas e rastreamento
- **CLIENT**: Visualização de entregas próprias

## 📊 Banco de Dados

O sistema utiliza MySQL com as seguintes tabelas principais:

- `users` - Usuários do sistema
- `drivers` - Motoristas
- `vehicles` - Veículos
- `clients` - Clientes
- `delivery_notes` - Notas de entrega
- `delivery_receipts` - Recibos de entrega
- `routes` - Rotas
- `tracking_points` - Pontos de rastreamento

## 🔧 Configuração de Desenvolvimento

### Variáveis de Ambiente (.env)
```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha
DB_NAME=id_transportes
DB_PORT=3306

# JWT
JWT_SECRET=sua_chave_secreta_jwt

# Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
```

## 🚀 Deploy

### Produção
```bash
# Instalar dependências
npm install --production

# Configurar variáveis de ambiente
# Executar migrações do banco
# Iniciar serviços
npm run start:auth
npm run start:drivers
# ... outros serviços
```

### Docker (opcional)
```bash
# Construir imagem
docker build -t id-transportes-backend .

# Executar container
docker run -p 3001:3001 id-transportes-backend
```

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 📞 Suporte

Para suporte, envie um email para suporte@idtransportes.com ou abra uma issue no GitHub.

## 🔄 Changelog

### v1.0.0
- Implementação inicial dos microserviços
- Autenticação JWT
- OCR para canhotos
- Importação XML SEFAZ
- Relatórios avançados
- Documentação Swagger 