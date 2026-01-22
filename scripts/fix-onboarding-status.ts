/**
 * Fix onboarding status for admin-created users
 *
 * This script updates all MEMBRO users who have incomplete onboarding
 * but already have a Membro record (meaning they were created by admin).
 *
 * Run with: npx tsx scripts/fix-onboarding-status.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Finding admin-created users with incomplete onboarding...\n')

  // Find all users who are MEMBROs with incomplete onboarding but have a membro record
  const usersToFix = await prisma.usuario.findMany({
    where: {
      role: 'MEMBRO',
      onboardingCompleto: false,
      membro: {
        isNot: null,
      },
    },
    include: {
      membro: true,
    },
  })

  if (usersToFix.length === 0) {
    console.log('✅ No users need fixing. All admin-created users have correct onboarding status.')
    return
  }

  console.log(`Found ${usersToFix.length} user(s) to fix:\n`)

  for (const user of usersToFix) {
    console.log(`  - ${user.nome} (${user.email})`)
  }

  console.log('\n🔧 Updating onboarding status...\n')

  const result = await prisma.usuario.updateMany({
    where: {
      role: 'MEMBRO',
      onboardingCompleto: false,
      membro: {
        isNot: null,
      },
    },
    data: {
      onboardingCompleto: true,
      etapaOnboarding: 4,
    },
  })

  console.log(`✅ Successfully updated ${result.count} user(s).`)
  console.log('\nThese users can now login and go directly to their dashboard.')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
