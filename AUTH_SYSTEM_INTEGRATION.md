# 🔐 Sistema de Autenticação com Seleção de Empresa

## 📋 Visão Geral

Este sistema implementa um fluxo de autenticação em duas etapas:
1. **Login do usuário** - Autenticação inicial
2. **Seleção de empresa** - Escolha da empresa após login

## 🏗️ Arquitetura dos Serviços

### Auth Service (Porta 3000)
- Gerencia autenticação e seleção de empresas
- Base URL: `http://localhost:3000`

### Outros Serviços
- **Deliveries Service**: `http://localhost:3001`
- **Drivers Service**: `http://localhost:3002`
- **Receipts Service**: `http://localhost:3004`
- **Tracking Service**: `http://localhost:3005`
- **Reports Service**: `http://localhost:3006`

## 🔄 Fluxo de Autenticação

### 1. Login Inicial
```javascript
// POST /api/auth/login
const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'joao_motorista',
    password: '123456'
  })
});

const loginData = await loginResponse.json();
// Response:
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 16,
      "username": "joao_motorista",
      "email": "joao@idtransportes.com",
      "full_name": "João Motorista",
      "user_type": "DRIVER",
      "company_id": 1,
      "company_name": "ID Transportes",
      "company_domain": "idtransportes"
    }
  }
}
```

### 2. Listar Empresas Disponíveis
```javascript
// GET /api/auth/companies
const companiesResponse = await fetch('http://localhost:3000/api/auth/companies', {
  headers: {
    'Authorization': `Bearer ${loginData.data.token}`
  }
});

const companiesData = await companiesResponse.json();
// Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "ID Transportes",
      "domain": "idtransportes",
      "email": "contato@idtransportes.com",
      "subscription_plan": "ENTERPRISE"
    }
  ]
}
```

### 3. Selecionar Empresa
```javascript
// POST /api/auth/select-company
const selectCompanyResponse = await fetch('http://localhost:3000/api/auth/select-company', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${loginData.data.token}`
  },
  body: JSON.stringify({
    company_id: 1
  })
});

const selectCompanyData = await selectCompanyResponse.json();
// Response:
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // Novo token com company_id
    "user": {
      "id": 16,
      "username": "joao_motorista",
      "email": "joao@idtransportes.com",
      "full_name": "João Motorista",
      "user_type": "DRIVER",
      "company_id": 1
    }
  }
}
```

## 🎯 Implementação no Frontend

### 1. Componente de Login
```javascript
// LoginForm.jsx
import React, { useState } from 'react';

const LoginForm = ({ onLoginSuccess }) => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (data.success) {
        // Salvar token temporário (sem company_id)
        localStorage.setItem('tempToken', data.data.token);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        
        onLoginSuccess(data.data);
      } else {
        setError(data.error || 'Erro no login');
      }
    } catch (error) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="text"
        placeholder="Usuário"
        value={credentials.username}
        onChange={(e) => setCredentials({...credentials, username: e.target.value})}
      />
      <input
        type="password"
        placeholder="Senha"
        value={credentials.password}
        onChange={(e) => setCredentials({...credentials, password: e.target.value})}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Entrando...' : 'Entrar'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
};
```

### 2. Componente de Seleção de Empresa
```javascript
// CompanySelector.jsx
import React, { useState, useEffect } from 'react';

