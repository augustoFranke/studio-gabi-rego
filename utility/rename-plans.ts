/**
 * Rename Plans Script
 * 
 * Renames plans from:
 *   "TREINO 2X POR SEMANA (ESTAGIÁRIO)" → "2x/semana - Estagiários"
 *   "TREINO 3X POR SEMANA (GABI)" → "3x/semana - Gabi"
 *   etc.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function transformPlanName(oldName: string): string {
  // Extract frequency (e.g., "2X", "3X", "5X")
  const freqMatch = oldName.match(/(\d+)\s*X/i)
  const frequency = freqMatch ? freqMatch[1] : null
  
  // Determine if it's Gabi or Estagiário
  const isGabi = oldName.toUpperCase().includes('GABI')
  const isPersonal = oldName.toUpperCase().includes('PERSONAL')
  
  // Special cases
  if (oldName.includes('PLANO PARA NOSSA FAMÍLIA')) {
    return 'Plano Família'
  }
  
  if (oldName.includes('ATENDIMENTO EXCLUSIVO')) {
    return `${frequency}x/semana - Exclusivo Estagiários`
  }
  
  if (!frequency) {
    // Can't transform, return original
    return oldName
  }
  
  const instructor = isGabi ? 'Gabi' : 'Estagiários'
  const prefix = isPersonal ? 'Personal ' : ''
  
  return `${prefix}${frequency}x/semana - ${instructor}`
}

async function main() {
  console.log('📝 Renaming Plans...\n')
  
  const plans = await prisma.plano.findMany()
  
  console.log('Current plans and their new names:\n')
  console.log('-'.repeat(80))
  
  const updates: Array<{ id: string; oldName: string; newName: string }> = []
  
  for (const plan of plans) {
    const newName = transformPlanName(plan.nome)
    
    if (newName !== plan.nome) {
      updates.push({ id: plan.id, oldName: plan.nome, newName })
      console.log(`"${plan.nome}"`)
      console.log(`  → "${newName}"`)
      console.log()
    } else {
      console.log(`"${plan.nome}" (no change)`)
      console.log()
    }
  }
  
  console.log('-'.repeat(80))
  console.log(`\n📊 ${updates.length} plans will be renamed\n`)
  
  // Apply updates
  for (const update of updates) {
    await prisma.plano.update({
      where: { id: update.id },
      data: { nome: update.newName },
    })
    console.log(`✓ Updated: "${update.newName}"`)
  }
  
  console.log('\n✅ Done!')
  
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})

