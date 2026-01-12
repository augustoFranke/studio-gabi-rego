/**
 * Extract Plan Prices from NextFit
 * 
 * This script:
 * 1. Fetches financial data for all members with active contracts
 * 2. Extracts the price for each plan
 * 3. Identifies price discrepancies (same plan, different prices)
 * 4. Updates plan prices in the database
 * 
 * Usage: NEXTFIT_TOKEN="your_token" npx tsx utility/extract-plan-prices.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

const CONFIG = {
  token: process.env.NEXTFIT_TOKEN || '',
  outputDir: path.join(__dirname, 'csv'),
  delayMs: 200,
}

interface PlanPrice {
  planName: string
  price: number
  memberName: string
  memberId: number
}

interface PriceDiscrepancy {
  planName: string
  prices: Array<{ price: number; members: string[] }>
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchAPI(url: string, token: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  
  return response.json()
}

async function main() {
  console.log('💰 Starting Plan Price Extraction...\n')
  
  if (!CONFIG.token) {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    TOKEN REQUIRED                                ║
║  Run: NEXTFIT_TOKEN="your_token" npx tsx utility/extract-plan-prices.ts
╚══════════════════════════════════════════════════════════════════╝
`)
    return
  }
  
  // Step 1: Get all members with contracts
  console.log('📋 Step 1: Fetching member list...')
  
  const listUrl = 'https://api.nextfit.com.br/api/Cliente/RecuperarPesquisaGeral?' +
    new URLSearchParams({
      limit: '500',
      page: '1',
      fields: JSON.stringify(['Id', 'Nome']),
      includes: JSON.stringify(['ClienteParametro']),
      sort: JSON.stringify([{ property: 'Nome', direction: 'ASC' }]),
      filter: '[]',
      VerRemovidos: 'false',
      VerVIPs: 'false',
      Descricao: '',
      TipoVinculoStr: '[1,2]',
    }).toString()
  
  const listData = await fetchAPI(listUrl, CONFIG.token) as { Content?: Array<{ Id: number; Nome: string }>; Total: number }
  const memberList = listData.Content || []
  
  console.log(`   Found ${memberList.length} members\n`)
  
  // Step 2: For each member, get their contract with price
  console.log('💵 Step 2: Fetching contract prices...\n')
  
  const planPrices: PlanPrice[] = []
  
  for (let i = 0; i < memberList.length; i++) {
    const member = memberList[i]
    process.stdout.write(`   ${(i + 1).toString().padStart(3)}/${memberList.length}: ${member.Nome.substring(0, 35).padEnd(35)} `)
    
    try {
      // Get contract info
      const contractUrl = 'https://api.nextfit.com.br/api/contratocliente/v2/Listar?' +
        new URLSearchParams({
          fields: JSON.stringify([
            'Id', 'Status', 'ContratoBase.Id', 'ContratoBase.Descricao'
          ]),
          filter: JSON.stringify([
            { property: 'CodigoCliente', operator: 'equal', value: String(member.Id), and: true },
            { property: 'Status', operator: 'in', value: [1, 3, 4, 5, 6, 7], and: true }
          ]),
          limit: '10',
          page: '1',
          sort: JSON.stringify([{ property: 'Id', direction: 'desc' }]),
        }).toString()
      
      const contracts = await fetchAPI(contractUrl, CONFIG.token) as {
        Content?: Array<{
          Status?: number
          ContratoBase?: { Descricao?: string }
        }>
      }
      
      if (!contracts.Content || contracts.Content.length === 0) {
        console.log('⏭️ No contract')
        await delay(CONFIG.delayMs)
        continue
      }
      
      const contract = contracts.Content[0]
      const planName = contract.ContratoBase?.Descricao
      
      if (!planName) {
        console.log('⚠️ No plan name')
        await delay(CONFIG.delayMs)
        continue
      }
      
      // Get financial data (receber) to find the price
      const financeUrl = 'https://api.nextfit.com.br/api/receber?' +
        new URLSearchParams({
          fields: JSON.stringify([
            'Id', 'Descricao', 'Valor', 'Status', 'DataVencimento'
          ]),
          filter: JSON.stringify([
            { property: 'CodigoCliente', operator: 'equal', value: member.Id, and: true },
            { property: 'Status', operator: 'in', value: [1, 2, 5], and: true }
          ]),
          limit: '20',
          page: '1',
          sort: JSON.stringify([{ property: 'DataVencimento', direction: 'desc' }]),
        }).toString()
      
      const finances = await fetchAPI(financeUrl, CONFIG.token) as {
        Content?: Array<{
          Valor?: number
          Descricao?: string
        }>
      }
      
      if (finances.Content && finances.Content.length > 0) {
        // Get the most recent payment value
        const payment = finances.Content[0]
        const price = payment.Valor || 0
        
        if (price > 0) {
          planPrices.push({
            planName,
            price,
            memberName: member.Nome,
            memberId: member.Id,
          })
          console.log(`✓ ${planName}: R$${price.toFixed(2)}`)
        } else {
          console.log(`⚠️ ${planName}: No price in finances`)
        }
      } else {
        console.log(`⚠️ ${planName}: No financial records`)
      }
      
    } catch (e) {
      console.log(`❌ ${(e as Error).message}`)
    }
    
    await delay(CONFIG.delayMs)
  }
  
  console.log('\n' + '='.repeat(60))
  
  // Step 3: Analyze prices by plan
  console.log('\n📊 Step 3: Analyzing plan prices...\n')
  
  const pricesByPlan = new Map<string, Map<number, string[]>>()
  
  for (const pp of planPrices) {
    if (!pricesByPlan.has(pp.planName)) {
      pricesByPlan.set(pp.planName, new Map())
    }
    const priceMap = pricesByPlan.get(pp.planName)!
    if (!priceMap.has(pp.price)) {
      priceMap.set(pp.price, [])
    }
    priceMap.get(pp.price)!.push(pp.memberName)
  }
  
  // Find discrepancies and determine most common price
  const discrepancies: PriceDiscrepancy[] = []
  const planFinalPrices = new Map<string, number>()
  
  for (const [planName, priceMap] of pricesByPlan) {
    const prices = Array.from(priceMap.entries())
      .map(([price, members]) => ({ price, members }))
      .sort((a, b) => b.members.length - a.members.length) // Sort by member count
    
    // Use the most common price
    planFinalPrices.set(planName, prices[0].price)
    
    if (prices.length > 1) {
      discrepancies.push({ planName, prices })
    }
    
    console.log(`📝 ${planName}:`)
    console.log(`   Most common price: R$${prices[0].price.toFixed(2)} (${prices[0].members.length} members)`)
    if (prices.length > 1) {
      console.log(`   ⚠️ DISCREPANCY: ${prices.length} different prices found`)
    }
  }
  
  // Step 4: Show discrepancies
  if (discrepancies.length > 0) {
    console.log('\n' + '='.repeat(60))
    console.log('\n⚠️ PRICE DISCREPANCIES FOUND:\n')
    
    for (const d of discrepancies) {
      console.log(`\n📌 ${d.planName}:`)
      for (const p of d.prices) {
        console.log(`   R$${p.price.toFixed(2)} (${p.members.length} members):`)
        for (const m of p.members.slice(0, 5)) {
          console.log(`      - ${m}`)
        }
        if (p.members.length > 5) {
          console.log(`      ... and ${p.members.length - 5} more`)
        }
      }
    }
    
    // Save discrepancies to file
    const discrepancyReport = discrepancies.map(d => ({
      plan: d.planName,
      prices: d.prices.map(p => ({
        price: p.price,
        memberCount: p.members.length,
        members: p.members,
      })),
    }))
    
    const reportPath = path.join(CONFIG.outputDir, 'price-discrepancies.json')
    fs.writeFileSync(reportPath, JSON.stringify(discrepancyReport, null, 2))
    console.log(`\n📁 Discrepancy report saved to: ${reportPath}`)
  }
  
  // Step 5: Update plan prices in database
  console.log('\n' + '='.repeat(60))
  console.log('\n💾 Step 5: Updating plan prices in database...\n')
  
  const existingPlans = await prisma.plano.findMany()
  const planByName = new Map(existingPlans.map(p => [p.nome.toLowerCase(), p]))
  
  let updated = 0
  let notFound = 0
  
  for (const [planName, price] of planFinalPrices) {
    const plan = planByName.get(planName.toLowerCase())
    
    if (plan) {
      const currentPrice = Number(plan.valor)
      if (currentPrice !== price) {
        await prisma.plano.update({
          where: { id: plan.id },
          data: { valor: price },
        })
        console.log(`   ✓ ${planName}: R$${currentPrice.toFixed(2)} → R$${price.toFixed(2)}`)
        updated++
      } else {
        console.log(`   ⏭️ ${planName}: Already R$${price.toFixed(2)}`)
      }
    } else {
      console.log(`   ❓ ${planName}: Not found in database`)
      notFound++
    }
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('📊 Summary:')
  console.log(`   Plans with prices: ${planFinalPrices.size}`)
  console.log(`   Updated: ${updated}`)
  console.log(`   Not found: ${notFound}`)
  console.log(`   Discrepancies: ${discrepancies.length}`)
  console.log('='.repeat(60))
  
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})

