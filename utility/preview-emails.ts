import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { emailTemplates } from '../src/lib/resend'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const outputDir = path.join(__dirname, 'email-previews')

const samples = {
  nome: 'Ana Paula',
  horario: '08:00',
  data: '10/03/2025',
  valor: 'R$ 320,00',
  vencimento: '15/03/2025',
  linkVerificacao: 'https://studiogabirego.com/verificar-email/exemplo',
  linkCompletar: 'https://studiogabirego.com/completar-perfil?token=exemplo',
  linkRedefinir: 'https://studiogabirego.com/redefinir-senha/exemplo',
}

const previews = [
  {
    filename: 'lembrete-aula.html',
    title: 'Lembrete de Aula',
    html: emailTemplates.lembreteAula(samples.nome, samples.horario, samples.data),
  },
  {
    filename: 'cobranca.html',
    title: 'Cobranca',
    html: emailTemplates.cobranca(samples.nome, samples.valor, samples.vencimento),
  },
  {
    filename: 'verificacao-email.html',
    title: 'Verificacao de Email',
    html: emailTemplates.verificacaoEmail(samples.nome, samples.linkVerificacao),
  },
  {
    filename: 'completar-perfil.html',
    title: 'Completar Perfil',
    html: emailTemplates.completarPerfil(samples.nome, samples.linkCompletar),
  },
  {
    filename: 'redefinir-senha.html',
    title: 'Redefinir Senha',
    html: emailTemplates.redefinirSenha(samples.nome, samples.linkRedefinir),
  },
  {
    filename: 'boas-vindas.html',
    title: 'Boas-Vindas',
    html: emailTemplates.boasVindas(samples.nome),
  },
]

async function writePreviews() {
  await fs.mkdir(outputDir, { recursive: true })

  await Promise.all(
    previews.map((preview) =>
      fs.writeFile(path.join(outputDir, preview.filename), preview.html, 'utf8')
    )
  )

  const indexHtml = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Email Previews</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #1f2937; background: #f9fafb; }
      h1 { margin: 0 0 16px 0; font-size: 22px; }
      ul { padding: 0; list-style: none; display: grid; gap: 8px; }
      a { color: #ea580c; text-decoration: none; font-weight: 600; }
      a:hover { text-decoration: underline; }
      .note { font-size: 13px; color: #6b7280; margin-top: 16px; }
    </style>
  </head>
  <body>
    <h1>Email Previews</h1>
    <ul>
      ${previews
        .map(
          (preview) =>
            `<li><a href="./${preview.filename}" target="_blank" rel="noreferrer">${preview.title}</a></li>`
        )
        .join('\n      ')}
    </ul>
    <p class="note">Gerado por utility/preview-emails.ts</p>
  </body>
</html>`

  await fs.writeFile(path.join(outputDir, 'index.html'), indexHtml, 'utf8')
  console.log(`Email previews written to ${outputDir}`)
}

writePreviews().catch((error) => {
  console.error('Failed to generate email previews:', error)
  process.exit(1)
})
