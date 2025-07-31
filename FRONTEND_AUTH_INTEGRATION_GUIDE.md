# 🚀 Guia de Integração Frontend - Sistema de Autenticação

## 📋 Visão Geral

Este guia documenta as correções necessárias para o frontend integrar corretamente com o sistema de autenticação multi-tenant do backend.

## 🔧 Problemas Identificados e Soluções

### 1. **Portas dos Serviços**

**❌ Problema**: O frontend estava tentando acessar endpoints na porta errada.

**✅ Solução**: Usar as portas corretas para cada serviço:

```javascript
// Portas corretas dos serviços
const AUTH_SERVICE_PORT = 3000;    // auth-service
const AUTH_USERS_PORT = 3001;      // auth-users-service
const DRIVERS_PORT = 3002;         // drivers-vehicles-service
const DELIVERIES_PORT = 3003;      // deliveries-routes-service
const RECEIPTS_PORT = 3004;        // receipts-ocr-service
const TRACKING_PORT = 3005;        // tracking-service
const REPORTS_PORT = 3006;         // reports-service
const COMPANIES_PORT = 3007;       // companies-service
```

### 2. **Estrutura de Resposta dos Endpoints**

**❌ Problema**: O frontend estava acessando dados com estrutura incorreta.

**✅ Solução**: Ajustar o acesso aos dados conforme a estrutura real:

```javascript
// ❌ Estrutura incorreta (anterior)
const user = response.data.user;
const token = response.data.token;

// ✅ Estrutura correta (atual)
const user = response.data.data.user;
const token = response.data.data.token;
```

## 🔐 Endpoints de Autenticação

### 1. **Login**
```javascript
// Endpoint: POST http://localhost:3000/api/auth/login
const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'joao_motorista',
    password: 'password'
  })
});

const loginData = await loginResponse.json();

// ✅ Estrutura correta da resposta:
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

// ✅ Acesso correto aos dados:
const token = loginData.data.token;
const user = loginData.data.user;
```

### 2. **Listar Empresas**
```javascript
// Endpoint: GET http://localhost:3000/api/auth/companies
const companiesResponse = await fetch('http://localhost:3000/api/auth/companies', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const companiesData = await companiesResponse.json();

// ✅ Estrutura correta da resposta:
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

// ✅ Acesso correto aos dados:
const companies = companiesData.data;
```

### 3. **Selecionar Empresa**
```javascript
// Endpoint: POST http://localhost:3000/api/auth/select-company
const selectCompanyResponse = await fetch('http://localhost:3000/api/auth/select-company', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    company_id: 1
  })
});

const selectCompanyData = await selectCompanyResponse.json();

// ✅ Estrutura correta da resposta:
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
      "company_name": "ID Transportes"
    }
  }
}

// ✅ Acesso correto aos dados:
const newToken = selectCompanyData.data.token;
const updatedUser = selectCompanyData.data.user;
```

### 4. **Obter Perfil do Usuário**
```javascript
// Endpoint: GET http://localhost:3000/api/auth/profile
const profileResponse = await fetch('http://localhost:3000/api/auth/profile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const profileData = await profileResponse.json();

// ✅ Estrutura correta da resposta:
{
  "success": true,
  "data": {
    "id": 16,
    "username": "joao_motorista",
    "email": "joao@idtransportes.com",
    "full_name": "João Motorista",
    "user_type": "DRIVER",
    "company_id": 1,
    "company_name": "ID Transportes"
  }
}

// ✅ Acesso correto aos dados:
const profile = profileData.data;
```

## 🛠️ Implementação no Frontend

### 1. **Configuração de URLs Base**
```javascript
// config/api.js
export const API_BASE_URLS = {
  AUTH_SERVICE: 'http://localhost:3000',
  AUTH_USERS: 'http://localhost:3001',
  DRIVERS: 'http://localhost:3002',
  DELIVERIES: 'http://localhost:3003',
  RECEIPTS: 'http://localhost:3004',
  TRACKING: 'http://localhost:3005',
  REPORTS: 'http://localhost:3006',
  COMPANIES: 'http://localhost:3007'
};
```

