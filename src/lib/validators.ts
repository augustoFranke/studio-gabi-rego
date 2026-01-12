/**
 * Validadores para dados brasileiros
 */

/**
 * Valida um CPF
 * @param cpf - CPF a ser validado (com ou sem formatação)
 * @returns true se o CPF for válido
 */
export function validarCPF(cpf: string): boolean {
  // Remove caracteres não numéricos
  cpf = cpf.replace(/\D/g, '')

  // Verifica se tem 11 dígitos
  if (cpf.length !== 11) {
    return false
  }

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1+$/.test(cpf)) {
    return false
  }

  // Calcula o primeiro dígito verificador
  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i)
  }
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpf.charAt(9))) {
    return false
  }

  // Calcula o segundo dígito verificador
  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(cpf.charAt(10))) {
    return false
  }

  return true
}

/**
 * Formata um CPF para o padrão XXX.XXX.XXX-XX
 * @param cpf - CPF a ser formatado
 * @returns CPF formatado
 */
export function formatarCPF(cpf: string): string {
  cpf = cpf.replace(/\D/g, '')
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

/**
 * Formata um telefone para o padrão (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
 * @param telefone - Telefone a ser formatado
 * @returns Telefone formatado
 */
export function formatarTelefone(telefone: string): string {
  telefone = telefone.replace(/\D/g, '')
  
  if (telefone.length === 11) {
    return telefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  } else if (telefone.length === 10) {
    return telefone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  
  return telefone
}

/**
 * Valida um email
 * @param email - Email a ser validado
 * @returns true se o email for válido
 */
export function validarEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return regex.test(email)
}

/**
 * Formata um valor monetário para o padrão brasileiro
 * @param valor - Valor a ser formatado
 * @returns Valor formatado (ex: R$ 1.234,56)
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor)
}

/**
 * Formata uma data para o padrão brasileiro
 * @param data - Data a ser formatada
 * @returns Data formatada (ex: 01/01/2024)
 */
export function formatarData(data: Date | string): string {
  const d = typeof data === 'string' ? new Date(data) : data
  return new Intl.DateTimeFormat('pt-BR').format(d)
}

/**
 * Formata uma data e hora para o padrão brasileiro
 * @param data - Data a ser formatada
 * @returns Data e hora formatadas (ex: 01/01/2024 às 14:30)
 */
export function formatarDataHora(data: Date | string): string {
  const d = typeof data === 'string' ? new Date(data) : data
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d)
}

