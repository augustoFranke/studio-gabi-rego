/**
 * Cliente para Resend (Email)
 * Documentação: https://resend.com/docs
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const escapeHtmlOptional = (value?: string | null) =>
  value ? escapeHtml(value) : ""

const stripHtml = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")

const buildTextFallback = (html: string) =>
  decodeHtmlEntities(stripHtml(html))
    .replace(/\s+/g, " ")
    .trim()

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
    const plainText = texto?.trim() ? texto : buildTextFallback(html)

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Studio Gabi Rego <suporte@studiogabirego.com>',
        reply_to: 'suporte@studiogabirego.com',
        to: para,
        subject: assunto,
        html,
        text: plainText,
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
  verificacaoEmail: (nome: string | null, linkVerificacao: string) => {
    const safeNome = escapeHtmlOptional(nome)
    const safeLink = escapeHtml(linkVerificacao)

    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Verifique seu email - Studio Gabi Rego</title>
      <!--[if mso]>
      <noscript>
        <xml>
          <o:OfficeDocumentSettings>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
        </xml>
      </noscript>
      <![endif]-->
    </head>
    <body style="margin: 0; padding: 0; background-color: #faf5f0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #faf5f0;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px;">
              <!-- Logo Section -->
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  <img src="https://studiogabirego.com/logo.png" alt="Studio Gabi Rego" width="120" style="display: block; border: 0; max-width: 120px; height: auto;">
                </td>
              </tr>
              <!-- Main Card -->
              <tr>
                <td>
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(234, 88, 12, 0.08); overflow: hidden;">
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); padding: 32px 40px; text-align: center;">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td align="center">
                              <div style="width: 56px; height: 56px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px auto; display: flex; align-items: center; justify-content: center;">
                                <span style="display: inline-block; font-size: 20px; font-weight: 700; color: #ffffff; line-height: 1;">@</span>
                              </div>
                              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Verifique seu email</h1>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #1f1f1f;">
                          Olá${safeNome ? ` <strong style="color: #ea580c;">${safeNome}</strong>` : ''}!
                        </p>
                        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #444444;">
                          Obrigado por se cadastrar no <strong>Studio Gabi Rego</strong>!
                        </p>
                        <p style="margin: 0 0 28px 0; font-size: 16px; line-height: 1.6; color: #444444;">
                          Para continuar com seu cadastro, por favor verifique seu email clicando no botão abaixo:
                        </p>
                        <!-- CTA Button -->
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td align="center">
                              <table role="presentation" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td style="border-radius: 10px; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);">
                                    <a href="${safeLink}" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px;">
                                      Verificar meu email
                                    </a>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        <!-- Divider -->
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0;">
                          <tr>
                            <td style="border-top: 1px solid #f0e6dd;"></td>
                          </tr>
                        </table>
                        <!-- Warning Box -->
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px;">
                          <tr>
                            <td style="padding: 16px;">
                              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                  <td width="24" valign="top" style="padding-right: 12px;">
                                    <span style="display: inline-block; width: 18px; height: 18px; border-radius: 50%; border: 1px solid #92400e; color: #92400e; line-height: 18px; text-align: center; font-size: 12px; font-weight: 700;">!</span>
                                  </td>
                                  <td>
                                    <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #92400e;">
                                      <strong>Importante:</strong> Este link é válido por 1 hora. Se você não solicitou este cadastro, pode ignorar este email com segurança.
                                    </p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        <!-- Alternative Link -->
                        <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.5; color: #888888; text-align: center;">
                          Se o botão não funcionar, copie e cole este link no seu navegador:<br>
                          <a href="${safeLink}" style="color: #ea580c; word-break: break-all;">${safeLink}</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 32px 20px; text-align: center;">
                  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #ea580c;">
                    Studio Gabi Rego
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
  },

  redefinirSenha: (nome: string | null, linkRedefinir: string) => {
    const safeNome = escapeHtmlOptional(nome)
    const safeLink = escapeHtml(linkRedefinir)

    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Redefinir Senha - Studio Gabi Rego</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #faf5f0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #faf5f0;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px;">
              <!-- Logo Section -->
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  <img src="https://studiogabirego.com/logo.png" alt="Studio Gabi Rego" width="120" style="display: block; border: 0; max-width: 120px; height: auto;">
                </td>
              </tr>
              <!-- Main Card -->
              <tr>
                <td>
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(234, 88, 12, 0.08); overflow: hidden;">
                    <!-- Header -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); padding: 32px 40px; text-align: center;">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td align="center">
                              <div style="width: 56px; height: 56px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px auto; display: flex; align-items: center; justify-content: center;">
                                <span style="display: inline-block; font-size: 16px; font-weight: 700; color: #ffffff; line-height: 1;">PW</span>
                              </div>
                              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Redefinir Senha</h1>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px;">
                        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #1f1f1f;">
                          Olá${safeNome ? ` <strong style="color: #ea580c;">${safeNome}</strong>` : ''}!
                        </p>
                        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #444444;">
                          Recebemos uma solicitação para redefinir sua senha no <strong>Studio Gabi Rego</strong>.
                        </p>
                        <p style="margin: 0 0 28px 0; font-size: 16px; line-height: 1.6; color: #444444;">
                          Para criar uma nova senha, clique no botão abaixo:
                        </p>
                        <!-- CTA Button -->
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td align="center">
                              <table role="presentation" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td style="border-radius: 10px; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);">
                                    <a href="${safeLink}" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px;">
                                      Redefinir minha senha
                                    </a>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        <!-- Divider -->
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0;">
                          <tr>
                            <td style="border-top: 1px solid #f0e6dd;"></td>
                          </tr>
                        </table>
                        <!-- Warning Box -->
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px;">
                          <tr>
                            <td style="padding: 16px;">
                              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                  <td width="24" valign="top" style="padding-right: 12px;">
                                    <span style="display: inline-block; width: 18px; height: 18px; border-radius: 50%; border: 1px solid #92400e; color: #92400e; line-height: 18px; text-align: center; font-size: 12px; font-weight: 700;">!</span>
                                  </td>
                                  <td>
                                    <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #92400e;">
                                      <strong>Importante:</strong> Este link é válido por 1 hora. Se você não solicitou a redefinição de senha, pode ignorar este email com segurança.
                                    </p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        <!-- Alternative Link -->
                        <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.5; color: #888888; text-align: center;">
                          Se o botão não funcionar, copie e cole este link no seu navegador:<br>
                          <a href="${safeLink}" style="color: #ea580c; word-break: break-all;">${safeLink}</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 32px 20px; text-align: center;">
                  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #ea580c;">
                    Studio Gabi Rego
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
  },

  boasVindas: (nome: string) => {
    const safeNome = escapeHtml(nome)

    return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Bem-vindo(a) - Studio Gabi Rego</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #faf5f0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #faf5f0;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px;">
              <tr>
                <td align="center" style="padding-bottom: 24px;">
                  <img src="https://studiogabirego.com/logo.png" alt="Studio Gabi Rego" width="120" style="display: block; border: 0; max-width: 120px; height: auto;">
                </td>
              </tr>
              <tr>
                <td>
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 24px rgba(234, 88, 12, 0.08); overflow: hidden;">
                    <tr>
                      <td style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); padding: 32px 40px; text-align: center;">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td align="center">
                              <div style="width: 56px; height: 56px; background-color: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 16px auto; display: flex; align-items: center; justify-content: center;">
                                <span style="display: inline-block; font-size: 20px; font-weight: 700; color: #ffffff; line-height: 1;">+</span>
                              </div>
                              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Bem-vindo(a)</h1>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 40px;">
                        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #1f1f1f;">
                          Olá <strong style="color: #ea580c;">${safeNome}</strong>!
                        </p>
                        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #444444;">
                          Seja muito bem-vindo(a) ao <strong>Studio Gabi Rego</strong>!
                        </p>
                        <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: #444444;">
                          Estamos muito felizes em ter você conosco. Nossa equipe está pronta para ajudá-lo(a) a alcançar seus objetivos.
                        </p>
                        <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 1.6; color: #444444;">
                          Qualquer dúvida, é só entrar em contato!
                        </p>
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td align="center">
                              <table role="presentation" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td style="border-radius: 10px; background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); box-shadow: 0 4px 14px rgba(234, 88, 12, 0.35);">
                                    <a href="https://studiogabirego.com" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 10px;">
                                      Acessar o site
                                    </a>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0;">
                          <tr>
                            <td style="border-top: 1px solid #f0e6dd;"></td>
                          </tr>
                        </table>
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px;">
                          <tr>
                            <td style="padding: 16px;">
                              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                  <td width="24" valign="top" style="padding-right: 12px;">
                                    <span style="display: inline-block; width: 18px; height: 18px; border-radius: 50%; border: 1px solid #92400e; color: #92400e; line-height: 18px; text-align: center; font-size: 12px; font-weight: 700;">!</span>
                                  </td>
                                  <td>
                                    <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #92400e;">
                                      <strong>Importante:</strong> Se precisar de ajuda, responda este email ou fale conosco pelo site.
                                    </p>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                        <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.5; color: #888888; text-align: center;">
                          Se o botão não funcionar, copie e cole este link no seu navegador:<br>
                          <a href="https://studiogabirego.com" style="color: #ea580c; word-break: break-all;">https://studiogabirego.com</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px 20px; text-align: center;">
                  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #ea580c;">
                    Studio Gabi Rego
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
  },
}
