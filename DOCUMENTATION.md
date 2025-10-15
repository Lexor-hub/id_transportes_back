Documentação dos Microsserviços (Node.js REST API)
A seguir, a proposta de microsserviços, suas funcionalidades e exemplos de endpoints REST, seguindo a arquitetura de microsserviços e utilizando Node.js no backend.
1. Microsserviço de Autenticação e Usuários (auth-users-service)
Este serviço será responsável pela gestão de usuários e autenticação no sistema.
• Funcionalidades:
    ◦ Login de usuários: Motoristas, Administradores, Supervisores/Operadores, Clientes.
    ◦ Recuperação de senha: Funcionalidade "Esqueceu senha".
    ◦ Cadastro de usuários: Administradores cadastram motoristas, veículos, rotas/entregas.
    ◦ Gestão de perfis de acesso: Diferentes permissões para Administrador, Supervisor/Operador, Motorista, Cliente.
• Endpoints REST (Exemplos):
    ◦ POST /api/auth/login - Autentica um usuário e retorna um JWT.
    ◦ POST /api/auth/forgot-password - Inicia o processo de recuperação de senha.
    ◦ POST /api/users - Cadastra um novo usuário (para administradores).
    ◦ GET /api/users/{id} - Obtém detalhes de um usuário.
    ◦ PUT /api/users/{id} - Atualiza informações de um usuário.
    ◦ DELETE /api/users/{id} - Desativa/exclui um usuário.
2. Microsserviço de Motoristas e Veículos (drivers-vehicles-service)
Este serviço gerenciará o cadastro e informações de motoristas e veículos.
• Funcionalidades:
    ◦ Cadastro de motoristas: Realizado pelo Administrador ou Supervisor/Operador.
    ◦ Cadastro de veículos: Realizado pelo Administrador ou Supervisor/Operador.
    ◦ Visualização e busca: Permite ao Administrador e Supervisor/Operador visualizar e buscar motoristas e veículos.
• Endpoints REST (Exemplos):
    ◦ POST /api/drivers - Cadastra um novo motorista.
    ◦ GET /api/drivers - Lista todos os motoristas.
    ◦ GET /api/drivers/{id} - Obtém detalhes de um motorista.
    ◦ PUT /api/drivers/{id} - Atualiza informações de um motorista.
    ◦ POST /api/vehicles - Cadastra um novo veículo.
    ◦ GET /api/vehicles - Lista todos os veículos.
    ◦ GET /api/vehicles/{id} - Obtém detalhes de um veículo.
    ◦ PUT /api/vehicles/{id} - Atualiza informações de um veículo.
3. Microsserviço de Entregas e Rotas (deliveries-routes-service)
Centraliza a gestão das entregas, notas fiscais, status e o fluxo das rotas dos motoristas.
• Funcionalidades:
    ◦ Cadastro de rotas/entregas: Realizado pelo Administrador.
    ◦ Fluxo do motorista: "Iniciar dia", "iniciar rota", "finalizar rota".
    ◦ Visualização de entregas: Motorista vê suas entregas do dia. Administrador/Supervisor/Operador/Cliente veem todas as entregas e as buscam.
    ◦ Marcação de status: Motorista marca o status da entrega.
    ◦ Gestão de ocorrências: Campo para reentrega, recusa de nota, e campo de observação para o motivo.
    ◦ Integração SEFAZ: Receber XMLs das notas fiscais para carregar informações das notas.
• Endpoints REST (Exemplos):
    ◦ POST /api/deliveries - Cadastra uma nova entrega (associada a uma NF).
    ◦ GET /api/deliveries - Lista todas as entregas (com filtros por data, cliente, NF, status).
    ◦ GET /api/deliveries/{id} - Obtém detalhes de uma entrega.
    ◦ PUT /api/deliveries/{id}/status - Atualiza o status de uma entrega.
    ◦ PUT /api/deliveries/{id}/occurrence - Registra ocorrência (reentrega, recusa, avaria).
    ◦ POST /api/routes - Cria uma nova rota.
    ◦ POST /api/routes/{id}/start-day - Motorista inicia o dia.
    ◦ POST /api/routes/{id}/start-route - Motorista inicia uma rota.
    ◦ POST /api/routes/{id}/finish-route - Motorista finaliza uma rota.
    ◦ GET /api/drivers/{driverId}/today-deliveries - Entregas do motorista para o dia.
    ◦ POST /api/sefaz/import-xml - Importa dados de NF via XML do SEFAZ.
