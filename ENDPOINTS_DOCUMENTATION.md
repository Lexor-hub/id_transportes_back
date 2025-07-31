# Documentação dos Endpoints da API - ID Transportes

Este documento descreve todos os endpoints REST disponíveis nos microserviços do backend, com exemplos e explicações para integração do front-end.

---

## Auth/Users Service (porta 3001)

### POST `/api/auth/login`
- **Descrição:** Realiza login de usuário.
- **Body:**
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Resposta 200:** `{ "token": "JWT" }`
- **Resposta 401:** `{ "error": "Usuário não encontrado" | "Senha inválida" }`

### POST `/api/auth/forgot-password`
- **Descrição:** Solicita recuperação de senha (simulado).
- **Body:** `{ "username": "string" }`
- **Resposta 200:** Mensagem de instrução (simulado)

### POST `/api/users` *(ADMIN)*
- **Descrição:** Cria novo usuário.
- **Headers:** `Authorization: Bearer <token ADMIN>`
- **Body:**
  ```json
  {
    "username": "string",
    "password": "string",
    "email": "string",
    "full_name": "string",
    "user_type": "ADMIN|SUPERVISOR|OPERATOR|DRIVER|CLIENT"
  }
  ```
- **Resposta 201:** `{ "message": "Usuário criado" }`
- **Validações:** Username único, senha forte

### PUT `/api/users/:id/password`
- **Descrição:** Troca a senha do usuário.
- **Headers:** `Authorization: Bearer <token>`
- **Body:** `{ "oldPassword": "string", "newPassword": "string" }`
- **Resposta 200:** `{ "message": "Senha alterada com sucesso" }`

### GET `/api/users/:id`
- **Descrição:** Detalhes do usuário.
- **Resposta 200:** Objeto usuário

### PUT `/api/users/:id`
- **Descrição:** Atualiza dados do usuário.
- **Body:** `{ "email": "string", "full_name": "string", "user_type": "string", "is_active": true|false }`
- **Resposta 200:** `{ "message": "Usuário atualizado" }`

### DELETE `/api/users/:id`
- **Descrição:** Desativa usuário.
- **Resposta 200:** `{ "message": "Usuário desativado" }`

---

## Drivers/Vehicles Service (porta 3002)

### POST `/api/drivers` *(ADMIN/SUPERVISOR)*
- **Descrição:** Cadastra motorista.
- **Headers:** `Authorization: Bearer <token ADMIN/SUPERVISOR>`
- **Body:** `{ "user_id": int, "cpf": "string", "phone_number": "string", "tech_knowledge": "string" }`
- **Resposta 201:** `{ "message": "Motorista cadastrado" }`

### GET `/api/drivers`
- **Descrição:** Lista todos os motoristas.
- **Resposta 200:** Array de motoristas

### GET `/api/drivers/:id`
- **Descrição:** Detalhes do motorista.
- **Resposta 200:** Objeto motorista

### PUT `/api/drivers/:id` *(ADMIN/SUPERVISOR)*
- **Descrição:** Atualiza motorista.
- **Body:** `{ "phone_number": "string", "tech_knowledge": "string", "is_outsourced": true|false }`
- **Resposta 200:** `{ "message": "Motorista atualizado" }`

### POST `/api/vehicles` *(ADMIN/SUPERVISOR)*
- **Descrição:** Cadastra veículo.
- **Body:** `{ "plate": "string", "model": "string", "year": int }`
- **Resposta 201:** `{ "message": "Veículo cadastrado" }`

### GET `/api/vehicles`
- **Descrição:** Lista todos os veículos.
- **Resposta 200:** Array de veículos

### GET `/api/vehicles/:id`
- **Descrição:** Detalhes do veículo.
- **Resposta 200:** Objeto veículo

### PUT `/api/vehicles/:id` *(ADMIN/SUPERVISOR)*
- **Descrição:** Atualiza veículo.
- **Body:** `{ "model": "string", "year": int }`
- **Resposta 200:** `{ "message": "Veículo atualizado" }`

---

## Deliveries/Routes Service (porta 3003)

### POST `/api/sefaz/import-xml`
- **Descrição:** Importa XML de nota fiscal do SEFAZ.
- **FormData:** `xml` (arquivo XML)
- **Resposta 200:** `{ "message": "XML importado com sucesso", ...dados extraídos }`

### POST `/api/deliveries` *(ADMIN)*
- **Descrição:** Cadastra entrega.
- **Body:** `{ "nf_number": "string", "client_id": int, "delivery_address": "string", "delivery_volume": int, "merchandise_value": float, "products_description": "string", "status": "string", "delivery_date_expected": "YYYY-MM-DD" }`
- **Resposta 201:** `{ "message": "Entrega cadastrada" }`

### GET `/api/deliveries`
- **Descrição:** Lista entregas (filtros: `data`, `cliente`, `status`).
- **Resposta 200:** Array de entregas

### GET `/api/deliveries/:id`
- **Descrição:** Detalhes da entrega.
- **Resposta 200:** Objeto entrega

