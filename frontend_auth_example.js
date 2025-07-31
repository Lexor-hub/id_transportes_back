// 🚀 Exemplo Prático - Integração Frontend com Sistema de Autenticação
// Este arquivo demonstra como implementar a autenticação no frontend

// ============================================================================
// 1. CONFIGURAÇÃO DE URLs
// ============================================================================

const API_BASE_URLS = {
  AUTH_SERVICE: 'http://localhost:3000',
  AUTH_USERS: 'http://localhost:3001',
  DRIVERS: 'http://localhost:3002',
  DELIVERIES: 'http://localhost:3003',
  RECEIPTS: 'http://localhost:3004',
  TRACKING: 'http://localhost:3005',
  REPORTS: 'http://localhost:3006',
  COMPANIES: 'http://localhost:3007'
};

// ============================================================================
// 2. SERVIÇO DE AUTENTICAÇÃO
// ============================================================================

class AuthService {
  constructor() {
    this.baseURL = API_BASE_URLS.AUTH_SERVICE;
  }

  async login(username, password) {
    try {
      console.log('🔐 Fazendo login...');
      
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

      console.log('✅ Login realizado com sucesso');
      
      // ✅ Estrutura correta - IMPORTANTE!
      return {
        token: data.data.token,
        user: data.data.user
      };
    } catch (error) {
      console.error('❌ Erro no login:', error.message);
      throw error;
    }
  }

  async getCompanies(token) {
    try {
      console.log('🏢 Carregando empresas...');
      
      const response = await fetch(`${this.baseURL}/api/auth/companies`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar empresas');
      }

      console.log('✅ Empresas carregadas com sucesso');
      
      // ✅ Estrutura correta - IMPORTANTE!
      return data.data;
    } catch (error) {
      console.error('❌ Erro ao carregar empresas:', error.message);
      throw error;
    }
  }

  async selectCompany(token, companyId) {
    try {
      console.log('🎯 Selecionando empresa...');
      
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

      console.log('✅ Empresa selecionada com sucesso');
      
      // ✅ Estrutura correta - IMPORTANTE!
      return {
        token: data.data.token,
        user: data.data.user
      };
    } catch (error) {
      console.error('❌ Erro ao selecionar empresa:', error.message);
      throw error;
    }
  }

