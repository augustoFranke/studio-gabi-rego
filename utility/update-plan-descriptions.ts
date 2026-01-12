/**
 * Update Plan Descriptions Script
 * 
 * Adds detailed descriptions to plans based on frequency and instructor
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function getFrequencyText(freq: number): string {
  const texts: Record<number, string> = {
    1: 'Uma vez',
    2: 'Duas vezes',
    3: 'Três vezes',
    4: 'Quatro vezes',
    5: 'Cinco vezes',
  }
  return texts[freq] || `${freq} vezes`
}

function generateDescription(planName: string): string {
  // Extract frequency
  const freqMatch = planName.match(/(\d+)x\/semana/i)
  const frequency = freqMatch ? parseInt(freqMatch[1]) : null
  
  // Determine instructor type
  const isGabi = planName.toLowerCase().includes('gabi')
  const isPersonal = planName.toLowerCase().includes('personal')
  const isExclusivo = planName.toLowerCase().includes('exclusivo')
  const isFamilia = planName.toLowerCase().includes('família')
  
  if (isFamilia) {
    return 'Plano especial para famílias treinarem juntas.'
  }
  
  if (!frequency) {
    return ''
  }
  
  const freqText = getFrequencyText(frequency)
  
  if (isPersonal) {
    return `${freqText} por semana com atendimento personalizado da Gabi.`
  }
  
  if (isExclusivo) {
    return `${freqText} por semana com atendimento exclusivo pelos estagiários.`
  }
  
  if (isGabi) {
    return `${freqText} por semana, guiado por Gabi.`
  }
  
  // Estagiários
  return `${freqText} por semana, guiado pelos estagiários.`
}

async function main() {
  console.log('📝 Updating Plan Descriptions...\n')
  
  const plans = await prisma.plano.findMany()
  
  console.log('Plans and their new descriptions:\n')
  console.log('-'.repeat(80))
  
  for (const plan of plans) {
    const description = generateDescription(plan.nome)
    
    console.log(`📌 ${plan.nome}`)
    console.log(`   "${description}"`)
    console.log()
    
    await prisma.plano.update({
      where: { id: plan.id },
      data: { descricao: description },
    })
  }
  
  console.log('-'.repeat(80))
  console.log(`\n✅ Updated ${plans.length} plans with descriptions!`)
  
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})

