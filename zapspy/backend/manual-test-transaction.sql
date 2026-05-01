-- Script para criar transação aprovada manualmente no Supabase
-- Isso vai acionar o fluxo de envio de magic link via ActiveCampaign

-- Atualizar/criar transação manualmente
INSERT INTO transactions (
    transaction_id,
    email,
    phone,
    name,
    product,
    value,
    monetizze_status,
    status,
    raw_data,
    created_at,
    updated_at
) VALUES (
    -- Identificador único
    'MANUAL_TEST_' || generate_series(1, 1000),

    -- Email do comprador
    'messiasbolsonaro351@gmail.com',

    -- Telefone (opcional)
    '+5511999999999',

    -- Nome
    'Messias',

    -- Produto
    'Whats Spy - Brazilian Monitoring',

    -- Valor
    '97.90',

    -- Status do Monetizze
    'aprovado',

    -- Status da transação (aprovado = buyer tag será acionada)
    'approved',

    -- Dados brutos do postback
    '{"source": "manual_test", "test": true}',

    -- Timestamps
    NOW(),
    NOW()
)
ON CONFLICT (transaction_id) DO NOTHING;

-- Verificar se a transação foi criada
SELECT
    id,
    email,
    name,
    product,
    value,
    status,
    created_at,
    updated_at
FROM transactions
WHERE email = 'messiasbolsonaro351@gmail.com'
ORDER BY created_at DESC
LIMIT 1;