  async getProfile(token) {
    try {
      console.log('👤 Carregando perfil...');
      
      const response = await fetch(`${this.baseURL}/api/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar perfil');
      }

      console.log('✅ Perfil carregado com sucesso');
      
      // ✅ Estrutura correta - IMPORTANTE!
      return data.data;
    } catch (error) {
      console.error('❌ Erro ao carregar perfil:', error.message);
      throw error;
    }
  }
}

// ============================================================================
// 3. GERENCIAMENTO DE ESTADO (Exemplo com localStorage)
// ============================================================================

class AuthStore {
  constructor() {
    this.authService = new AuthService();
  }

  // Salvar dados no localStorage
  saveAuthData(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    console.log('💾 Dados salvos no localStorage');
  }

  // Carregar dados do localStorage
  loadAuthData() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (token && user) {
      console.log('📱 Dados carregados do localStorage');
      return { token, user };
    }
    
    return null;
  }

  // Limpar dados
  clearAuthData() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    console.log('🗑️ Dados removidos do localStorage');
  }

  // Verificar se está logado
  isAuthenticated() {
    return !!this.loadAuthData();
  }
}

// ============================================================================
// 4. EXEMPLO DE USO NO FRONTEND
// ============================================================================

class AuthController {
  constructor() {
    this.authService = new AuthService();
    this.authStore = new AuthStore();
  }

  // Fluxo completo de autenticação
  async handleLogin(username, password) {
    try {
      // 1. Fazer login
      const { token, user } = await this.authService.login(username, password);
      
      // 2. Salvar dados
      this.authStore.saveAuthData(token, user);
      
      // 3. Carregar empresas disponíveis
      const companies = await this.authService.getCompanies(token);
      
      console.log('🎉 Login realizado com sucesso!');
      console.log('👤 Usuário:', user.full_name);
      console.log('🏢 Empresa atual:', user.company_name);
      console.log('📋 Empresas disponíveis:', companies.length);
      
      return {
        success: true,
        user,
        companies,
        nextStep: companies.length > 1 ? 'select-company' : 'dashboard'
      };
      
    } catch (error) {
      console.error('❌ Erro no login:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Selecionar empresa
  async handleSelectCompany(companyId) {
    try {
      const authData = this.authStore.loadAuthData();
      if (!authData) {
        throw new Error('Usuário não autenticado');
      }

      // 1. Selecionar empresa
      const { token, user } = await this.authService.selectCompany(authData.token, companyId);
      
      // 2. Atualizar dados
      this.authStore.saveAuthData(token, user);
      
      console.log('🎯 Empresa selecionada:', user.company_name);
      
      return {
        success: true,
        user
      };
      
    } catch (error) {
      console.error('❌ Erro ao selecionar empresa:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Carregar perfil
  async handleLoadProfile() {
    try {
      const authData = this.authStore.loadAuthData();
      if (!authData) {
        throw new Error('Usuário não autenticado');
      }

      const profile = await this.authService.getProfile(authData.token);
      
      console.log('👤 Perfil carregado:', profile.full_name);
      
      return {
        success: true,
        profile
      };
      
    } catch (error) {
      console.error('❌ Erro ao carregar perfil:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Logout
  handleLogout() {
    this.authStore.clearAuthData();
    console.log('👋 Logout realizado');
    return { success: true };
  }
}

// ============================================================================
// 5. EXEMPLO DE USO PRÁTICO
// ============================================================================

async function exemploUso() {
  console.log('🚀 Iniciando exemplo de uso...\n');
  
  const authController = new AuthController();
  
  // Simular login
  console.log('1️⃣ Fazendo login...');
  const loginResult = await authController.handleLogin('joao_motorista', 'password');
  
  if (loginResult.success) {
    console.log('\n2️⃣ Login bem-sucedido!');
    console.log('👤 Usuário:', loginResult.user.full_name);
    console.log('🏢 Empresa atual:', loginResult.user.company_name);
    
    // Se há múltiplas empresas, simular seleção
    if (loginResult.nextStep === 'select-company') {
      console.log('\n3️⃣ Selecionando empresa...');
      const selectResult = await authController.handleSelectCompany(1);
      
      if (selectResult.success) {
        console.log('✅ Empresa selecionada:', selectResult.user.company_name);
      }
    }
    
    // Carregar perfil
    console.log('\n4️⃣ Carregando perfil...');
    const profileResult = await authController.handleLoadProfile();
    
    if (profileResult.success) {
      console.log('✅ Perfil carregado:', profileResult.profile.full_name);
      console.log('📧 Email:', profileResult.profile.email);
    }
    
    // Logout
    console.log('\n5️⃣ Fazendo logout...');
    authController.handleLogout();
    
    console.log('\n🎉 Exemplo concluído com sucesso!');
  } else {
    console.error('❌ Falha no login:', loginResult.error);
  }
}

// ============================================================================
// 6. FUNÇÃO PARA TESTAR RAPIDAMENTE
// ============================================================================

// Descomente a linha abaixo para testar
// exemploUso();

// ============================================================================
// 7. EXPORTAÇÕES PARA USO NO FRONTEND
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  // Node.js
  module.exports = {
    AuthService,
    AuthStore,
    AuthController,
    API_BASE_URLS
  };
} else {
  // Browser
  window.AuthService = AuthService;
  window.AuthStore = AuthStore;
  window.AuthController = AuthController;
  window.API_BASE_URLS = API_BASE_URLS;
}

console.log('📚 Exemplo de autenticação carregado!');
console.log('💡 Use: const auth = new AuthController();');
console.log('💡 Use: auth.handleLogin(username, password);'); 