import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { hashPassword, requireAuth } from '@/lib/auth'

const DEFAULT_USERS = [
  {
    username: 'admin',
    password: 'admin123',
    nom: 'المسؤول العام',
    commune: 'ALL',
    role: 'admin',
  },
  {
    username: 'sla',
    password: 'sla2025',
    nom: 'مسؤول جماعة سلا',
    commune: 'سلا',
    role: 'responsable',
  },
  {
    username: 'bouknadel',
    password: 'bouknadel2025',
    nom: 'مسؤول جماعة سيدي أبي القنادل',
    commune: 'سيدي أبي القنادل',
    role: 'responsable',
  },
  {
    username: 'ameur',
    password: 'ameur2025',
    nom: 'مسؤول جماعة عامر',
    commune: 'عامر',
    role: 'responsable',
  },
]

export async function POST() {
  const authResult = await requireAuth()
  if ('error' in authResult) return authResult.error

  try {
    // Only create users that don't already exist
    const createdUsers = []
    for (const u of DEFAULT_USERS) {
      const existing = await db.user.findUnique({ where: { username: u.username } })
      if (!existing) {
        const user = await db.user.create({
          data: {
            username: u.username,
            password: hashPassword(u.password),
            nom: u.nom,
            commune: u.commune,
            role: u.role,
          }
        })
        createdUsers.push({
          username: user.username,
          nom: user.nom,
          commune: user.commune,
          role: user.role,
        })
      }
    }

    return NextResponse.json({
      message: createdUsers.length > 0 ? 'تم إنشاء المستخدمين الافتراضيين بنجاح' : 'المستخدمون موجودون مسبقاً',
      usersCreated: createdUsers.length,
    })
  } catch (error) {
    console.error('Seed users error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء المستخدمين' }, { status: 500 })
  }
}

export async function GET() {
  const authResult = await requireAuth()
  if ('error' in authResult) return authResult.error

  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        username: true,
        nom: true,
        commune: true,
        role: true,
        actif: true,
        lastLogin: true,
      }
    })
    return NextResponse.json({ users })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب المستخدمين' }, { status: 500 })
  }
}
