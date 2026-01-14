#!/usr/bin/env tsx
/**
 * Update Due Day Script
 * 
 * Updates all payments with due date on day 9 to day 10.
 * This is a one-time migration script to align with the new default.
 * 
 * Usage:
 *   npx tsx utility/update-due-day.ts           # Live run
 *   npx tsx utility/update-due-day.ts --dry-run # Preview only
 */

import { prisma } from '../src/lib/prisma'

const DRY_RUN = process.argv.includes('--dry-run')
const OLD_DAY = 9
const NEW_DAY = 10

async function main() {
    console.log('╔════════════════════════════════════════════════════════════════╗')
    console.log('║           Update Due Day Script (Day 9 → Day 10)               ║')
    console.log('╠════════════════════════════════════════════════════════════════╣')
    console.log(`║ Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`.padEnd(67) + '║')
    console.log('╚════════════════════════════════════════════════════════════════╝')
    console.log()

    // Find all payments with day 9
    const allPagamentos = await prisma.pagamento.findMany({
        select: {
            id: true,
            dataVencimento: true,
            membro: {
                include: {
                    usuario: {
                        select: { nome: true }
                    }
                }
            }
        },
        orderBy: { dataVencimento: 'asc' }
    })

    // Filter to only those with day 9
    const pagamentosToUpdate = allPagamentos.filter(p => {
        const date = new Date(p.dataVencimento)
        return date.getDate() === OLD_DAY
    })

    console.log(`📊 Total payments in database: ${allPagamentos.length}`)
    console.log(`📅 Payments with day ${OLD_DAY}: ${pagamentosToUpdate.length}`)
    console.log()

    if (pagamentosToUpdate.length === 0) {
        console.log('✅ No payments need to be updated!')
        return
    }

    console.log('📋 Payments to update:')
    console.log('─'.repeat(70))

    let updatedCount = 0
    let errorCount = 0

    for (const pagamento of pagamentosToUpdate) {
        const oldDate = new Date(pagamento.dataVencimento)
        const newDate = new Date(oldDate)
        newDate.setDate(NEW_DAY)

        const memberName = pagamento.membro?.usuario?.nome || 'Unknown'
        const oldDateStr = oldDate.toLocaleDateString('pt-BR')
        const newDateStr = newDate.toLocaleDateString('pt-BR')

        console.log(`   ${memberName}: ${oldDateStr} → ${newDateStr}`)

        if (!DRY_RUN) {
            try {
                await prisma.pagamento.update({
                    where: { id: pagamento.id },
                    data: { dataVencimento: newDate }
                })
                updatedCount++
            } catch (error) {
                console.error(`   ❌ Error updating payment ${pagamento.id}:`, error)
                errorCount++
            }
        } else {
            updatedCount++
        }
    }

    console.log()
    console.log('═'.repeat(70))
    console.log()
    console.log(`✅ ${DRY_RUN ? 'Would update' : 'Updated'}: ${updatedCount} payments`)
    if (errorCount > 0) {
        console.log(`❌ Errors: ${errorCount}`)
    }
    console.log()

    if (DRY_RUN) {
        console.log('ℹ️  Run without --dry-run to apply changes.')
    }
}

main()
    .catch((error) => {
        console.error('Fatal error:', error)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
