# Whats Spy - Sistema de Recuperação de Vendas (ActiveCampaign)

Este documento detalha a arquitetura e o funcionamento do sistema de recuperação de vendas e abandono de funil para o Whats Spy, utilizando automações de email via ActiveCampaign e um painel de administração integrado.

## 1. Visão Geral do Sistema

O sistema foi projetado para recuperar vendas perdidas e engajar leads que abandonaram o funil em diferentes estágios. Ele opera com base em tags aplicadas aos contatos no ActiveCampaign, que disparam sequências de email marketing automatizadas e personalizadas.

O sistema é composto por três partes principais:

1.  **Automações no ActiveCampaign**: Seis automações de email que reagem a diferentes eventos do usuário (abandono de checkout, cancelamento de venda, abandono de funil).
2.  **Backend (Node.js/Express)**: Uma API que gerencia a lógica de negócio, se comunica com a API do ActiveCampaign e serve o painel de administração.
3.  **Frontend (HTML/CSS/JS)**: Um painel de administração completo para monitorar e gerenciar as automações de email, contatos e métricas de recuperação.

## 2. Configuração no ActiveCampaign

Foram criadas e configuradas 6 automações principais, cada uma com um gatilho (trigger) específico baseado em tags. Cada automação contém uma sequência de 4 emails.

### Automações Criadas

| ID | Nome da Automação                       | Gatilho (Tag)                     | Idioma |
|----|-----------------------------------------|-----------------------------------|--------|
| 31 | Whats Spy - Recovery Checkout Abandon EN   | `Whats Spy-checkout-abandon-en`      | EN     |
| 32 | Whats Spy - Recovery Checkout Abandon ES   | `Whats Spy-checkout-abandon-es`      | ES     |
| 35 | Whats Spy - Recovery Sale Cancelled EN     | `Whats Spy-sale-cancelled-en`        | EN     |
| 36 | Whats Spy - Recovery Sale Cancelled ES     | `Whats Spy-sale-cancelled-es`        | ES     |
| 37 | Whats Spy - Recovery Funnel Abandon EN     | `Whats Spy-lead-en`                  | EN     |
| 38 | Whats Spy - Recovery Funnel Abandon ES     | `Whats Spy-lead-es`                  | ES     |

### Mensagens de Email

Foram criadas 24 mensagens de email (4 para cada automação) via API do ActiveCampaign (IDs 256 a 279). O conteúdo de cada email é pré-definido e alinhado com o estágio de recuperação do contato.

## 3. Configuração do Backend

O backend é responsável por toda a comunicação com o ActiveCampaign e por servir o painel de administração.

### Variáveis de Ambiente

Para que o sistema funcione, as seguintes variáveis de ambiente devem ser configuradas no ambiente de produção (ex: Railway):

```
AC_API_URL="https://<sua-conta>.api-us1.com"
AC_API_KEY="<sua-chave-de-api>"
```

- `AC_API_URL`: A URL base da sua API do ActiveCampaign.
- `AC_API_KEY`: Sua chave de API v3 do ActiveCampaign.

### Novas Rotas da API

Um novo arquivo de rotas foi criado em `backend/src/routes/admin-activecampaign.js` para gerenciar todas as operações relacionadas ao ActiveCampaign no painel de administração.

- `GET /api/admin/ac/dashboard`: Retorna um overview completo com estatísticas, automações, tags e listas.
- `PUT /api/admin/ac/automations/:id/activate|deactivate`: Ativa ou desativa uma automação específica.
- `GET /api/admin/ac/contacts`: Lista e busca contatos no ActiveCampaign.
- `POST /api/admin/ac/contacts/add`: Adiciona um novo contato e aplica a tag correspondente para iniciar uma automação (ideal para testes).

## 4. Painel de Administração - Email Automations

Uma nova aba, **"Email Automations"**, foi adicionada ao painel de administração existente (`admin.html`). Esta seção oferece controle total sobre o sistema de recuperação de emails.

### Funcionalidades do Painel

1.  **Dashboard de KPIs**: Visualização rápida das métricas mais importantes:
    *   **Status da Conexão**: Verifica se a API do ActiveCampaign está configurada e acessível.
    *   **Total de Automações**: Número de automações de recuperação Whats Spy ativas.
    *   **Automações Ativas**: Quantas das automações estão atualmente habilitadas.
    *   **Contatos Entrados**: Total de contatos que entraram em alguma das automações.
    *   **Tags Whats Spy**: Total de tags relacionadas ao Whats Spy.
    *   **Contatos Total**: Número total de contatos na conta do ActiveCampaign.

2.  **Tabela de Automações**: Lista todas as 6 automações de recuperação com as seguintes informações e ações:
    *   **Status**: Mostra se a automação está `Ativa` ou `Inativa`.
    *   **Nome, Tipo e Idioma**: Detalhes da automação.
    *   **Entrados/Saídos**: Número de contatos que entraram e saíram da automação.
    *   **Ações**: Botões para `Ativar`/`Desativar` a automação e um link para abri-la diretamente no ActiveCampaign.

3.  **Adicionar Contato (para Teste)**: Um modal permite adicionar um contato manualmente, especificando o email, nome, tipo de evento (Lead, Checkout, Cancelamento) e idioma. O sistema automaticamente aplica a tag correta para disparar a automação correspondente.

4.  **Listagem de Tags e Listas**: Exibe todas as tags e listas de contatos relacionadas ao Whats Spy para fácil referência.

5.  **Tabela de Contatos Recentes**: Mostra os contatos mais recentes na conta, com funcionalidade de busca por email e paginação.

## 5. Como Usar

1.  **Acesse o Painel**: Faça login no painel de administração do Whats Spy.
2.  **Navegue até a Aba**: Clique em **"Email Automations"** no menu lateral.
3.  **Monitore**: Acompanhe os KPIs e o status das automações.
4.  **Gerencie**: Ative ou desative automações conforme a necessidade diretamente pela tabela.
5.  **Teste**: Use o botão **"Adicionar Contato"** para simular a entrada de um lead em qualquer um dos funis de recuperação e verificar se os emails estão sendo disparados corretamente.
