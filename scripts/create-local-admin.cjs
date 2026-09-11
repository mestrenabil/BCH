const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')

const db = new PrismaClient()

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${derivedKey}`
}

async function main() {
  const username = process.env.INITIAL_ADMIN_USERNAME?.trim()
  const password = process.env.INITIAL_ADMIN_PASSWORD
  const nom = process.env.INITIAL_ADMIN_NAME?.trim() || 'المسؤول العام'

  if (!username || username.length < 3 || !password || password.length < 12) {
    throw new Error('Local administrator credentials do not meet the security requirements.')
  }

  const userCount = await db.user.count()
  if (userCount > 0) {
    console.log('Local users already exist; no administrator was created.')
    return
  }

  await db.user.create({
    data: {
      username,
      password: hashPassword(password),
      nom,
      commune: 'ALL',
      role: 'admin',
    },
  })

  console.log(`Local administrator "${username}" was created successfully.`)
}

main()
  .catch((error) => {
    console.error(error.message || error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })
