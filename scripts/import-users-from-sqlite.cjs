if (!process.env.DATABASE_URL || !/^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL)) {
  console.error('DATABASE_URL must point to PostgreSQL')
  process.exit(1)
}

function nullableDate(value) {
  return value ? new Date(value) : null
}

async function main() {
  const path = await import('node:path')
  const { DatabaseSync } = await import('node:sqlite')
  const { PrismaClient } = await import('@prisma/client')
  const sqlitePath = path.resolve(process.env.SQLITE_PATH || 'db/custom.db')
  const source = new DatabaseSync(sqlitePath, { readOnly: true })
  const target = new PrismaClient()

  try {
  const sourceUsers = source.prepare(`
    SELECT id, username, password, nom, commune, managedCommunes,
           communeGroupName, navVisibilityJson, role, actif, lastLogin,
           createdAt, updatedAt, agentId
    FROM User
    WHERE agentId IS NULL
    ORDER BY createdAt ASC
  `).all()

  let created = 0
  let skipped = 0

  for (const user of sourceUsers) {
    const existing = await target.user.findUnique({ where: { username: user.username } })
    if (existing) {
      skipped += 1
      continue
    }

    await target.user.create({
      data: {
        id: user.id,
        username: user.username,
        password: user.password,
        nom: user.nom,
        commune: user.commune,
        managedCommunes: user.managedCommunes || '[]',
        communeGroupName: user.communeGroupName || null,
        navVisibilityJson: user.navVisibilityJson || '{}',
        role: user.role || 'responsable',
        actif: Boolean(user.actif),
        lastLogin: nullableDate(user.lastLogin),
        createdAt: nullableDate(user.createdAt) || new Date(),
        updatedAt: nullableDate(user.updatedAt) || new Date(),
      },
    })
    created += 1
  }

  console.log(`USERS_IMPORTED=${created}`)
  console.log(`USERS_SKIPPED=${skipped}`)
  } finally {
    source.close()
    await target.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
