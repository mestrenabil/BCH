import { readFile, unlink } from 'fs/promises'
import { db } from '@/lib/db'
import { canAccessCommune, requireAuth, type AuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { getCsvrPhotoPath } from '@/lib/csvr-photo-storage'

export const runtime = 'nodejs'

type PhotoKind = 'report' | 'mission' | 'animal'

type ResolvedPhoto = {
  kind: PhotoKind
  storedFileName: string
  mimeType: string
  commune: string
  user: AuthUser
}

async function resolvePhoto(photoId: string): Promise<{ error: NextResponse } | ResolvedPhoto> {
  const authResult = await requireAuth()
  if ('error' in authResult) return { error: authResult.error }
  const user = authResult.user

  // Try report photo first
  const reportPhoto = await db.strayReportPhoto.findUnique({
    where: { id: photoId },
    include: { report: { select: { commune: true } } },
  })
  if (reportPhoto) {
    if (!canAccessCommune(user, reportPhoto.report.commune)) {
      return { error: NextResponse.json({ error: 'ليست لديك صلاحية الوصول إلى هذه الصورة' }, { status: 403 }) }
    }
    return {
      kind: 'report',
      storedFileName: reportPhoto.storedFileName,
      mimeType: reportPhoto.mimeType,
      commune: reportPhoto.report.commune,
      user,
    }
  }

  // Try mission photo
  const missionPhoto = await db.captureMissionPhoto.findUnique({
    where: { id: photoId },
    include: { mission: { select: { commune: true } } },
  })
  if (missionPhoto) {
    if (!canAccessCommune(user, missionPhoto.mission.commune)) {
      return { error: NextResponse.json({ error: 'ليست لديك صلاحية الوصول إلى هذه الصورة' }, { status: 403 }) }
    }
    return {
      kind: 'mission',
      storedFileName: missionPhoto.storedFileName,
      mimeType: missionPhoto.mimeType,
      commune: missionPhoto.mission.commune,
      user,
    }
  }

  // Try animal photo
  const animalPhoto = await db.strayAnimalPhoto.findUnique({
    where: { id: photoId },
    include: { animal: { select: { commune: true } } },
  })
  if (animalPhoto) {
    if (!canAccessCommune(user, animalPhoto.animal.commune)) {
      return { error: NextResponse.json({ error: 'ليست لديك صلاحية الوصول إلى هذه الصورة' }, { status: 403 }) }
    }
    return {
      kind: 'animal',
      storedFileName: animalPhoto.storedFileName,
      mimeType: animalPhoto.mimeType,
      commune: animalPhoto.animal.commune,
      user,
    }
  }

  return { error: NextResponse.json({ error: 'الصورة غير موجودة' }, { status: 404 }) }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  try {
    const { photoId } = await params
    const result = await resolvePhoto(photoId)
    if ('error' in result) return result.error

    const storedFilePath = getCsvrPhotoPath(result.storedFileName)
    if (!storedFilePath) return NextResponse.json({ error: 'مسار الصورة غير صالح' }, { status: 404 })

    const file = await readFile(storedFilePath)
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': result.mimeType,
        'Content-Disposition': 'inline; filename="csvr-photo"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('GET csvr photo error:', error)
    return NextResponse.json({ error: 'تعذر تحميل الصورة' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  try {
    const { photoId } = await params
    const result = await resolvePhoto(photoId)
    if ('error' in result) return result.error

    const storedFilePath = getCsvrPhotoPath(result.storedFileName)
    if (result.kind === 'report') {
      await db.strayReportPhoto.delete({ where: { id: photoId } })
    } else if (result.kind === 'mission') {
      await db.captureMissionPhoto.delete({ where: { id: photoId } })
    } else {
      await db.strayAnimalPhoto.delete({ where: { id: photoId } })
    }
    if (storedFilePath) await unlink(storedFilePath).catch(() => undefined)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE csvr photo error:', error)
    return NextResponse.json({ error: 'تعذر حذف الصورة' }, { status: 500 })
  }
}