4. Microsserviço de Canhotos e OCR (receipts-ocr-service)
Responsável pelo upload, armazenamento e processamento OCR das fotos dos canhotos.
• Funcionalidades:
    ◦ Upload de fotos: Motoristas tiram foto do comprovante de entrega. Escritório também pode fotografar.
    ◦ Extração de dados via OCR: Processa fotos para extrair campos obrigatórios como Data, Hora, Nome e CPF/RG de quem recebeu, Assinatura, Número da nota fiscal, Valor da mercadoria, Observações/Avarias, Nome do Cliente, Endereço.
    ◦ Armazenamento de canhotos: Armazena as imagens e os dados extraídos.
    ◦ Visualização e busca de canhotos: Administrador, Supervisor/Operador e Cliente podem ver e buscar canhotos por data/cliente e número da NF.
• Endpoints REST (Exemplos):
    ◦ POST /api/receipts/upload - Upload de foto de canhoto, com referência à NF.
    ◦ POST /api/receipts/{id}/process-ocr - Aciona o processamento OCR para um canhoto.
    ◦ GET /api/receipts - Lista canhotos (com filtros por data, cliente, NF).
    ◦ GET /api/receipts/{id} - Obtém detalhes de um canhoto, incluindo link da imagem.
    ◦ GET /api/deliveries/{deliveryId}/receipt - Obtém canhoto associado a uma entrega.
5. Microsserviço de Rastreamento (tracking-service)
Gerencia a localização em tempo real e o histórico das rotas e eventos de rastreamento.
• Funcionalidades:
    ◦ Rastreamento de rota completa: Controla a rota do motorista.
    ◦ Visualização de localização: Permite ao Administrador, Supervisor/Operador e Cliente acompanhar motoristas em tempo real e ver a localização de todos.
    ◦ Alertas essenciais: Gera alertas para "Entrega realizada", "Motorista chegou no cliente", "Atraso na entrega", "Problema na entrega", "Rota finalizada", "Login de cada motorista".
• Endpoints REST (Exemplos):
    ◦ POST /api/tracking/location - Recebe atualizações de localização do motorista (GPS).
    ◦ GET /api/tracking/drivers/current-locations - Obtém a localização atual de todos os motoristas.
    ◦ GET /api/tracking/drivers/{driverId}/history - Obtém o histórico de rota de um motorista.
    ◦ POST /api/tracking/event - Registra eventos de rastreamento (chegada, entrega, problema).
6. Microsserviço de Relatórios (reports-service)
Responsável pela geração de todos os relatórios solicitados e consultas diárias.
• Funcionalidades:
    ◦ Geração de relatórios completos (Administrador): Entregas realizadas, Ocorrências, Comprovantes, Desempenho por Motorista, Monitoramento (Tracking), Por Cliente.
    ◦ Geração de relatórios básicos (Supervisor/Operador, Cliente):.
    ◦ Consultas do dia a dia: Status das entregas do dia, Quantas entregas cada motorista fez, Clientes que receberam, Problemas/avarias nas entregas.
• Endpoints REST (Exemplos):
    ◦ GET /api/reports/deliveries - Relatório de entregas realizadas (filtros: data, cliente, motorista, status).
    ◦ GET /api/reports/occurrences - Relatório de ocorrências (problemas, devoluções, reentregas, avarias).
    ◦ GET /api/reports/receipts-status - Relatório de comprovantes (com/sem comprovante, data/hora da foto).
    ◦ GET /api/reports/driver-performance - Relatório de desempenho por motorista.
    ◦ GET /api/reports/tracking-history - Relatório de monitoramento (histórico de rotas, paradas, tempo).
    ◦ GET /api/reports/client-volume - Relatório por cliente (volume/valor transportado).
    ◦ GET /api/reports/daily-status - Consulta diária do status das entregas.

--------------------------------------------------------------------------------
Tabelas do Banco de Dados MySQL
A estrutura do banco de dados MySQL deve suportar as funcionalidades dos microsserviços. As tabelas abaixo são propostas com base nos campos e requisitos mencionados nas fontes.
1. users
• Propósito: Armazena informações de login e tipo de todos os usuários do sistema.
• Campos:
    ◦ id (INT, PK, AUTO_INCREMENT)
    ◦ username (VARCHAR(100), UNIQUE, NOT NULL) - Pode ser CPF para motoristas, email para outros.
    ◦ password_hash (VARCHAR(255), NOT NULL) - Hash da senha.
    ◦ email (VARCHAR(100), UNIQUE)
    ◦ full_name (VARCHAR(255))
    ◦ user_type (ENUM('ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER', 'CLIENT'), NOT NULL)
    ◦ is_active (BOOLEAN, DEFAULT TRUE)
    ◦ created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
    ◦ updated_at (DATETIME, DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)
