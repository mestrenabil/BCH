import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, hashPassword, normalizeManagedCommunes, requireAdmin } from '@/lib/auth'
import { areCommunesInSameProvince, getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'
import { normalizeNavVisibilityJson } from '@/lib/user-nav-settings'

function normalizeRole(role: unknown): 'admin' | 'responsable' | 'agent' {
  if (role === 'admin') return 'admin'
  if (role === 'agent') return 'agent'
  return 'responsable'
}

const ALLOWED_NAV_KEYS = [
  'dashboard', 'map', 'interventions', 'agents', 'inventory', 'documents', 'calendar', 'complaints', 'workOrders', 'campagnes',
  'csvr', 'food', 'dossiers', 'sanitary', 'water', 'vector', 'funeral', 'environment', 'vigilance', 'authorizations', 'gis',
  'reportsOffice', 'calendarUnified', 'reports', 'operations', 'kpi', 'alerts', 'export', 'notifications', 'activityLog', 'timeline',
  'users', 'settings', 'helpCenter',
]

// GET /api/auth/users — List users (filtered by commune for non-admin)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ('error' in authResult) return authResult.error

    const { user: authUser } = authResult
    const communeScope = getScopedCommuneFilter(authUser, new URL(request.url).searchParams)
    const where = communeScope ? { OR: [{ commune: communeScope }, { commune: 'ALL' }] } : {}
    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        nom: true,
        commune: true,
        managedCommunes: true,
        communeGroupName: true,
        navVisibilityJson: true,
        role: true,
        agentId: true,
        agent: { select: { id: true, nom: true, prenom: true, commune: true } },
        actif: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('GET users error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل المستخدمين' }, { status: 500 })
  }
}

// POST /api/auth/users — Create a new user
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ('error' in authResult) return authResult.error

    const { user: authUser } = authResult
    const body = await request.json()
    const { username, password, nom, commune, role, agentId, territoryFilter, managedCommunes, communeGroupName, navVisibilityJson } = body
    const allowOutsideTerritory = body.allowOutsideTerritory === true && authUser.role === 'admin' && authUser.commune === 'ALL'

    // Validation
    if (!username || !password || !nom) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول المطلوبة' }, { status: 400 })
    }

    if (username.length < 3) {
      return NextResponse.json({ error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' }, { status: 400 })
    }

    if (password.length < 12) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 12 حرفاً على الأقل' }, { status: 400 })
    }

    const enforcedRole = normalizeRole(role)
    let enforcedCommune = enforcedRole === 'admin' ? 'ALL' : String(commune || '').trim()
    let enforcedAgentId: string | null = null
    let enforcedManagedCommunes: string[] = enforcedRole === 'responsable' ? normalizeManagedCommunes(managedCommunes) : []
    let enforcedGroupName: string | null = null

    if (enforcedManagedCommunes.length > 1) {
      if (!areCommunesInSameProvince(enforcedManagedCommunes)) {
        return NextResponse.json({ error: 'يجب أن تنتمي جماعات المجموعة إلى نفس الإقليم أو العمالة' }, { status: 400 })
      }
      enforcedGroupName = typeof communeGroupName === 'string' ? communeGroupName.trim().slice(0, 120) || null : null
      if (!enforcedGroupName) {
        return NextResponse.json({ error: 'يرجى إدخال اسم مجموعة الجماعات' }, { status: 400 })
      }
      enforcedCommune = enforcedManagedCommunes[0]
    } else if (enforcedManagedCommunes.length === 1) {
      enforcedCommune = enforcedManagedCommunes[0]
    }

    if (enforcedRole === 'responsable' && (!enforcedCommune || enforcedCommune === 'ALL')) {
      return NextResponse.json({ error: 'يجب تحديد جماعة صالحة للمسؤول المحلي' }, { status: 400 })
    }

    if (enforcedRole === 'agent') {
      const requestedAgentId = typeof agentId === 'string' ? agentId.trim() : ''
      if (!requestedAgentId) return NextResponse.json({ error: 'يجب ربط الحساب بعون ميداني' }, { status: 400 })
      const agent = await db.agent.findUnique({ where: { id: requestedAgentId }, include: { user: true } })
      if (!agent || !agent.actif) return NextResponse.json({ error: 'العون المختار غير نشط أو غير موجود' }, { status: 400 })
      if (agent.user) return NextResponse.json({ error: 'هذا العون مرتبط بحساب آخر بالفعل' }, { status: 409 })
      enforcedAgentId = agent.id
      enforcedCommune = agent.commune
      enforcedManagedCommunes = []
      enforcedGroupName = null
    }

    const territoryScope = getTerritoryFilterFromValue(territoryFilter)
    if (authUser.commune === 'ALL' && enforcedRole !== 'admin' && !allowOutsideTerritory && ![enforcedCommune, ...enforcedManagedCommunes].every((targetCommune) => isCommuneInTerritoryScope(targetCommune, territoryScope))) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي المحدد' }, { status: 403 })
    }

    // Check if username already exists
    const normalizedUsername = String(username).trim()
    const existing = await db.user.findUnique({ where: { username: normalizedUsername } })
    if (existing) {
      return NextResponse.json({ error: 'اسم المستخدم موجود مسبقاً' }, { status: 409 })
    }

    const newUser = await db.user.create({
      data: {
        username: normalizedUsername,
        password: hashPassword(password),
        nom,
        commune: enforcedCommune,
        managedCommunes: JSON.stringify(enforcedManagedCommunes),
        communeGroupName: enforcedGroupName,
        navVisibilityJson: normalizeNavVisibilityJson(navVisibilityJson, ALLOWED_NAV_KEYS),
        role: enforcedRole,
        agentId: enforcedAgentId,
      },
      select: {
        id: true,
        username: true,
        nom: true,
        commune: true,
        managedCommunes: true,
        communeGroupName: true,
        navVisibilityJson: true,
        role: true,
        agentId: true,
        agent: { select: { id: true, nom: true, prenom: true, commune: true } },
        actif: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ user: newUser }, { status: 201 })
  } catch (error) {
    console.error('POST user error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء المستخدم' }, { status: 500 })
  }
}
