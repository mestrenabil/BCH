import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/documents — List documents with filtering
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const commune = searchParams.get('commune')
    const categorie = searchParams.get('categorie')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (commune && commune !== 'ALL') where.commune = commune
    if (categorie && categorie !== 'ALL') where.categorie = categorie
    if (search) {
      where.OR = [
        { titre: { contains: search } },
        { description: { contains: search } },
        { reference: { contains: search } },
        { nomFichier: { contains: search } },
      ]
    }

    const skip = (page - 1) * limit

    const [documents, total] = await Promise.all([
      db.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.document.count({ where }),
    ])

    // Get categories with counts
    const categories = await db.document.groupBy({
      by: ['categorie'],
      _count: { categorie: true },
      where: commune && commune !== 'ALL' ? { commune } : {},
    })

    return NextResponse.json({
      documents,
      total,
      page,
      limit,
      categories: categories.map((c) => ({
        categorie: c.categorie,
        count: c._count.categorie,
      })),
    })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json({ error: 'فشل في تحميل المستندات' }, { status: 500 })
  }
}

// POST /api/documents — Create a new document record
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { titre, description, categorie, commune, nomFichier, cheminFichier, typeFichier, tailleFichier, reference, dateDocument, uploadedBy } = body

    if (!titre || !nomFichier || !cheminFichier) {
      return NextResponse.json({ error: 'العنوان واسم الملف ومسار الملف مطلوبون' }, { status: 400 })
    }

    const document = await db.document.create({
      data: {
        titre,
        description: description || '',
        categorie: categorie || 'عام',
        commune: commune || '',
        nomFichier,
        cheminFichier,
        typeFichier: typeFichier || '',
        tailleFichier: tailleFichier || 0,
        reference: reference || '',
        dateDocument: dateDocument ? new Date(dateDocument) : null,
        uploadedBy: uploadedBy || '',
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Error creating document:', error)
    return NextResponse.json({ error: 'فشل في إنشاء المستند' }, { status: 500 })
  }
}
