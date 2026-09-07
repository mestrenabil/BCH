'use strict'

function sha256(filePath, fs, crypto) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function writeJson(filePath, value, fs) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function main() {
  const crypto = await import('node:crypto')
  const fs = await import('node:fs')
  const path = await import('node:path')
  const { PrismaClient } = await import('@prisma/client')
  const root = path.resolve(process.cwd())
  const databasePath = path.join(root, 'db', 'custom.db')
  const schemaPath = path.join(root, 'prisma', 'schema.prisma')

  if (!fs.existsSync(databasePath)) throw new Error(`قاعدة SQLite غير موجودة: ${databasePath}`)
  if (!fs.existsSync(schemaPath)) throw new Error(`مخطط Prisma غير موجود: ${schemaPath}`)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(root, 'backups', stamp)
  fs.mkdirSync(backupDir, { recursive: true })

  const databaseCopy = path.join(backupDir, 'custom.db')
  const schemaCopy = path.join(backupDir, 'schema.prisma')
  fs.copyFileSync(databasePath, databaseCopy)
  fs.copyFileSync(schemaPath, schemaCopy)
  const sourceDatabaseHash = sha256(databasePath, fs, crypto)
  const backupDatabaseHash = sha256(databaseCopy, fs, crypto)
  const sourceSchemaHash = sha256(schemaPath, fs, crypto)
  const backupSchemaHash = sha256(schemaCopy, fs, crypto)
  if (sourceDatabaseHash !== backupDatabaseHash) throw new Error('فشل تطابق SHA-256 لنسخة قاعدة SQLite')
  if (sourceSchemaHash !== backupSchemaHash) throw new Error('فشل تطابق SHA-256 لنسخة مخطط Prisma')

  const databaseUrl = `file:${databasePath.replace(/\\/g, '/')}`
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
  try {
    const tableRows = await prisma.$queryRawUnsafe("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    const tables = tableRows.map((row) => row.name)
    const counts = {}

    for (const table of tables) {
      const safeTable = table.replace(/"/g, '""')
      const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS count FROM "${safeTable}"`)
      counts[table] = Number(result[0]?.count || 0)
    }

    const integrityCheck = await prisma.$queryRawUnsafe('PRAGMA integrity_check')
    const foreignKeyCheck = await prisma.$queryRawUnsafe('PRAGMA foreign_key_check')
    const schemaText = fs.readFileSync(schemaPath, 'utf8')
    const modelCount = (schemaText.match(/^model\s+/gm) || []).length

    writeJson(path.join(backupDir, 'sqlite_tables.json'), {
      generatedAt: new Date().toISOString(),
      tableCount: tables.length,
      tables,
    }, fs)
    writeJson(path.join(backupDir, 'before_migration_counts.json'), {
      generatedAt: new Date().toISOString(),
      modelCount,
      tableCount: tables.length,
      counts,
    }, fs)
    writeJson(path.join(backupDir, 'backup_manifest.json'), {
      generatedAt: new Date().toISOString(),
      sourceDatabase: 'db/custom.db',
      sourceSchema: 'prisma/schema.prisma',
      database: { file: 'custom.db', bytes: fs.statSync(databaseCopy).size, sourceSha256: sourceDatabaseHash, backupSha256: backupDatabaseHash },
      schema: { file: 'schema.prisma', bytes: fs.statSync(schemaCopy).size, sourceSha256: sourceSchemaHash, backupSha256: backupSchemaHash },
      modelCount,
      tableCount: tables.length,
      integrityCheck,
      foreignKeyCheck,
      environmentFilesCopied: [],
    }, fs)

    console.log(`Backup directory: ${backupDir}`)
    console.log(`Tables detected: ${tables.length}`)
    console.log(`Prisma models detected: ${modelCount}`)
    console.log(`SQLite integrity check: ${integrityCheck[0]?.integrity_check || 'unknown'}`)
    console.log(`Foreign-key violations: ${foreignKeyCheck.length}`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(`Backup failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