2. drivers
• Propósito: Armazena informações específicas dos motoristas, que são terceirizados.
• Campos:
    ◦ id (INT, PK, AUTO_INCREMENT)
    ◦ user_id (INT, FK para users.id, UNIQUE, NOT NULL)
    ◦ cpf (VARCHAR(14), UNIQUE, NOT NULL) - Também usado para login.
    ◦ phone_number (VARCHAR(20))
    ◦ tech_knowledge (ENUM('LOW', 'MEDIUM', 'HIGH'))
    ◦ is_outsourced (BOOLEAN, DEFAULT TRUE)
    ◦ created_at (DATETIME)
    ◦ updated_at (DATETIME)
3. vehicles
• Propósito: Armazena informações dos veículos.
• Campos:
    ◦ id (INT, PK, AUTO_INCREMENT)
    ◦ plate (VARCHAR(10), UNIQUE, NOT NULL) - Placa do veículo.
    ◦ model (VARCHAR(100))
    ◦ year (INT)
    ◦ created_at (DATETIME)
    ◦ updated_at (DATETIME)
4. clients
• Propósito: Armazena informações sobre os clientes da transportadora que terão acesso ao sistema.
• Campos:
    ◦ id (INT, PK, AUTO_INCREMENT)
    ◦ name (VARCHAR(255), UNIQUE, NOT NULL) - Ex: Di Salerno, Amendupã.
    ◦ cnpj (VARCHAR(18), UNIQUE)
    ◦ address (VARCHAR(255))
    ◦ created_at (DATETIME)
    ◦ updated_at (DATETIME)
5. client_users
• Propósito: Vincula usuários do tipo 'CLIENT' à sua respectiva empresa cliente.
• Campos:
    ◦ id (INT, PK, AUTO_INCREMENT)
    ◦ user_id (INT, FK para users.id, UNIQUE, NOT NULL)
    ◦ client_id (INT, FK para clients.id, NOT NULL)
    ◦ created_at (DATETIME)
    ◦ updated_at (DATETIME)
6. delivery_notes
• Propósito: Representa cada item de entrega, geralmente uma nota fiscal.
• Campos:
    ◦ id (INT, PK, AUTO_INCREMENT)
    ◦ nf_number (VARCHAR(50), NOT NULL) - Número da nota fiscal.
    ◦ client_id (INT, FK para clients.id, NULLABLE) - Cliente associado à NF.
    ◦ client_name_extracted (VARCHAR(255)) - Nome do Cliente extraído (se não houver client_id ou para fins de busca).
    ◦ delivery_address (VARCHAR(255), NOT NULL).
    ◦ delivery_volume (DECIMAL(10,2)).
    ◦ merchandise_value (DECIMAL(10,2)).
    ◦ products_description (TEXT).
    ◦ xml_data (TEXT) - XML completo da NF, vindo do SEFAZ.
    ◦ status (ENUM('PENDING', 'IN_TRANSIT', 'DELIVERED', 'REFUSED', 'REATTEMPTED', 'PROBLEM', 'CANCELED'), NOT NULL).
    ◦ delivery_date_expected (DATE) - Data de entrega esperada.
    ◦ delivery_date_actual (DATE) - Data da entrega real (do OCR ou manual).
    ◦ delivery_time_actual (TIME) - Horário da entrega real (do OCR ou manual).
    ◦ receiver_name (VARCHAR(255)) - Nome de quem recebeu (do OCR).
    ◦ receiver_document (VARCHAR(20)) - CPF/RG de quem recebeu (do OCR).
    ◦ observations (TEXT) - Observações/Avarias (do OCR ou manual).
    ◦ is_reattempt (BOOLEAN, DEFAULT FALSE) - Se foi reentrega.
    ◦ refusal_reason (TEXT) - Motivo da recusa, se aplicável.
    ◦ created_at (DATETIME)
    ◦ updated_at (DATETIME)
