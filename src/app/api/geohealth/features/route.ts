import { NextRequest } from 'next/server'
import { GET as getGisPoints } from '@/app/api/gis/points/route'

// Phase 1: واجهة قراءة موحّدة تعيد نفس بيانات SIG مع الحفاظ على صلاحياته الترابية.
// لا تنشئ هذه الواجهة بيانات جديدة ولا تغيّر المخطط؛ وهي منفصلة حتى لا تكسر مستهلكي GIS الحاليين.
export async function GET(request: NextRequest) {
  return getGisPoints(request)
}
