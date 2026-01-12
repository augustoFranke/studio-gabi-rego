/**
 * Cliente para Resend (Email)
 * Documentação: https://resend.com/docs
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY

interface EnviarEmailParams {
  para: string
  assunto: string
  html: string
  texto?: string
}

interface EnviarEmailResponse {
  success: boolean
  id?: string
  error?: string
}

/**
 * Verifica se o Resend está configurado
 */
export function isResendConfigured(): boolean {
  return Boolean(RESEND_API_KEY)
}

/**
 * Envia um email via Resend
 */
export async function enviarEmail({
  para,
  assunto,
  html,
  texto,
}: EnviarEmailParams): Promise<EnviarEmailResponse> {
  if (!isResendConfigured()) {
    console.warn('Resend não configurado')
    return { success: false, error: 'Resend não configurado' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Gabi Studio <noreply@gabistudio.com.br>',
        to: para,
        subject: assunto,
        html,
        text: texto,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Erro ao enviar email:', error)
      return { success: false, error }
    }

    const data = await response.json()
    return { success: true, id: data.id }
  } catch (error) {
    console.error('Erro ao enviar email:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

/**
 * Templates de email em HTML
 */
export const emailTemplates = {
  lembreteAula: (nome: string, horario: string, data: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .info { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Gabi Studio</h1>
        </div>
        <div class="content">
          <p>Olá <strong>${nome}</strong>!</p>
          <p>Este é um lembrete da sua aula agendada:</p>
          <div class="info">
            <p>📅 <strong>Data:</strong> ${data}</p>
            <p>⏰ <strong>Horário:</strong> ${horario}</p>
          </div>
          <p>Te esperamos! 💪</p>
        </div>
        <div class="footer">
          <p>Gabi Studio - Seu estúdio de Pilates</p>
        </div>
      </div>
    </body>
    </html>
  `,

  cobranca: (nome: string, valor: string, vencimento: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .info { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Gabi Studio</h1>
        </div>
        <div class="content">
          <p>Olá <strong>${nome}</strong>!</p>
          <p>Este é um lembrete sobre seu pagamento:</p>
          <div class="info">
            <p>💰 <strong>Valor:</strong> ${valor}</p>
            <p>📅 <strong>Vencimento:</strong> ${vencimento}</p>
          </div>
          <p>Qualquer dúvida, estamos à disposição!</p>
        </div>
        <div class="footer">
          <p>Gabi Studio - Seu estúdio de Pilates</p>
        </div>
      </div>
    </body>
    </html>
  `,

  boasVindas: (nome: string) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #7c3aed; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Bem-vindo(a) ao Gabi Studio!</h1>
        </div>
        <div class="content">
          <p>Olá <strong>${nome}</strong>!</p>
          <p>Seja muito bem-vindo(a) ao Gabi Studio!</p>
          <p>Estamos muito felizes em ter você conosco. Nossa equipe está pronta para ajudá-lo(a) a alcançar seus objetivos.</p>
          <p>Qualquer dúvida, é só entrar em contato!</p>
          <p>Vamos juntos nessa jornada! 💪</p>
        </div>
        <div class="footer">
          <p>Gabi Studio - Seu estúdio de Pilates</p>
        </div>
      </div>
    </body>
    </html>
  `,
}