### PUT `/api/deliveries/:id/status`
- **Descrição:** Atualiza status da entrega.
- **Body:** `{ "status": "string" }`
- **Resposta 200:** `{ "message": "Status atualizado" }`

### PUT `/api/deliveries/:id/occurrence`
- **Descrição:** Registra ocorrência na entrega.
- **Body:** `{ "is_reattempt": true|false, "refusal_reason": "string", "observations": "string" }`
- **Resposta 200:** `{ "message": "Ocorrência registrada" }`

### POST `/api/routes` *(ADMIN)*
- **Descrição:** Cria rota.
- **Body:** `{ "driver_id": int, "vehicle_id": int, "status": "string" }`
- **Resposta 201:** `{ "message": "Rota criada" }`

### GET `/api/routes`
- **Descrição:** Lista rotas.
- **Resposta 200:** Array de rotas

### POST `/api/routes/:id/start-day`
- **Descrição:** Inicia o dia do motorista.
- **Resposta 200:** `{ "message": "Dia iniciado" }`

### POST `/api/routes/:id/start-route`
- **Descrição:** Inicia rota.
- **Resposta 200:** `{ "message": "Rota iniciada" }`

### POST `/api/routes/:id/finish-route`
- **Descrição:** Finaliza rota.
- **Resposta 200:** `{ "message": "Rota finalizada" }`

### GET `/api/drivers/:driverId/today-deliveries`
- **Descrição:** Entregas do motorista no dia.
- **Resposta 200:** Array de entregas

---

## Receipts/OCR Service (porta 3004)

### POST `/api/receipts/upload`
- **Descrição:** Upload de canhoto (imagem).
- **FormData:** `file` (imagem), `delivery_note_id`, `captured_by_user_id`
- **Resposta 201:** `{ "message": "Canhoto enviado", "image_url": "string" }`

### GET `/api/receipts`
- **Descrição:** Lista todos os canhotos.
- **Resposta 200:** Array de canhotos

### POST `/api/receipts/:id/process-ocr`
- **Descrição:** Processa OCR do canhoto e extrai campos obrigatórios.
- **Resposta 200:** `{ "message": "OCR realizado com sucesso", "ocrData": { ... } }`

### GET `/api/receipts/:id`
- **Descrição:** Detalhes do canhoto.
- **Resposta 200:** Objeto canhoto

### GET `/api/deliveries/:deliveryId/receipt`
- **Descrição:** Busca canhoto de uma entrega.
- **Resposta 200:** Objeto canhoto

---

## Tracking Service (porta 3005)

### POST `/api/tracking/location`
- **Descrição:** Registra localização do motorista.
- **Body:** `{ "route_id": int, "latitude": float, "longitude": float, "timestamp": "string", "speed_kmh": float, "event_type": "string", "associated_delivery_id": int }`
- **Resposta 201:** `{ "message": "Localização registrada" }`

### GET `/api/tracking/drivers/:driverId/history`
- **Descrição:** Histórico de rota do motorista.
- **Resposta 200:** Array de pontos de rastreamento

### GET `/api/tracking/drivers/current-locations`
- **Descrição:** Localização atual de todos os motoristas.
- **Resposta 200:** Array de localizações

### POST `/api/tracking/event`
- **Descrição:** Registra evento de rastreamento.
- **Body:** `{ "route_id": int, "event_type": "string", "associated_delivery_id": int }`
- **Resposta 201:** `{ "message": "Evento registrado" }`

---

## Reports Service (porta 3006)

### GET `/api/reports/deliveries`
- **Descrição:** Relatório de entregas realizadas (filtros: `data`, `cliente`, `motorista`, `status`).
- **Resposta 200:** Array de entregas

### GET `/api/reports/occurrences`
- **Descrição:** Relatório de ocorrências (entregas com problema, recusadas ou reentregues).
- **Resposta 200:** Array de entregas

### GET `/api/reports/receipts-status`
- **Descrição:** Relatório de comprovantes (canhotos).
- **Resposta 200:** Array de comprovantes

### GET `/api/reports/driver-performance`
- **Descrição:** Relatório de desempenho por motorista.
- **Resposta 200:** Array de motoristas com total de entregas

### GET `/api/reports/tracking-history`
- **Descrição:** Histórico de rastreamento (todos os pontos).
- **Resposta 200:** Array de pontos

### GET `/api/reports/client-volume`
- **Descrição:** Relatório de volume por cliente.
- **Resposta 200:** Array de clientes com total de entregas e valor total

### GET `/api/reports/daily-status`
- **Descrição:** Status diário das entregas.
- **Resposta 200:** Array de status com total

---

**Observações Gerais:**
- Endpoints protegidos exigem o header `Authorization: Bearer <token>`.
- Todos os endpoints retornam erros no formato `{ "error": "mensagem" }`.
- Para detalhes de parâmetros, consulte o Swagger de cada serviço (`/api-docs`). 