const CompanySelector = ({ onCompanySelected }) => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const tempToken = localStorage.getItem('tempToken');
      const response = await fetch('http://localhost:3000/api/auth/companies', {
        headers: {
          'Authorization': `Bearer ${tempToken}`
        }
      });

      const data = await response.json();

      if (data.success) {
        setCompanies(data.data);
      } else {
        setError(data.error || 'Erro ao carregar empresas');
      }
    } catch (error) {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const selectCompany = async (companyId) => {
    try {
      const tempToken = localStorage.getItem('tempToken');
      const response = await fetch('http://localhost:3000/api/auth/select-company', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tempToken}`
        },
        body: JSON.stringify({ company_id: companyId })
      });

      const data = await response.json();

      if (data.success) {
        // Salvar token final (com company_id)
        localStorage.setItem('token', data.data.token);
        localStorage.removeItem('tempToken');
        
        onCompanySelected(data.data);
      } else {
        setError(data.error || 'Erro ao selecionar empresa');
      }
    } catch (error) {
      setError('Erro de conexão');
    }
  };

  if (loading) return <div>Carregando empresas...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="company-selector">
      <h2>Selecione sua empresa</h2>
      <div className="companies-grid">
        {companies.map(company => (
          <div key={company.id} className="company-card" onClick={() => selectCompany(company.id)}>
            <h3>{company.name}</h3>
            <p>{company.domain}</p>
            <p>{company.subscription_plan}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 3. Componente Principal de Autenticação
```javascript
// AuthFlow.jsx
import React, { useState } from 'react';
import LoginForm from './LoginForm';
import CompanySelector from './CompanySelector';

const AuthFlow = ({ onAuthComplete }) => {
  const [step, setStep] = useState('login'); // 'login' | 'company' | 'complete'
  const [userData, setUserData] = useState(null);

  const handleLoginSuccess = (data) => {
    setUserData(data);
    setStep('company');
  };

  const handleCompanySelected = (data) => {
    setUserData(data);
    setStep('complete');
    onAuthComplete(data);
  };

  return (
    <div className="auth-flow">
      {step === 'login' && (
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      )}
      
      {step === 'company' && (
        <CompanySelector onCompanySelected={handleCompanySelected} />
      )}
      
      {step === 'complete' && (
        <div>
          <h2>Bem-vindo, {userData.user.full_name}!</h2>
          <p>Empresa: {userData.user.company_id}</p>
        </div>
      )}
    </div>
  );
};
```

### 4. Hook para Gerenciar Autenticação
```javascript
// useAuth.js
import { useState, useEffect } from 'react';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = () => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        setUser(user);
        setIsAuthenticated(true);
      } catch (error) {
        logout();
      }
    }
    setLoading(false);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('tempToken');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  const makeAuthenticatedRequest = async (url, options = {}) => {
    const token = localStorage.getItem('token');
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      logout();
      throw new Error('Sessão expirada');
    }

    return response;
  };

  return {
    isAuthenticated,
    user,
    loading,
    logout,
    makeAuthenticatedRequest
  };
};
```

### 5. Exemplo de Uso nos Componentes
```javascript
// App.jsx
import React from 'react';
import { useAuth } from './hooks/useAuth';
import AuthFlow from './components/AuthFlow';
import Dashboard from './components/Dashboard';

const App = () => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return <div>Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <AuthFlow onAuthComplete={() => window.location.reload()} />;
  }

  return <Dashboard user={user} />;
};
```

## 🔧 Configuração dos Serviços

### 1. Iniciar Auth Service
```bash
cd services/auth-service
npm install
node index.js
```

### 2. Verificar se todos os serviços estão rodando
```bash
# Verificar portas em uso
netstat -ano | findstr :3000
netstat -ano | findstr :3001
netstat -ano | findstr :3002
netstat -ano | findstr :3004
netstat -ano | findstr :3005
netstat -ano | findstr :3006
```

## 📝 Dados de Teste

### Usuários Disponíveis
```javascript
// Credenciais de teste
const testUsers = [
  {
    username: 'joao_motorista',
    password: '123456',
    user_type: 'DRIVER'
  },
  {
    username: 'supervisor',
    password: '123456',
    user_type: 'SUPERVISOR'
  },
  {
    username: 'admin',
    password: '123456',
    user_type: 'ADMIN'
  }
];
```

## 🚀 Próximos Passos

1. **Implementar o frontend** seguindo a documentação acima
2. **Testar o fluxo completo** de login → seleção de empresa
3. **Integrar com os outros serviços** usando o token final
4. **Adicionar validações** e tratamento de erros
5. **Implementar refresh token** para maior segurança

## 🔒 Segurança

- Tokens têm validade de 24 horas
- Tokens temporários não contêm `company_id`
- Tokens finais contêm `company_id` para autorização
- Todos os endpoints validam o token e permissões
- Logout limpa todos os dados de sessão 