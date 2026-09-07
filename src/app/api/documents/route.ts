import { access, stat } from 'fs/promises'
import { constants } from 'fs'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canAccessCommune, getScopedCommuneFilter, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { getSecureDocumentPath, isAllowedDocument } from '@/lib/document-storage'
import { getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const commune = searchParams.get('commune')
    const categorie = searchParams.get('categorie')
    const search = searchParams.get('search')
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10) || 1, 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100)
    const conditions: Record<string, unknown>[] = []

    const communeFilter = getScopedCommuneFilter(user, searchParams)
    if (communeFilter) {
      conditions.push({ OR: [{ commune: communeFilter }, { commune: '' }, { commune: 'ALL' }] })
    } else if (commune && commune !== 'ALL') {
      conditions.push({ commune })
    }
    if (categorie && categorie !== 'ALL') conditions.push({ categorie })
    if (search) {
      const searchWhere = [
        { titre: { contains: search } },
        { description: { contains: search } },
        { reference: { contains: search } },
        { nomFichier: { contains: search } },
      ]
      conditions.push({ OR: searchWhere })
    }

    const where: Record<string, unknown> = conditions.length > 0 ? { AND: conditions } : {}

    const [documents, total] = await Promise.all([
      db.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          interventions: {
            include: {
              intervention: {
                select: {
                  id: true,
                  reference: true,
                  type: true,
                  date: true,
                  statut: true,
                  quartier: true,
                  commune: true,
                }
              }
            }
          }
        }
      }),
      db.document.count({ where }),
    ])

    const categories = await db.document.groupBy({
      by: ['categorie'],
      _count: { categorie: true },
      where,
    })

    return NextResponse.json({
      documents,
      total,
      page,
      limit,
      categories: categories.map((category) => ({
        categorie: category.categorie,
        count: category._count.categorie,
      })),
    })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json({ error: 'فشل في تحميل المستندات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const { titre, description, categorie, commune, nomFichier, cheminFichier, typeFichier, reference, dateDocument, territoryFilter } = body

    if (!titre || !nomFichier || !cheminFichier) {
      return NextResponse.json({ error: 'العنوان واسم الملف ومسار الملف مطلوبون' }, { status: 400 })
    }

    const storedFileName = String(cheminFichier)
    const storedFilePath = getSecureDocumentPath(storedFileName)
    if (!storedFilePath || !isAllowedDocument(String(nomFichier), typeFichier || undefined)) {
      return NextResponse.json({ error: 'بيانات الملف غير صالحة' }, { status: 400 })
    }

    try {
      await access(storedFilePath, constants.R_OK)
    } catch {
      return NextResponse.json({ error: 'الملف المرفوع غير موجود' }, { status: 400 })
    }

    const uploadedFile = await stat(storedFilePath)
    const documentDate = dateDocument ? new Date(dateDocument) : null
    if (documentDate && Number.isNaN(documentDate.getTime())) {
      return NextResponse.json({ error: 'تاريخ المستند غير صالح' }, { status: 400 })
    }

    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) {
      return NextResponse.json({ error: 'يرجى تحديد الجماعة قبل حفظ المستند' }, { status: 400 })
    }
    if (user.commune === 'ALL' && !isCommuneInTerritoryScope(enforcedCommune, getTerritoryFilterFromValue(territoryFilter))) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي المحدد' }, { status: 403 })
    }
    const document = await db.document.create({
      data: {
        titre: String(titre).trim(),
        description: description ? String(description) : '',
        categorie: categorie ? String(categorie) : 'عام',
        commune: enforcedCommune,
        nomFichier: String(nomFichier).trim(),
        cheminFichier: storedFileName,
        typeFichier: typeFichier ? String(typeFichier) : '',
        tailleFichier: uploadedFile.size,
        reference: reference ? String(reference) : '',
        dateDocument: documentDate,
        uploadedBy: user.nom,
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Error creating document:', error)
    return NextResponse.json({ error: 'فشل في إنشاء المستند' }, { status: 500 })
  }
}
