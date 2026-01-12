/**
 * Update Member Plans from CSV
 * 
 * This script updates only the plan (planoId) for existing members
 * by matching them via CPF.
 * 
 * Usage: npx tsx utility/update-plans.ts
 * 
 * IMPORTANT: Make sure the plans exist in your system first!
 * The script will create missing plans automatically.
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const CONFIG = {
  csvPath: path.join(__dirname, 'csv', 'nextfit-export-2026-01-05.csv'),
  defaultValue: 'Pendente',
  createMissingPlans: true, // Set to false if you want to skip members with unknown plans
}

interface CSVRow {
  nome: string
  email: string
  cpf: string
  telefone: string
  data_nascimento: string
  plano: string
}

function parseCSV(content: string): CSVRow[] {
  const lines = content.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  
  return lines.slice(1).map(line => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())
    
    const row: Record<string, string> = {}
    headers.forEach((header, i) => {
      row[header] = values[i] || ''
    })
    
    return row as unknown as CSVRow
  })
}

async function main() {
  console.log('🔄 Starting Plan Update...\n')
  
  // Check if CSV exists
  if (!fs.existsSync(CONFIG.csvPath)) {
    console.error(`❌ CSV file not found: ${CONFIG.csvPath}`)
    console.log('   Run the extraction first: npm run scrape:nextfit')
    process.exit(1)
  }
  
  // Read and parse CSV
  const content = fs.readFileSync(CONFIG.csvPath, 'utf-8')
  const rows = parseCSV(content)
  
  console.log(`📋 Found ${rows.length} rows in CSV\n`)
  
  // Filter rows with valid plans (not "Pendente")
  const rowsWithPlans = rows.filter(r => r.plano && r.plano !== CONFIG.defaultValue)
  console.log(`📊 ${rowsWithPlans.length} rows have plan information\n`)
  
  if (rowsWithPlans.length === 0) {
    console.log('⚠️ No rows with plan information found!')
    process.exit(0)
  }
  
  // Get unique plan names from CSV
  const uniquePlans = [...new Set(rowsWithPlans.map(r => r.plano))]
  console.log(`📝 Unique plans in CSV (${uniquePlans.length}):`)
  uniquePlans.forEach(p => console.log(`   - ${p}`))
  console.log()
  
  // Get existing plans from database
  const existingPlans = await prisma.plano.findMany()
  const planByName = new Map(existingPlans.map(p => [p.nome.toLowerCase(), p]))
  
  console.log(`💾 Existing plans in database (${existingPlans.length}):`)
  existingPlans.forEach(p => console.log(`   - ${p.nome} (${p.id})`))
  console.log()
  
  // Create missing plans if enabled
  const planIdMap = new Map<string, string>()
  
  for (const planName of uniquePlans) {
    const existing = planByName.get(planName.toLowerCase())
    
    if (existing) {
      planIdMap.set(planName, existing.id)
    } else if (CONFIG.createMissingPlans) {
      console.log(`➕ Creating plan: ${planName}`)
      
      // Extract weekly sessions from plan name (e.g., "TREINO 3X POR SEMANA" -> 3)
      const match = planName.match(/(\d+)X/i)
      const aulasSemanais = match ? parseInt(match[1]) : 3
      
      const newPlan = await prisma.plano.create({
        data: {
          nome: planName,
          descricao: `Plano importado do NextFit`,
          valor: 0, // You'll need to set this manually
          duracaoDias: 30,
          aulasSemanais,
          ativo: true,
        },
      })
      
      planIdMap.set(planName, newPlan.id)
    }
  }
  
  console.log()
  
  // Update members
  let updated = 0
  let notFound = 0
  let noChange = 0
  let errors = 0
  
  console.log('🔄 Updating members...\n')
  
  for (const row of rowsWithPlans) {
    const cpf = row.cpf.replace(/\D/g, '')
    const planName = row.plano
    const planId = planIdMap.get(planName)
    
    if (!planId) {
      console.log(`   ⚠️ ${row.nome}: No plan ID for "${planName}"`)
      errors++
      continue
    }
    
    try {
      const membro = await prisma.membro.findUnique({
        where: { cpf },
        select: { id: true, planoId: true, usuario: { select: { nome: true } } },
      })
      
      if (!membro) {
        console.log(`   ❓ ${row.nome} (CPF: ${cpf}): Not found in database`)
        notFound++
        continue
      }
      
      if (membro.planoId === planId) {
        noChange++
        continue
      }
      
      await prisma.membro.update({
        where: { cpf },
        data: { planoId: planId },
      })
      
      console.log(`   ✓ ${membro.usuario.nome}: ${planName}`)
      updated++
      
    } catch (e) {
      console.log(`   ❌ ${row.nome}: ${(e as Error).message}`)
      errors++
    }
  }
  
  console.log('\n' + '='.repeat(50))
  console.log('📊 Summary:')
  console.log(`   ✅ Updated: ${updated}`)
  console.log(`   ⏭️ No change: ${noChange}`)
  console.log(`   ❓ Not found: ${notFound}`)
  console.log(`   ❌ Errors: ${errors}`)
  console.log('='.repeat(50))
  
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})

