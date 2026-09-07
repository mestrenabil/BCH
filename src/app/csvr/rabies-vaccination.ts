export const RABIES_EXPOSURE_LABELS: Record<string, string> = {
  UNKNOWN: 'غير مصنف — بانتظار تقييم المختص',
  I: 'الفئة I — تماس دون تعرض فعلي',
  II: 'الفئة II — خدوش/قضم سطحي دون نزيف',
  III: 'الفئة III — عضة نافذة أو لعاب على جلد متضرر',
}

export const RABIES_VACCINE_LABELS: Record<string, string> = {
  UNKNOWN: 'غير محدد بعد',
  HDCV: 'HDCV — لقاح خلايا ثنائية الصيغة البشرية',
  PCECV: 'PCECV — لقاح خلايا جنين الدجاج المنقّى',
  PVRV: 'PVRV — لقاح خلايا Vero المنقّى',
  CCEEV_OTHER: 'لقاح حديث مستنبت خلوي آخر',
  OTHER: 'نوع آخر — يحدد من طرف المرفق الصحي',
}

export const RABIES_ROUTE_LABELS: Record<string, string> = {
  UNKNOWN: 'غير محدد بعد',
  ID: 'داخل الأدمة (ID)',
  IM: 'داخل العضل (IM)',
}

export const RABIES_PROTOCOL_LABELS: Record<string, string> = {
  PENDING_ASSESSMENT: 'بانتظار تقييم المرفق الصحي',
  WHO_ID_2_SITE_0_3_7: 'WHO: داخل الأدمة، موقعان، الأيام 0 و3 و7',
  WHO_ID_PREVIOUSLY_VACCINATED_0_3: 'WHO: سبق التلقيح، داخل الأدمة، الأيام 0 و3',
  AUTHORITY_DEFINED: 'بروتوكول يحدده الطبيب/البرنامج الوطني',
  NO_PEP: 'لا يوجد تلقيح بعد التعرض — قرار مختص موثق',
}

export const VACCINATION_STEP_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'مقررة',
  DONE: 'منفذة',
  MISSED: 'لم تنفذ',
  CANCELLED: 'ملغاة',
}