7. delivery_receipts
• Propósito: Armazena as imagens dos canhotos e os dados extraídos pelo OCR.
• Campos:
    ◦ id (INT, PK, AUTO_INCREMENT)
    ◦ delivery_note_id (INT, FK para delivery_notes.id, UNIQUE, NOT NULL) - Vincula ao item de entrega.
    ◦ image_url (VARCHAR(255), NOT NULL) - URL da imagem do canhoto.
    ◦ photo_datetime (DATETIME) - Data e hora da foto (do OCR ou metadados da imagem).
    ◦ captured_by_user_id (INT, FK para users.id) - Quem tirou a foto (motorista ou escritório).
    ◦ signature_image_url (VARCHAR(255)) - URL da assinatura (se extraída separadamente).
    ◦ ocr_extracted_data (JSON) - Armazena os dados brutos extraídos pelo OCR em formato JSON.
    ◦ created_at (DATETIME)
    ◦ updated_at (DATETIME)
8. routes
• Propósito: Gerencia as rotas diárias atribuídas aos motoristas.
• Campos:
    ◦ id (INT, PK, AUTO_INCREMENT)
    ◦ driver_id (INT, FK para drivers.id, NOT NULL)
    ◦ vehicle_id (INT, FK para vehicles.id, NULLABLE)
    ◦ start_datetime (DATETIME) - Momento em que o motorista "inicia o dia".
    ◦ end_datetime (DATETIME) - Momento em que o motorista "finaliza a rota".
    ◦ status (ENUM('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED'), NOT NULL)
    ◦ created_at (DATETIME)
    ◦ updated_at (DATETIME)
9. route_deliveries
• Propósito: Tabela de junção para associar múltiplas entregas a uma rota específica.
• Campos:
    ◦ route_id (INT, FK para routes.id, NOT NULL)
    ◦ delivery_note_id (INT, FK para delivery_notes.id, NOT NULL)
    ◦ sequence_in_route (INT) - Ordem das entregas na rota.
    ◦ created_at (DATETIME)
    ◦ (PK composta: route_id, delivery_note_id)
10. tracking_points
• Propósito: Armazena os pontos de rastreamento da rota completa.
• Campos:
    ◦ id (INT, PK, AUTO_INCREMENT)
    ◦ route_id (INT, FK para routes.id, NOT NULL)
    ◦ latitude (DECIMAL(10,8), NOT NULL)
    ◦ longitude (DECIMAL(11,8), NOT NULL)
    ◦ timestamp (DATETIME, NOT NULL)
    ◦ speed_kmh (DECIMAL(5,2))
    ◦ event_type (ENUM('LOCATION_UPDATE', 'STOP', 'ARRIVAL_CLIENT', 'DELIVERY_DONE', 'PROBLEM', 'ROUTE_STARTED', 'ROUTE_FINISHED', 'DRIVER_LOGIN'))
    ◦ associated_delivery_id (INT, FK para delivery_notes.id, NULLABLE) - Se o evento está ligado a uma entrega específica.
    ◦ created_at (DATETIME, DEFAULT CURRENT_TIMESTAMP)
11. notifications
• Propósito: Gerencia as notificações enviadas pelo sistema.
• Campos:
    ◦ id (INT, PK, AUTO_INCREMENT)
    ◦ user_id (INT, FK para users.id, NOT NULL) - Destinatário da notificação.
    ◦ type (VARCHAR(100), NOT NULL) - Tipo de alerta, ex: 'DELIVERY_DONE', 'DELAY'.
    ◦ message (TEXT, NOT NULL)
    ◦ status (ENUM('PENDING', 'SENT', 'READ', 'FAILED'), NOT NULL)
    ◦ sent_via (ENUM('WHATSAPP', 'EMAIL', 'APP_PUSH', 'SMS'), NOT NULL).
    ◦ related_entity_type (VARCHAR(50)) - Ex: 'DELIVERY', 'ROUTE'.
    ◦ related_entity_id (INT) - ID da entidade relacionada (e.g., delivery_note_id, route_id).
    ◦ created_at (DATETIME)
    ◦ sent_at (DATETIME)
    ◦ read_at (DATETIME)

--------------------------------------------------------------------------------
Considerações Adicionais:
• Offline Capability: Para a funcionalidade offline dos motoristas, o aplicativo móvel precisará de um banco de dados local (SQLite ou similar) e lógica de sincronização com o backend quando houver conexão. O backend precisa ser robusto para lidar com uploads em lote e resolução de conflitos.
• Tecnologias de Backend/Infraestrutura: A preferência é por hospedagem em Nuvem e uso de Docker App para Containers e CI/CD.
• Módulos Urgentes: O foco inicial deve ser no Upload de canhotos, Rastreamento e Relatórios para atender ao prazo de 60 dias para início de uso.
