import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canManageUserAccount, hashPassword, normalizeManagedCommunes, requireUserManager } from '@/lib/auth'
import { areCommunesInSameProvince, getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'
import { normalizeNavVisibilityJson } from '@/lib/user-nav-settings'
import { recordActivity } from '@/lib/activity-log'

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

// GET /api/auth/users/[id] — Get a single user
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireUserManager()
    if ('error' in authResult) return authResult.error
    const { user: authUser } = authResult
    const { id } = await params

    const user = await db.user.findUnique({
      where: { id },
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
    })

    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    if (!canManageUserAccount(authUser, user)) {
      return NextResponse.json({ error: 'لا يمكنك الوصول إلى حساب خارج نطاقك الترابي' }, { status: 403 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('GET user error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل المستخدم' }, { status: 500 })
  }
}

// PUT /api/auth/users/[id] — Update a user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireUserManager()
    if ('error' in authResult) return authResult.error
    const { user: authUser } = authResult
    const { id } = await params

    const existingUser = await db.user.findUnique({ where: { id } })
    if (!existingUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    if (!canManageUserAccount(authUser, existingUser)) {
      return NextResponse.json({ error: 'لا يمكنك تعديل هذا الحساب' }, { status: 403 })
    }

    const body = await request.json()
    const { nom, password, commune, role, actif, agentId, territoryFilter, managedCommunes, communeGroupName, navVisibilityJson } = body
    const allowOutsideTerritory = body.allowOutsideTerritory === true && authUser.role === 'admin' && authUser.commune === 'ALL'

    const updateData: Record<string, unknown> = {}

    if (nom !== undefined) updateData.nom = nom

    // Handle password change
    if (password && password.length > 0) {
      if (password.length < 12) {
        return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 12 حرفاً على الأقل' }, { status: 400 })
      }
      updateData.password = hashPassword(password)
    }

    const nextRole = role === undefined ? normalizeRole(existingUser.role) : normalizeRole(role)
    if (authUser.role !== 'admin' && nextRole === 'admin') {
      return NextResponse.json({ error: 'لا يمكن لمسؤول الجماعة منح صلاحية المسؤول العام' }, { status: 403 })
    }
    let nextCommune = nextRole === 'admin' ? 'ALL' : (commune === undefined ? existingUser.commune : String(commune).trim())
    let nextAgentId: string | null = null
    let nextManagedCommunes = nextRole === 'responsable'
      ? normalizeManagedCommunes(managedCommunes === undefined ? existingUser.managedCommunes : managedCommunes)
      : []
    let nextGroupName: string | null = null

    if (nextManagedCommunes.length > 1) {
      if (!areCommunesInSameProvince(nextManagedCommunes)) {
        return NextResponse.json({ error: 'يجب أن تنتمي جماعات المجموعة إلى نفس الإقليم أو العمالة' }, { status: 400 })
      }
      nextGroupName = typeof communeGroupName === 'string'
        ? communeGroupName.trim().slice(0, 120) || null
        : existingUser.communeGroupName
      if (!nextGroupName) return NextResponse.json({ error: 'يرجى إدخال اسم مجموعة الجماعات' }, { status: 400 })
      nextCommune = nextManagedCommunes[0]
    } else if (nextManagedCommunes.length === 1) {
      nextCommune = nextManagedCommunes[0]
    }

    if (nextRole === 'responsable' && (!nextCommune || nextCommune === 'ALL')) {
      return NextResponse.json({ error: 'يجب تحديد جماعة صالحة للمسؤول المحلي' }, { status: 400 })
    }

    if (nextRole === 'agent') {
      const requestedAgentId = agentId === undefined ? existingUser.agentId : (typeof agentId === 'string' ? agentId.trim() : '')
      if (!requestedAgentId) return NextResponse.json({ error: 'يجب ربط الحساب بعون ميداني' }, { status: 400 })
      const agent = await db.agent.findUnique({ where: { id: requestedAgentId }, include: { user: true } })
      if (!agent || !agent.actif) return NextResponse.json({ error: 'العون المختار غير نشط أو غير موجود' }, { status: 400 })
      if (agent.user && agent.user.id !== existingUser.id) {
        return NextResponse.json({ error: 'هذا العون مرتبط بحساب آخر بالفعل' }, { status: 409 })
      }
      nextAgentId = agent.id
      nextCommune = agent.commune
      nextManagedCommunes = []
      nextGroupName = null
    }

    if (!canManageUserAccount(authUser, {
      role: nextRole,
      commune: nextCommune,
      managedCommunes: nextManagedCommunes,
    })) {
      return NextResponse.json({ error: 'لا يمكنك نقل الحساب أو توسيع نطاقه خارج الجماعات المسندة إليك' }, { status: 403 })
    }

    const territoryScope = getTerritoryFilterFromValue(territoryFilter)
    if (authUser.commune === 'ALL' && nextRole !== 'admin' && !allowOutsideTerritory && ![nextCommune, ...nextManagedCommunes].every((targetCommune) => isCommuneInTerritoryScope(targetCommune, territoryScope))) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي المحدد' }, { status: 403 })
    }

    updateData.role = nextRole
    updateData.commune = nextCommune
    updateData.managedCommunes = JSON.stringify(nextManagedCommunes)
    updateData.communeGroupName = nextGroupName
    updateData.navVisibilityJson = normalizeNavVisibilityJson(navVisibilityJson ?? existingUser.navVisibilityJson, ALLOWED_NAV_KEYS)
    updateData.agentId = nextAgentId

    if (actif !== undefined) updateData.actif = actif

    if (existingUser.id === authUser.id && actif === false) {
      return NextResponse.json({ error: 'لا يمكنك تعطيل حسابك الخاص' }, { status: 400 })
    }

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
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
    })

    await recordActivity({
      user: authUser,
      action: 'UPDATE',
      entityType: 'USER',
      entityId: updatedUser.id,
      commune: updatedUser.commune,
      details: { username: updatedUser.username, role: updatedUser.role, actif: updatedUser.actif },
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('PUT user error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث المستخدم' }, { status: 500 })
  }
}

// DELETE /api/auth/users/[id] — Delete a user
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireUserManager()
    if ('error' in authResult) return authResult.error
    const { user: authUser } = authResult
    const { id } = await params

    const existingUser = await db.user.findUnique({ where: { id } })
    if (!existingUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    if (!canManageUserAccount(authUser, existingUser)) {
      return NextResponse.json({ error: 'لا يمكنك حذف هذا الحساب' }, { status: 403 })
    }

    if (existingUser.id === authUser.id) {
      return NextResponse.json({ error: 'لا يمكنك حذف حسابك الخاص' }, { status: 400 })
    }

    if (existingUser.role === 'admin') {
      const activeAdmins = await db.user.count({ where: { role: 'admin', actif: true } })
      if (activeAdmins <= 1) {
        return NextResponse.json({ error: 'لا يمكن حذف آخر مسؤول عام نشط' }, { status: 400 })
      }
    }

    await db.$transaction([
      db.session.deleteMany({ where: { userId: id } }),
      db.user.delete({ where: { id } }),
    ])

    await recordActivity({
      user: authUser,
      action: 'DELETE',
      entityType: 'USER',
      entityId: existingUser.id,
      commune: existingUser.commune,
      details: { username: existingUser.username, role: existingUser.role },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE user error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف المستخدم' }, { status: 500 })
  }
}
