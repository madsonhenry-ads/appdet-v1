# Guia de Ativação e Operação do Sistema de Recuperação de Vendas

**Autor:** Manus AI
**Data:** 24 de Fevereiro de 2026

## 1. Visão Geral do Sistema

O sistema de automação de e-mails de recuperação foi projetado para reengajar leads que não completaram uma compra. Ele opera em duas frentes: **leads novos**, que entram no funil em tempo real, e **leads antigos**, que já estão na sua base de dados. O sistema é composto por um backend (Node.js), um banco de dados (PostgreSQL) e o ActiveCampaign para o envio de e-mails.

A lógica principal é a seguinte:

1.  **Captura do Evento:** O sistema identifica quando um lead abandona o checkout, tem uma venda cancelada ou abandona o funil de vendas.
2.  **Segmentação e Gatilho:** O lead é marcado com uma tag específica no ActiveCampaign, de acordo com o evento e o idioma (EN/ES).
3.  **Início da Automação:** A tag ativa uma automação correspondente no ActiveCampaign, que por sua vez dispara o primeiro e-mail da sequência de recuperação.
4.  **Agendamento:** O backend agenda o envio dos e-mails 2, 3 e 4 em intervalos pré-definidos.
5.  **Envio Sequencial:** Um processo automático (cron job) verifica a cada 30 minutos se há e-mails agendados para serem enviados e os dispara.
6.  **Limpeza Automática:** Após o término da sequência (48 horas após o envio do último e-mail), o lead é automaticamente removido da lista de recuperação para não receber mais contatos sobre aquela oferta.


## 2. Processos Automáticos (Cron Jobs)

O sistema depende de dois processos automáticos (cron jobs) que rodam em segundo plano no servidor para garantir o funcionamento contínuo da automação. **Você não precisa fazer nenhuma configuração manual**, pois eles já estão implementados e ativos no `server.js` do backend.

-   **Processamento de E-mails Agendados:**
    -   **O que faz:** Verifica a cada **30 minutos** se há e-mails (2, 3 e 4) que precisam ser enviados com base no agendamento no banco de dados.
    -   **Status:** **ATIVO**. Este processo garante que a sequência de e-mails seja enviada nos intervalos corretos (24h, 72h, 120h).

-   **Limpeza de Contatos Concluídos:**
    -   **O que faz:** Roda a cada **6 horas** para encontrar contatos que já receberam os 4 e-mails da sequência e cujo período de espera de 48 horas já passou. Ele então remove a inscrição desses contatos da lista de recuperação no ActiveCampaign.
    -   **Status:** **ATIVO**. Este processo mantém sua base de contatos limpa e garante que os leads não recebam e-mails de recuperação indefinidamente.

> **Nota:** A configuração via `setInterval` no `server.js` funciona de maneira análoga a um cron job tradicional no ambiente do Railway, garantindo a execução periódica das tarefas.

## 3. Ativação para Novos Leads (Automações)

Para que os **novos leads** que entram no funil comecem a receber as sequências de recuperação automaticamente, você precisa ativar as 6 automações correspondentes no ActiveCampaign. Atualmente, elas estão marcadas como "Inativas".

### Como Funciona:

1.  **Gatilho Automático:** Quando um novo lead realiza uma ação (ex: abandona o checkout), o backend do Whats Spy automaticamente envia um evento para o ActiveCampaign.
2.  **Aplicação da Tag:** O ActiveCampaign, por sua vez, aplica a tag correspondente ao contato (ex: `Whats Spy-checkout-abandon-en`).
3.  **Início da Automação:** Esta tag serve como o **gatilho de entrada** para a automação de recuperação. Uma vez que a automação está ativa, o lead entra na sequência e o primeiro e-mail é enviado.

### Passo a Passo para Ativar as Automações:

Como o sistema já está totalmente configurado para enviar os eventos e aplicar as tags, a única ação manual necessária é ativar as automações no seu painel do ActiveCampaign.

1.  Acesse seu painel do ActiveCampaign.
2.  Navegue até a seção "Automations" (Automações).
3.  Você verá 6 automações com "Whats Spy" no nome, atualmente com o status "Inactive".
4.  Para cada uma dessas 6 automações, mude o status de **"Inactive"** para **"Active"**.

Uma vez ativadas, todas as automações mostrarão o status "Ativa" e começarão a processar os novos leads que entrarem no funil a partir daquele momento.

## 4. Disparo para Leads Antigos (Disparo em Lote)

Para a sua base de leads existente (aqueles que já estão no seu banco de dados mas nunca receberam a sequência de recuperação), você utilizará a funcionalidade de **Disparo em Lote** disponível no painel de administração do Whats Spy.

Esta ferramenta permite selecionar um segmento de leads (por categoria e idioma) e iniciar o envio da sequência de e-mails em lotes, de forma controlada.

### Como Usar o Disparo em Lote:

1.  Acesse o painel de administração do Whats Spy.
2.  Navegue até a aba **"Email Automations"**.
3.  Na seção **"Batch Dispatch"**, você encontrará as opções para iniciar os disparos.
4.  **Selecione a Categoria:** Escolha o segmento que deseja alcançar (ex: `Sale Cancelled`).
5.  **Selecione o Idioma:** Escolha o idioma (`EN` ou `ES`).
6.  **Defina o Tamanho do Lote:** O padrão é 500. Recomenda-se manter este número ou usar lotes menores para começar.
7.  **Clique em "Start Dispatch"**: O sistema começará a processar o lote de leads, enviando o primeiro e-mail e agendando os demais.

### Estratégia Recomendada para o Disparo em Lote:

Para garantir a melhor entregabilidade e monitorar os resultados, siga esta estratégia:

1.  **Comece com Lotes Pequenos:** Inicie com um lote de 500 leads para aquecer a reputação do envio em massa.
2.  **Priorize os Segmentos:** A ordem de prioridade recomendada é:
    1.  **Sale Cancelled:** Leads que demonstraram forte intenção de compra.
    2.  **Checkout Abandon:** Leads que chegaram até o checkout.
    3.  **Funnel Abandon:** Leads no topo do funil.
3.  **Monitore os Resultados:** Acompanhe o status do disparo no próprio painel de administração. A seção "Dispatch History" e "Dispatch Stats" mostrará o progresso, quantos e-mails foram enviados, quantos estão pendentes e se ocorreram erros.
4.  **Aguarde o Intervalo:** Aguarde a conclusão de um lote antes de iniciar o próximo para não sobrecarregar o sistema de envio.

## 5. Conclusão

Com as automações ativas para novos leads e o uso estratégico do disparo em lote para leads antigos, seu sistema de recuperação de vendas estará 100% operacional. Lembre-se de monitorar os resultados no painel de administração para otimizar suas campanhas e maximizar a recuperação de receita.
