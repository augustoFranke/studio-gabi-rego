/**
 * Cliente para Evolution API (WhatsApp)
 * Documentação: https://doc.evolution-api.com/
 */

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY

interface EnviarMensagemParams {
  telefone: string
  mensagem: string
}

interface EnviarMensagemResponse {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Verifica se a Evolution API está configurada
 */
export function isEvolutionConfigured(): boolean {
  return Boolean(EVOLUTION_API_URL && EVOLUTION_API_KEY)
}

/**
 * Formata o número de telefone para o padrão do WhatsApp
 * @param telefone - Telefone no formato brasileiro
 * @returns Telefone formatado para WhatsApp (ex: 5511999999999)
 */
function formatarTelefoneWhatsApp(telefone: string): string {
  // Remove todos os caracteres não numéricos
  let numero = telefone.replace(/\D/g, '')
  
  // Se não começar com 55, adiciona o código do Brasil
  if (!numero.startsWith('55')) {
    numero = '55' + numero
  }
  
  return numero
}

/**
 * Envia uma mensagem de texto via WhatsApp
 */
export async function enviarMensagemWhatsApp({
  telefone,
  mensagem,
}: EnviarMensagemParams): Promise<EnviarMensagemResponse> {
  if (!isEvolutionConfigured()) {
    console.warn('Evolution API não configurada')
    return { success: false, error: 'Evolution API não configurada' }
  }

  const numeroFormatado = formatarTelefoneWhatsApp(telefone)

  try {
    const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/gabi-studio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY!,
      },
      body: JSON.stringify({
        number: numeroFormatado,
        text: mensagem,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Erro ao enviar mensagem WhatsApp:', error)
      return { success: false, error }
    }

    const data = await response.json()
    return { success: true, messageId: data.key?.id }
  } catch (error) {
    console.error('Erro ao enviar mensagem WhatsApp:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }
  }
}

/**
 * Templates de mensagens
 */
export const templates = {
  lembreteAula: (nome: string, horario: string, data: string) =>
    `Olá ${nome}! 👋\n\nLembrete: você tem aula agendada hoje às ${horario}.\n\n📅 Data: ${data}\n\nTe esperamos no Gabi Studio! 💪`,

  cobranca: (nome: string, valor: string, vencimento: string) =>
    `Olá ${nome}! 👋\n\nSeu pagamento de ${valor} vence em ${vencimento}.\n\nQualquer dúvida, estamos à disposição!\n\nGabi Studio 💜`,

  aniversario: (nome: string) =>
    `Feliz aniversário, ${nome}! 🎂🎉\n\nDesejamos um dia incrível cheio de alegria e saúde!\n\nCom carinho,\nGabi Studio 💜`,

  boasVindas: (nome: string) =>
    `Olá ${nome}! 👋\n\nSeja muito bem-vindo(a) ao Gabi Studio!\n\nEstamos muito felizes em ter você conosco. Qualquer dúvida, é só chamar!\n\nVamos juntos nessa jornada! 💪`,
}