### 2. **Serviço de Autenticação**
```javascript
// services/authService.js
import { API_BASE_URLS } from '../config/api';

class AuthService {
  constructor() {
    this.baseURL = API_BASE_URLS.AUTH_SERVICE;
  }

  async login(username, password) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro no login');
      }

      // ✅ Estrutura correta
      return {
        token: data.data.token,
        user: data.data.user
      };
    } catch (error) {
      throw error;
    }
  }

  async getCompanies(token) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/companies`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar empresas');
      }

      // ✅ Estrutura correta
      return data.data;
    } catch (error) {
      throw error;
    }
  }

  async selectCompany(token, companyId) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/select-company`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ company_id: companyId })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao selecionar empresa');
      }

      // ✅ Estrutura correta
      return {
        token: data.data.token,
        user: data.data.user
      };
    } catch (error) {
      throw error;
    }
  }

  async getProfile(token) {
    try {
      const response = await fetch(`${this.baseURL}/api/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar perfil');
      }

      // ✅ Estrutura correta
      return data.data;
    } catch (error) {
      throw error;
    }
  }
}

export default new AuthService();
```

### 3. **Gerenciamento de Estado (Redux/Vuex/Context)**
```javascript
// store/auth.js (exemplo com Vuex)
export default {
  state: {
    user: null,
    token: null,
    companies: [],
    selectedCompany: null
  },
  
  mutations: {
    SET_USER(state, user) {
      state.user = user;
    },
    SET_TOKEN(state, token) {
      state.token = token;
    },
    SET_COMPANIES(state, companies) {
      state.companies = companies;
    },
    SET_SELECTED_COMPANY(state, company) {
      state.selectedCompany = company;
    },
    CLEAR_AUTH(state) {
      state.user = null;
      state.token = null;
      state.companies = [];
      state.selectedCompany = null;
    }
  },
  
  actions: {
    async login({ commit }, { username, password }) {
      try {
        const { token, user } = await authService.login(username, password);
        
        commit('SET_TOKEN', token);
        commit('SET_USER', user);
        
        // Salvar no localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    async loadCompanies({ commit, state }) {
      try {
        const companies = await authService.getCompanies(state.token);
        commit('SET_COMPANIES', companies);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    async selectCompany({ commit, state }, companyId) {
      try {
        const { token, user } = await authService.selectCompany(state.token, companyId);
        
        commit('SET_TOKEN', token);
        commit('SET_USER', user);
        commit('SET_SELECTED_COMPANY', user.company_id);
        
        // Atualizar localStorage
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    },
    
    logout({ commit }) {
      commit('CLEAR_AUTH');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
};
```

### 4. **Componente de Login**
```javascript
// components/Login.vue (exemplo Vue)
<template>
  <div class="login-container">
    <form @submit.prevent="handleLogin">
      <input v-model="username" type="text" placeholder="Usuário" required />
      <input v-model="password" type="password" placeholder="Senha" required />
      <button type="submit" :disabled="loading">
        {{ loading ? 'Entrando...' : 'Entrar' }}
      </button>
    </form>
    
    <div v-if="error" class="error">
      {{ error }}
    </div>
  </div>
</template>

<script>
import { mapActions } from 'vuex';

export default {
  data() {
    return {
      username: '',
      password: '',
      loading: false,
      error: ''
    };
  },
  
  methods: {
    ...mapActions(['login']),
    
    async handleLogin() {
      this.loading = true;
      this.error = '';
      
      try {
        const result = await this.login({
          username: this.username,
          password: this.password
        });
        
        if (result.success) {
          // Redirecionar para seleção de empresa ou dashboard
          this.$router.push('/select-company');
        } else {
          this.error = result.error;
        }
      } catch (error) {
        this.error = 'Erro interno do sistema';
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
```

### 5. **Componente de Seleção de Empresa**
```javascript
// components/CompanySelector.vue
<template>
  <div class="company-selector">
    <h2>Selecione sua empresa</h2>
    
    <div v-if="companies.length === 0" class="loading">
      Carregando empresas...
    </div>
    
    <div v-else class="companies-list">
      <div 
        v-for="company in companies" 
        :key="company.id"
        class="company-item"
        @click="selectCompany(company.id)"
      >
        <h3>{{ company.name }}</h3>
        <p>{{ company.email }}</p>
        <span class="plan">{{ company.subscription_plan }}</span>
      </div>
    </div>
    
    <div v-if="error" class="error">
      {{ error }}
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex';

export default {
  data() {
    return {
      loading: false,
      error: ''
    };
  },
  
  computed: {
    ...mapState(['companies'])
  },
  
  async mounted() {
    await this.loadCompanies();
  },
  
  methods: {
    ...mapActions(['loadCompanies', 'selectCompany']),
    
    async handleSelectCompany(companyId) {
      this.loading = true;
      this.error = '';
      
      try {
        const result = await this.selectCompany(companyId);
        
        if (result.success) {
          // Redirecionar para o dashboard
          this.$router.push('/dashboard');
        } else {
          this.error = result.error;
        }
      } catch (error) {
        this.error = 'Erro ao selecionar empresa';
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
```

## 🔧 Interceptor para Requisições

```javascript
// utils/apiInterceptor.js
import axios from 'axios';

// Criar instância do axios para cada serviço
const authApi = axios.create({
  baseURL: 'http://localhost:3000'
});

const driversApi = axios.create({
  baseURL: 'http://localhost:3002'
});

const deliveriesApi = axios.create({
  baseURL: 'http://localhost:3003'
});

// Interceptor para adicionar token automaticamente
const addAuthInterceptor = (api) => {
  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );
  
  api.interceptors.response.use(
    (response) => {
      return response;
    },
    (error) => {
      if (error.response?.status === 401) {
        // Token expirado ou inválido
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );
};

addAuthInterceptor(authApi);
addAuthInterceptor(driversApi);
addAuthInterceptor(deliveriesApi);

export { authApi, driversApi, deliveriesApi };
```

## 🚨 Checklist de Correções

### ✅ Para Implementar:

1. **Corrigir URLs dos endpoints**:
   - Login: `http://localhost:3000/api/auth/login`
   - Companies: `http://localhost:3000/api/auth/companies`
   - Select Company: `http://localhost:3000/api/auth/select-company`
   - Profile: `http://localhost:3000/api/auth/profile`

2. **Ajustar estrutura de dados**:
   - Usar `response.data.data.user` em vez de `response.data.user`
   - Usar `response.data.data.token` em vez de `response.data.token`
   - Usar `response.data.data` para arrays de empresas

3. **Implementar gerenciamento de estado**:
   - Armazenar token e dados do usuário
   - Gerenciar seleção de empresa
   - Implementar logout

4. **Adicionar interceptors**:
   - Adicionar token automaticamente nas requisições
   - Tratar erros 401 (token expirado)

5. **Implementar fluxo completo**:
   - Login → Seleção de Empresa → Dashboard

### 🔍 Para Testar:

1. **Teste de Login**:
   ```javascript
   // Credenciais de teste
   username: 'joao_motorista'
   password: 'password'
   ```

2. **Verificar estrutura de resposta**:
   - Login deve retornar `{ success: true, data: { token, user } }`
   - Companies deve retornar `{ success: true, data: [...] }`

3. **Testar fluxo completo**:
   - Login → Listar empresas → Selecionar empresa → Acessar perfil

## 📞 Suporte

Se encontrar problemas durante a implementação:

1. Verifique se todos os serviços estão rodando (`npm run dev`)
2. Confirme as portas corretas (3000-3007)
3. Use o arquivo `test_auth_system.js` como referência
4. Verifique a estrutura de resposta no console do navegador

---

**🎯 Resultado Esperado**: Sistema de autenticação multi-tenant funcionando perfeitamente com login, seleção de empresa e acesso aos dados do usuário. 