# Configuração do Email de Boas Vindas (Compra Aprovada)

## Problema Identificado

O placeholder `%MAGIC_LINK%` não estava sendo substituído na URL final. O código foi atualizado para:

1. Criar/verificar um campo customizado chamado **"Magic Link"** no ActiveCampaign
2. Enviar o **URL real** do magic link para esse campo (não o placeholder)

## O Que Precisa ser Configurado no ActiveCampaign

### 1. Criar Campo Customizado "Magic Link"

Se ainda não existe, crie um campo customizado:

1. Entre no ActiveCampaign: `https://matheus0597.activehosted.com/app/`
2. Vá em **Integrações > Campos Personalizados**
3. Crie um novo campo:
   - **Nome do campo:** Magic Link
   - **Tipo:** Texto
   - **Descrição:** Magic link URL para acesso à área de membros
   - **Ser usado como:** Não (neste campo)

### 2. Configurar a Automation "Whats Spy - Compra aprovada - EN"

A automation precisa estar configurada para:

#### Trigger
- Quando o contato receber a tag: **Whats Spy-buyer-en**

#### Email Sequence
Adicione um email inicial que usa o campo customizado:

**Email 1 - Welcome (Delayed)**
- **Assunto:** Welcome to Whats Spy! Access your dashboard
- **Pré-header:** Your monitoring service is ready
- **Atraso:** 0 minutes (ou 5-10 minutos para testar)
- **Configuração do bloco "Send Email":**
  - **Subject:** Welcome to Whats Spy! Access your dashboard
  - **Preheader:** Your monitoring service is ready
  - **Body (HTML):**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Whats Spy</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 40px 20px; margin: 0;">

  <!-- Content -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center" style="margin:auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <tbody>
      <tr>
        <td style="padding: 40px 30px; text-align: center;">

          <!-- Logo/Icon -->
          <h1 style="color: #2962FF; font-size: 32px; margin-bottom: 20px;">🕵️ Whats Spy</h1>

          <!-- Heading -->
          <h2 style="color: #333333; font-size: 24px; margin-bottom: 20px;">Welcome to Your Dashboard!</h2>

          <!-- Body Text -->
          <p style="color: #555555; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            Your Whats Spy monitoring service is ready. Access your dashboard to view all the information we've gathered.
          </p>

          <!-- CTA Button -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 30px;">
            <tbody>
              <tr>
                <td style="text-align: center;">
                  <a href="${Magic Link}" target="_blank" style="display: inline-block; padding: 16px 40px; background-color: #2962FF; color: #ffffff; font-family: Arial, sans-serif; font-size: 16px; font-weight: bold; text-decoration: none; border-radius: 8px; letter-spacing: 0.5px; text-transform: uppercase;">
                    ACCESS MY DASHBOARD
                  </a>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Reassurance -->
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 40px;">
            <tbody>
              <tr>
                <td style="text-align: center;">
                  <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #999999;">
                    🔒 Secure SSL Access &nbsp;•&nbsp; ✅ 100% Confidential &nbsp;•&nbsp; 💡 Priority Support
                  </p>
                </td>
              </tr>
            </tbody>
          </table>

        </td>
      </tr>
    </tbody>
  </table>

  <!-- Footer -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center" style="margin: 20px auto 0;">
    <tbody>
      <tr>
        <td style="text-align: center;">
          <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #999999;">
            If you didn't subscribe to Whats Spy, you can ignore this email.
          </p>
        </td>
      </tr>
    </tbody>
  </table>

</body>
</html>
```

**⚠️ IMPORTANTE:**
- Use `${Magic Link}` (com espaço) como placeholder
- Não use `%MAGIC_LINK%` (com %)

### 3. Ativar a Automation

1. Vá em **Automations**
2. Encontre "Whats Spy - Compra aprovada - EN"
3. Clique em **Activate** (ativar)

### 4. Testar

Fazer um teste de compra aprovada para verificar:

1. O magic link é gerado corretamente no backend
2. O campo "Magic Link" é atualizado no ActiveCampaign
3. A automation é acionada
4. O email contém o link real e não o placeholder

## Como Verificar no Backend

Após a atualização, observe os logs:

```
📧 AC: Found magic link field (ID: 123)
📧 AC: Magic link for user@email.com: https://supabase-project.supabase.co/auth/v1/verify...
📧 AC: Field values being sent: [{"field":"123","value":"https://supabase-project.supabase.co/auth/v1/verify..."}]
📧 AC: Contact synced: user@email.com (id: 456)
📧 AC: Buyer tag for en: Whats Spy-buyer-en
📧 AC: Tag "Whats Spy-buyer-en" added to user@email.com
📧 AC: Welcome email should be triggered for user@email.com (en)
```

## Se ainda tiver problemas

1. **Verifique se a automation está ativa**
2. **Verifique se o email está configurado corretamente com `${Magic Link}`**
3. **Verifique os logs do backend para ver se o magic link está sendo enviado**
4. **No ActiveCampaign, verifique o contato individual para ver o valor do campo "Magic Link"**

## Alternativa: Criar automation via API

Se preferir, o campo customizado "Magic Link" será criado automaticamente quando o backend encontrar, então não precisa criar manualmente. Apenas certifique-se de que a automation existe e esteja configurada corretamente.
