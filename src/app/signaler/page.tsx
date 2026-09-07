'use client'

import dynamic from 'next/dynamic'
import { FormEvent, useEffect, useRef, useState } from 'react'
import catalogJson from '../../../public/geography/catalog.json'
import type { TerritoryCatalog } from '@/lib/geography'
import { displayCommuneName, displayLinkedCommune, type PublicLanguage } from '@/lib/public-territory'

const COMMUNES = Array.from(new Set((catalogJson as TerritoryCatalog).communes.map((commune) => (
  commune.nameAr || commune.name || commune.nameFr
)))).sort((first, second) => first.localeCompare(second, 'ar'))

const PUBLIC_COPY: Record<PublicLanguage, {
  platformLabel: string; platformName: string; back: string; employeeLogin: string; badge: string
  eyebrow: string; heroTitle: string; heroDescription: string; gpsTag: string; communeTag: string; referenceTag: string
  stepType: string; stepDetails: string; stepTrack: string; stepOne: string; mapTitle: string; mapDescription: string; typeOverview: string
  typeQuestion: string; typeHint: string; oneChoice: string; locationStatus: string; locationLinked: string
  locationWaiting: string; useGps: string; detectedCommune: string; region: string; province: string; locating: string
  mapHint: string; coordinates: string; coordinatesWaiting: string; continue: string; successTitle: string; keepReference: string
  emailSent: string; emailNotConfigured: string; emailFailed: string; whatsapp: string; newReport: string
  formTitle: string; formSubtitle: string; fullName: string; phone: string; email: string; selectedType: string
  changeType: string; priority: string; commune: string; chooseCommune: string; autoDetected: string; neighborhood: string
  description: string; descriptionPlaceholder: string; reportLocation: string; editLocation: string; latitude: string; longitude: string; send: string
  sending: string; protected: string; trackingTitle: string; trackingSubtitle: string; trackingPlaceholder: string
  track: string; tracking: string; statusReceived: string; statusProcessing: string; statusDone: string; statusRejected: string
  locationOutside: string; locationFailed: string; locationUnavailable: string; connectionFailed: string; invalidTracking: string
}> = {
  ar: {
    platformLabel: 'المنصة المندمجة', platformName: 'لتدبير قسم الوقاية وحفظ الصحة', back: '← العودة إلى المنصة', employeeLogin: '🔐 دخول الموظفين', badge: '📍 بلاغ موحّد بالموقع',
    eyebrow: 'المنصة المندمجة لتدبير قسم الوقاية وحفظ الصحة', heroTitle: 'بلّغ عن مشكل في محيطك بسهولة', heroDescription: 'أرسل بلاغك حول الوقاية وحفظ الصحة أو السلامة الغذائية أو الحيوانات الشاردة من نموذج موحّد. حدد الموقع على الخريطة ليظهر مباشرة للموظفين داخل الجماعة، وسيظهر لك مرجع سري لتتبع الحالة.',
    gpsTag: '✓ تحديد الموقع عبر GPS', communeTag: '✓ توجيه مباشر للجماعة', referenceTag: '✓ مرجع سري للتتبع', stepType: 'حدد النوع والموقع', stepDetails: 'أدخل التفاصيل', stepTrack: 'تتبع البلاغ', stepOne: 'الخطوة الأولى', mapTitle: 'حدد نوع البلاغ وموقعه', mapDescription: 'سيتم تحديد موقعك الحالي عبر GPS وربط البلاغ تلقائياً بالجماعة التي يوجد فيها. يمكنك أيضاً النقر على الخريطة لتصحيح الموقع.', typeOverview: 'نبذة عن:',
    typeQuestion: 'ما نوع البلاغ؟', typeHint: 'اختر التصنيف الأقرب للمشكل الذي تريد التبليغ عنه.', oneChoice: 'اختيار واحد', locationStatus: 'حالة الموقع', locationLinked: 'مربوط بجماعة', locationWaiting: 'في انتظار تحديد الموقع', useGps: '📡 تحديد موقعي تلقائياً', detectedCommune: '✓ الجماعة المحددة:', region: 'الجهة:', province: 'الإقليم:', locating: '⏳ جارٍ ربط الموقع بالجماعة…', mapHint: 'انقر على الخريطة لاختيار الموقع بدقة، أو استخدم زر تحديد موقعي.', coordinates: 'الإحداثيات:', coordinatesWaiting: 'سيتم حفظ إحداثيات الموقع مع البلاغ', continue: 'متابعة بيانات البلاغ ←',
    successTitle: 'تم تسجيل بلاغك بنجاح', keepReference: 'احتفظ بهذا المرجع لتتبع حالة البلاغ:', emailSent: 'تم إرسال المرجع أيضاً إلى بريدك الإلكتروني.', emailNotConfigured: 'تم تسجيل البلاغ، لكن خدمة البريد غير مهيأة حالياً. يرجى الاحتفاظ بالمرجع الظاهر أعلاه.', emailFailed: 'تم تسجيل البلاغ، لكن تعذر إرسال البريد حالياً. يرجى الاحتفاظ بالمرجع الظاهر أعلاه.', whatsapp: '💬 إرسال المرجع عبر واتساب', newReport: 'إرسال بلاغ آخر',
    formTitle: 'بيانات البلاغ', formSubtitle: 'أكمل المعلومات الأساسية حتى يتمكن الفريق من معالجة البلاغ.', fullName: 'الاسم الكامل *', phone: 'رقم الهاتف', email: 'البريد الإلكتروني لاستلام المرجع *', selectedType: 'نوع البلاغ المحدد', changeType: 'تغيير النوع', priority: 'درجة الأولوية', commune: 'الجماعة *', chooseCommune: '— اختر الجماعة —', autoDetected: '✓ محددة تلقائياً', neighborhood: 'الحي', description: 'وصف المشكل *', descriptionPlaceholder: 'صف مكان المشكل وطبيعته وأي معلومة مفيدة للفريق الميداني.', reportLocation: '📍 موقع البلاغ', editLocation: 'تعديل الموقع', latitude: 'خط العرض', longitude: 'خط الطول', send: '📨 إرسال البلاغ', sending: 'جارٍ إرسال البلاغ…', protected: 'تُعالج البلاغات من طرف المكتب الجماعي للنظافة · جميع البيانات محمية',
    trackingTitle: 'تتبع حالة البلاغ', trackingSubtitle: 'أدخل المرجع الذي ظهر لك بعد الإرسال. لا نطلب الاسم أو رقم الهاتف للتتبع.', trackingPlaceholder: 'SIG-2026-…', track: 'تتبع الحالة', tracking: 'جارٍ التحقق…', statusReceived: 'تم استلام البلاغ', statusProcessing: 'البلاغ قيد المعالجة', statusDone: 'تمت معالجة البلاغ', statusRejected: 'تعذر قبول البلاغ', locationOutside: '⚠️ الموقع المحدد خارج نطاق الجماعات المعروفة. يرجى اختيار موقع داخل المغرب.', locationFailed: 'تم تحديد الموقع، لكن تعذر ربطه بجماعة معروفة.', locationUnavailable: 'تعذر تحديد الجماعة تلقائياً. يرجى اختيارها يدوياً من القائمة.', connectionFailed: 'تعذر الاتصال بالخدمة. يرجى المحاولة لاحقاً.', invalidTracking: 'تعذر تتبع البلاغ.',
  },
  fr: {
    platformLabel: 'Plateforme intégrée', platformName: 'Gestion du service de prévention et d’hygiène', back: '← Retour à la plateforme', employeeLogin: '🔐 Accès employés', badge: '📍 Signalement géolocalisé',
    eyebrow: 'Plateforme intégrée de gestion du service de prévention et d’hygiène', heroTitle: 'Signalez facilement un problème dans votre environnement', heroDescription: 'Envoyez un signalement concernant la prévention, l’hygiène, la sécurité alimentaire ou les animaux errants. Localisez le problème sur la carte pour l’orienter directement vers la commune concernée et recevez une référence confidentielle de suivi.',
    gpsTag: '✓ Localisation GPS', communeTag: '✓ Orientation vers la commune', referenceTag: '✓ Référence confidentielle', stepType: 'Type et localisation', stepDetails: 'Détails du signalement', stepTrack: 'Suivi', stepOne: 'Première étape', mapTitle: 'Choisissez le type et le lieu', mapDescription: 'Votre position peut être détectée par GPS et le signalement sera automatiquement rattaché à la commune correspondante. Vous pouvez aussi cliquer sur la carte pour corriger le lieu.', typeOverview: 'À propos de :',
    typeQuestion: 'Quel est le type du signalement ?', typeHint: 'Choisissez la catégorie qui correspond le mieux au problème.', oneChoice: 'Un seul choix', locationStatus: 'État de la localisation', locationLinked: 'Rattaché à la commune', locationWaiting: 'Localisation en attente', useGps: '📡 Utiliser ma position', detectedCommune: '✓ Commune détectée :', region: 'Région :', province: 'Préfecture / Province :', locating: '⏳ Rattachement à la commune en cours…', mapHint: 'Cliquez sur la carte pour choisir précisément le lieu ou utilisez la géolocalisation.', coordinates: 'Coordonnées :', coordinatesWaiting: 'Les coordonnées seront enregistrées avec le signalement', continue: 'Continuer vers les détails →',
    successTitle: 'Votre signalement a été enregistré', keepReference: 'Conservez cette référence pour suivre son état :', emailSent: 'La référence a également été envoyée par e-mail.', emailNotConfigured: 'Le signalement est enregistré, mais le service e-mail n’est pas configuré. Conservez la référence affichée ci-dessus.', emailFailed: 'Le signalement est enregistré, mais l’envoi de l’e-mail a échoué. Conservez la référence affichée ci-dessus.', whatsapp: '💬 Envoyer la référence sur WhatsApp', newReport: 'Nouveau signalement',
    formTitle: 'Détails du signalement', formSubtitle: 'Complétez les informations nécessaires au traitement par l’équipe.', fullName: 'Nom complet *', phone: 'Téléphone', email: 'E-mail pour recevoir la référence *', selectedType: 'Type sélectionné', changeType: 'Modifier le type', priority: 'Niveau de priorité', commune: 'Commune *', chooseCommune: '— Choisir la commune —', autoDetected: '✓ Détectée automatiquement', neighborhood: 'Quartier', description: 'Description du problème *', descriptionPlaceholder: 'Décrivez le lieu, la nature du problème et toute information utile à l’équipe.', reportLocation: '📍 Lieu du signalement', editLocation: 'Modifier le lieu', latitude: 'Latitude', longitude: 'Longitude', send: '📨 Envoyer le signalement', sending: 'Envoi en cours…', protected: 'Les signalements sont traités par le bureau communal d’hygiène · Données protégées',
    trackingTitle: 'Suivre l’état du signalement', trackingSubtitle: 'Saisissez la référence reçue après l’envoi. Aucun nom ni téléphone n’est nécessaire.', trackingPlaceholder: 'SIG-2026-…', track: 'Suivre l’état', tracking: 'Vérification…', statusReceived: 'Signalement reçu', statusProcessing: 'Signalement en cours de traitement', statusDone: 'Signalement traité', statusRejected: 'Signalement non accepté', locationOutside: '⚠️ Le lieu est en dehors des communes connues. Choisissez un emplacement au Maroc.', locationFailed: 'Lieu détecté, mais aucune commune connue ne correspond.', locationUnavailable: 'Impossible de déterminer la commune automatiquement. Choisissez-la dans la liste.', connectionFailed: 'Connexion au service impossible. Veuillez réessayer plus tard.', invalidTracking: 'Impossible de suivre le signalement.',
  },
  en: {
    platformLabel: 'Integrated platform', platformName: 'Prevention and Hygiene Service Management', back: '← Back to the platform', employeeLogin: '🔐 Employee access', badge: '📍 Geolocated report',
    eyebrow: 'Integrated Prevention and Hygiene Service Management Platform', heroTitle: 'Report a problem in your area', heroDescription: 'Submit a report about prevention, hygiene, food safety or stray animals. Locate the issue on the map so it reaches the relevant commune team, and receive a private tracking reference.',
    gpsTag: '✓ GPS location', communeTag: '✓ Direct commune routing', referenceTag: '✓ Private tracking reference', stepType: 'Type and location', stepDetails: 'Report details', stepTrack: 'Track report', stepOne: 'First step', mapTitle: 'Choose the type and location', mapDescription: 'Your current location can be detected using GPS and the report will be linked automatically to the relevant commune. You can also click the map to adjust the location.', typeOverview: 'About:',
    typeQuestion: 'What is the report type?', typeHint: 'Choose the category that best describes the problem.', oneChoice: 'Choose one', locationStatus: 'Location status', locationLinked: 'Linked to commune', locationWaiting: 'Waiting for location', useGps: '📡 Use my location', detectedCommune: '✓ Detected commune:', region: 'Region:', province: 'Province:', locating: '⏳ Linking the location to a commune…', mapHint: 'Click the map to select the exact location, or use GPS.', coordinates: 'Coordinates:', coordinatesWaiting: 'The location coordinates will be saved with the report', continue: 'Continue to report details →',
    successTitle: 'Your report was registered', keepReference: 'Keep this reference to track its status:', emailSent: 'The reference was also sent to your email.', emailNotConfigured: 'The report was registered, but email service is not configured. Keep the reference shown above.', emailFailed: 'The report was registered, but the email could not be sent. Keep the reference shown above.', whatsapp: '💬 Send reference via WhatsApp', newReport: 'Submit another report',
    formTitle: 'Report details', formSubtitle: 'Complete the essential information so the team can process your report.', fullName: 'Full name *', phone: 'Phone number', email: 'Email to receive the reference *', selectedType: 'Selected report type', changeType: 'Change type', priority: 'Priority level', commune: 'Commune *', chooseCommune: '— Choose a commune —', autoDetected: '✓ Detected automatically', neighborhood: 'Neighborhood', description: 'Problem description *', descriptionPlaceholder: 'Describe the location, the nature of the problem and any information useful to the field team.', reportLocation: '📍 Report location', editLocation: 'Edit location', latitude: 'Latitude', longitude: 'Longitude', send: '📨 Submit report', sending: 'Submitting…', protected: 'Reports are handled by the communal hygiene office · Your data is protected',
    trackingTitle: 'Track report status', trackingSubtitle: 'Enter the reference shown after submission. No name or phone number is required.', trackingPlaceholder: 'SIG-2026-…', track: 'Track status', tracking: 'Checking…', statusReceived: 'Report received', statusProcessing: 'Report is being processed', statusDone: 'Report processed', statusRejected: 'Report could not be accepted', locationOutside: '⚠️ The selected location is outside known communes. Choose a location in Morocco.', locationFailed: 'Location selected, but it could not be linked to a known commune.', locationUnavailable: 'The commune could not be detected automatically. Choose one from the list.', connectionFailed: 'Unable to connect to the service. Please try again later.', invalidTracking: 'Unable to track the report.',
  },
  es: {
    platformLabel: 'Plataforma integrada', platformName: 'Gestión del Servicio de Prevención e Higiene', back: '← Volver a la plataforma', employeeLogin: '🔐 Acceso del personal', badge: '📍 Reporte geolocalizado',
    eyebrow: 'Plataforma integrada de gestión del Servicio de Prevención e Higiene', heroTitle: 'Informa fácilmente de un problema en tu entorno', heroDescription: 'Envía un reporte sobre prevención, higiene, seguridad alimentaria o animales vagabundos. Localiza el problema en el mapa para dirigirlo a la comuna correspondiente y recibe una referencia privada de seguimiento.',
    gpsTag: '✓ Ubicación GPS', communeTag: '✓ Envío directo a la comuna', referenceTag: '✓ Referencia privada', stepType: 'Tipo y ubicación', stepDetails: 'Detalles del reporte', stepTrack: 'Seguimiento', stepOne: 'Primer paso', mapTitle: 'Selecciona el tipo y la ubicación', mapDescription: 'Tu ubicación puede detectarse mediante GPS y el reporte se vinculará automáticamente a la comuna correspondiente. También puedes hacer clic en el mapa para corregirla.', typeOverview: 'Descripción de:',
    typeQuestion: '¿Cuál es el tipo de reporte?', typeHint: 'Elige la categoría que mejor describe el problema.', oneChoice: 'Una sola opción', locationStatus: 'Estado de la ubicación', locationLinked: 'Vinculado a la comuna', locationWaiting: 'Esperando ubicación', useGps: '📡 Usar mi ubicación', detectedCommune: '✓ Comuna detectada:', region: 'Región:', province: 'Prefectura / Provincia:', locating: '⏳ Vinculando la ubicación a una comuna…', mapHint: 'Haz clic en el mapa para elegir la ubicación exacta o utiliza el GPS.', coordinates: 'Coordenadas:', coordinatesWaiting: 'Las coordenadas se guardarán con el reporte', continue: 'Continuar con los detalles →',
    successTitle: 'Tu reporte ha sido registrado', keepReference: 'Conserva esta referencia para consultar su estado:', emailSent: 'La referencia también se ha enviado a tu correo electrónico.', emailNotConfigured: 'El reporte se registró, pero el servicio de correo no está configurado. Conserva la referencia mostrada arriba.', emailFailed: 'El reporte se registró, pero no se pudo enviar el correo. Conserva la referencia mostrada arriba.', whatsapp: '💬 Enviar la referencia por WhatsApp', newReport: 'Enviar otro reporte',
    formTitle: 'Detalles del reporte', formSubtitle: 'Completa la información necesaria para que el equipo pueda tramitarlo.', fullName: 'Nombre completo *', phone: 'Teléfono', email: 'Correo para recibir la referencia *', selectedType: 'Tipo seleccionado', changeType: 'Cambiar tipo', priority: 'Nivel de prioridad', commune: 'Comuna *', chooseCommune: '— Elegir comuna —', autoDetected: '✓ Detectada automáticamente', neighborhood: 'Barrio', description: 'Descripción del problema *', descriptionPlaceholder: 'Describe el lugar, la naturaleza del problema y cualquier información útil para el equipo de campo.', reportLocation: '📍 Ubicación del reporte', editLocation: 'Editar ubicación', latitude: 'Latitud', longitude: 'Longitud', send: '📨 Enviar reporte', sending: 'Enviando…', protected: 'Los reportes son gestionados por la oficina comunal de higiene · Tus datos están protegidos',
    trackingTitle: 'Consultar el estado del reporte', trackingSubtitle: 'Introduce la referencia mostrada después del envío. No se necesita nombre ni teléfono.', trackingPlaceholder: 'SIG-2026-…', track: 'Consultar estado', tracking: 'Verificando…', statusReceived: 'Reporte recibido', statusProcessing: 'Reporte en proceso', statusDone: 'Reporte tramitado', statusRejected: 'No se pudo aceptar el reporte', locationOutside: '⚠️ La ubicación está fuera de las comunas conocidas. Elige una ubicación en Marruecos.', locationFailed: 'Ubicación seleccionada, pero no se pudo vincular a una comuna conocida.', locationUnavailable: 'No se pudo detectar la comuna automáticamente. Elígela en la lista.', connectionFailed: 'No se puede conectar con el servicio. Inténtalo más tarde.', invalidTracking: 'No se puede consultar el reporte.',
  },
}

const PUBLIC_TYPE_OPTIONS: Record<PublicLanguage, { value: string; label: string; icon: string; description: string }[]> = {
  ar: [
    { value: 'DERATISATION', label: 'مكافحة القوارض', icon: '🐁', description: 'التبليغ عن انتشار الجرذان أو الفئران أو آثار وجودها داخل الأحياء والمرافق.' },
    { value: 'DESINSECTISATION', label: 'مكافحة الحشرات', icon: '🪲', description: 'التبليغ عن انتشار الحشرات مثل البعوض أو الصراصير أو الحشرات الضارة.' },
    { value: 'DESINFECTION', label: 'التطهير والتعقيم', icon: '🧴', description: 'طلب أو التبليغ عن الحاجة إلى تطهير وتعقيم مكان أو مرفق للحد من مصادر العدوى.' },
    { value: 'FOOD', label: 'سلامة غذائية', icon: '🥗', description: 'التبليغ عن مشكل مرتبط بنظافة الأغذية أو المطاعم أو المحلات أو شروط حفظ المواد الغذائية.' },
    { value: 'ANIMAL', label: 'حيوان شارد', icon: '🐾', description: 'التبليغ عن حيوان شارد أو عدواني أو حيوان يحتاج إلى تدخل المصالح المختصة.' },
    { value: 'ENVIRONMENT', label: 'بلاغ بيئي', icon: '🌿', description: 'التبليغ عن تلوث أو نفايات أو ضرر بيئي أو خطر يهدد المحيط.' },
  ],
  fr: [
    { value: 'DERATISATION', label: 'Rongeurs', icon: '🐁', description: 'Signalez la présence de rats, de souris ou de traces de rongeurs dans les quartiers et équipements.' },
    { value: 'DESINSECTISATION', label: 'Insectes', icon: '🪲', description: 'Signalez la prolifération de moustiques, cafards ou autres insectes nuisibles.' },
    { value: 'DESINFECTION', label: 'Désinfection', icon: '🧴', description: 'Demandez une désinfection ou signalez le besoin de traiter un lieu ou un équipement.' },
    { value: 'FOOD', label: 'Sécurité alimentaire', icon: '🥗', description: 'Signalez un problème d’hygiène, de conservation ou de sécurité alimentaire dans un établissement.' },
    { value: 'ANIMAL', label: 'Animal errant', icon: '🐾', description: 'Signalez un animal errant, agressif ou nécessitant l’intervention des services compétents.' },
    { value: 'ENVIRONMENT', label: 'Environnement', icon: '🌿', description: 'Signalez une pollution, des déchets ou un risque affectant l’environnement.' },
  ],
  en: [
    { value: 'DERATISATION', label: 'Rodent control', icon: '🐁', description: 'Report rats, mice or signs of rodents in neighborhoods and public facilities.' },
    { value: 'DESINSECTISATION', label: 'Insect control', icon: '🪲', description: 'Report an infestation of mosquitoes, cockroaches or other harmful insects.' },
    { value: 'DESINFECTION', label: 'Disinfection', icon: '🧴', description: 'Request or report the need to disinfect a place or facility to reduce health risks.' },
    { value: 'FOOD', label: 'Food safety', icon: '🥗', description: 'Report a hygiene, storage or food safety issue in a restaurant, shop or facility.' },
    { value: 'ANIMAL', label: 'Stray animal', icon: '🐾', description: 'Report a stray or aggressive animal that requires intervention by the relevant services.' },
    { value: 'ENVIRONMENT', label: 'Environmental report', icon: '🌿', description: 'Report pollution, waste or a risk affecting the local environment.' },
  ],
  es: [
    { value: 'DERATISATION', label: 'Control de roedores', icon: '🐁', description: 'Informa de la presencia de ratas, ratones o señales de roedores en barrios y espacios públicos.' },
    { value: 'DESINSECTISATION', label: 'Control de insectos', icon: '🪲', description: 'Informa de una proliferación de mosquitos, cucarachas u otros insectos nocivos.' },
    { value: 'DESINFECTION', label: 'Desinfección', icon: '🧴', description: 'Solicita o informa de la necesidad de desinfectar un lugar o una instalación.' },
    { value: 'FOOD', label: 'Seguridad alimentaria', icon: '🥗', description: 'Informa de un problema de higiene, conservación o seguridad alimentaria en un establecimiento.' },
    { value: 'ANIMAL', label: 'Animal vagabundo', icon: '🐾', description: 'Informa de un animal vagabundo o agresivo que requiere la intervención de los servicios competentes.' },
    { value: 'ENVIRONMENT', label: 'Medio ambiente', icon: '🌿', description: 'Informa de contaminación, residuos o un riesgo para el medio ambiente local.' },
  ],
}

const PUBLIC_PRIORITY_OPTIONS: Record<PublicLanguage, { value: string; label: string; color: string }[]> = {
  ar: [{ value: 'NORMALE', label: 'عادية', color: '#3b82f6' }, { value: 'HAUTE', label: 'عالية', color: '#f59e0b' }, { value: 'URGENTE', label: 'عاجلة', color: '#ef4444' }, { value: 'BASSE', label: 'منخفضة', color: '#94a3b8' }],
  fr: [{ value: 'NORMALE', label: 'Normale', color: '#3b82f6' }, { value: 'HAUTE', label: 'Haute', color: '#f59e0b' }, { value: 'URGENTE', label: 'Urgente', color: '#ef4444' }, { value: 'BASSE', label: 'Basse', color: '#94a3b8' }],
  en: [{ value: 'NORMALE', label: 'Normal', color: '#3b82f6' }, { value: 'HAUTE', label: 'High', color: '#f59e0b' }, { value: 'URGENTE', label: 'Urgent', color: '#ef4444' }, { value: 'BASSE', label: 'Low', color: '#94a3b8' }],
  es: [{ value: 'NORMALE', label: 'Normal', color: '#3b82f6' }, { value: 'HAUTE', label: 'Alta', color: '#f59e0b' }, { value: 'URGENTE', label: 'Urgente', color: '#ef4444' }, { value: 'BASSE', label: 'Baja', color: '#94a3b8' }],
}

function normalizeWhatsAppNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('0')) return `212${digits.slice(1)}`
  return digits
}

type FormState = {
  nomCitoyen: string
  telephone: string
  email: string
  quartier: string
  commune: string
  type: string
  description: string
  priorite: string
  latitude: string
  longitude: string
  website: string // honeypot
}

const INITIAL_FORM: FormState = {
  nomCitoyen: '',
  telephone: '',
  email: '',
  quartier: '',
  commune: '',
  type: 'DERATISATION',
  description: '',
  priorite: 'NORMALE',
  latitude: '',
  longitude: '',
  website: '',
}

type PublicComplaintPageProps = {
  onEmployeeLogin?: () => void
}

const PublicReportMap = dynamic(() => import('../public-report-map'), {
  ssr: false,
  loading: () => <div className="h-[25rem] w-full animate-pulse rounded-2xl bg-slate-200" />,
})

export default function PublicComplaintPage({ onEmployeeLogin }: PublicComplaintPageProps = {}) {
  const [language, setLanguage] = useState<PublicLanguage>('ar')
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [reference, setReference] = useState('')
  const [submittedTelephone, setSubmittedTelephone] = useState('')
  const [emailDelivery, setEmailDelivery] = useState('')
  const [trackingReference, setTrackingReference] = useState('')
  const [trackingMessage, setTrackingMessage] = useState('')
  const [trackingLoading, setTrackingLoading] = useState(false)

  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number; token: number } | null>(null)
  const [locationConfirmed, setLocationConfirmed] = useState(false)
  const copy = PUBLIC_COPY[language]
  const typeOptions = PUBLIC_TYPE_OPTIONS[language]
  const priorityOptions = PUBLIC_PRIORITY_OPTIONS[language]
  const isRtl = language === 'ar'

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem('public-report-language') as PublicLanguage | null
    if (savedLanguage && savedLanguage in PUBLIC_COPY) setLanguage(savedLanguage)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('public-report-language', language)
  }, [language])

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const [detectedCommuneInfo, setDetectedCommuneInfo] = useState<{ commune: string; province?: string; region?: string } | null>(null)
  const [detectingCommune, setDetectingCommune] = useState(false)
  const [locationWarning, setLocationWarning] = useState('')

  const detectCommune = async (lat: number, lng: number) => {
    setDetectingCommune(true)
    setLocationWarning('')
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
      const data = await res.json().catch(() => ({}))
      if (data.found && data.commune) {
        updateField('commune', data.commune)
        setLocationConfirmed(true)
        setDetectedCommuneInfo({ commune: data.commune, province: data.province, region: data.region })
        return data.commune as string
      } else {
        setDetectedCommuneInfo(null)
        setLocationWarning(copy.locationOutside)
        return null
      }
    } catch {
      setDetectedCommuneInfo(null)
      setLocationWarning(copy.locationUnavailable)
      return null
    } finally {
      setDetectingCommune(false)
    }
  }

  const selectLocation = (lat: number, lng: number, focusMap = false) => {
    updateField('latitude', lat.toFixed(6))
    updateField('longitude', lng.toFixed(6))
    if (focusMap) setMapFocus({ lat, lng, token: Date.now() })
    setLocationConfirmed(false)
    detectCommune(lat, lng).then((found) => {
      if (!found) setLocationWarning(copy.locationFailed)
    })
  }

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setLocationWarning(copy.locationUnavailable)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        selectLocation(lat, lng, true)
      },
      () => setLocationWarning(copy.locationUnavailable),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  const autoLocationRequested = useRef(false)
  useEffect(() => {
    if (autoLocationRequested.current || !navigator.geolocation) return
    autoLocationRequested.current = true
    navigator.geolocation.getCurrentPosition(
      (position) => selectLocation(position.coords.latitude, position.coords.longitude, true),
      () => undefined,
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }, [])

  const submitComplaint = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setReference('')
    setEmailDelivery('')
    setSubmitting(true)

    try {
      const response = await fetch('/api/public/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || copy.connectionFailed)
        return
      }

      if (data.complaint?.reference) {
        setReference(data.complaint.reference)
        setSubmittedTelephone(form.telephone)
        setEmailDelivery(data.emailDelivery || '')
        setTrackingReference(data.complaint.reference)
        setForm(INITIAL_FORM)
        setDetectedCommuneInfo(null)
        setLocationWarning('')
        setLocationConfirmed(false)
        setMapFocus(null)
      }
    } catch {
      setError(copy.connectionFailed)
    } finally {
      setSubmitting(false)
    }
  }

  const whatsappNumber = normalizeWhatsAppNumber(submittedTelephone)
  const whatsappMessage = `${copy.successTitle}. ${copy.keepReference} ${reference}.`
  const whatsappUrl = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`

  const trackComplaint = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTrackingMessage('')
    setTrackingLoading(true)

    try {
      const response = await fetch(`/api/public/complaints?reference=${encodeURIComponent(trackingReference.trim())}`)
      const data = await response.json()
      if (!response.ok) {
        setTrackingMessage(data.error || copy.invalidTracking)
        return
      }

      const complaint = data.complaint
      const statusLabels: Record<string, string> = {
        EN_ATTENTE: copy.statusReceived,
        EN_COURS: copy.statusProcessing,
        TRAITEE: copy.statusDone,
        REJETEE: copy.statusRejected,
      }
      setTrackingMessage(`${statusLabels[complaint.status] || complaint.status} — ${new Date(complaint.receivedAt).toLocaleDateString(language === 'ar' ? 'ar-MA' : language === 'fr' ? 'fr-FR' : language === 'es' ? 'es-ES' : 'en-GB')}`)
    } catch {
      setTrackingMessage(copy.connectionFailed)
    } finally {
      setTrackingLoading(false)
    }
  }

  const selectedTypeOption = typeOptions.find((item) => item.value === form.type)

  return (
    <main className="public-report-page min-h-screen bg-[#f4f8f7] text-slate-800" data-language={language} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Hero */}
      <section className="public-report-hero relative overflow-hidden bg-gradient-to-l from-[#063b37] via-[#08645a] to-[#0d8a75] px-4 pb-12 pt-5 text-white sm:pb-16">
        <div className="pointer-events-none absolute -left-20 -top-28 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 right-1/3 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative mx-auto max-w-5xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 pb-4">
            <a href="/" className="text-xs font-bold text-emerald-100 transition hover:text-white sm:text-sm">{copy.back}</a>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <div className="flex items-center gap-1 rounded-xl border border-white/20 bg-white/10 p-1" aria-label="Language selector">
                {(['ar', 'fr', 'en', 'es'] as PublicLanguage[]).map((option) => (
                  <button key={option} type="button" onClick={() => setLanguage(option)}
                    className={`rounded-lg px-2 py-1.5 text-[10px] font-black transition sm:px-2.5 ${language === option ? 'bg-white text-emerald-800 shadow-sm' : 'text-white/75 hover:bg-white/15 hover:text-white'}`}>
                    {option === 'ar' ? 'العربية' : option === 'fr' ? 'Français' : option === 'en' ? 'English' : 'Español'}
                  </button>
                ))}
              </div>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-emerald-50">{copy.badge}</span>
              {onEmployeeLogin && <button type="button" onClick={onEmployeeLogin} className="rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-white/25 sm:text-sm">{copy.employeeLogin}</button>}
            </div>
          </div>
          <div className="max-w-3xl pt-10 sm:pt-14">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-3 py-2.5 shadow-lg shadow-emerald-950/10 backdrop-blur-sm">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">🛡️</span>
              <div className="text-right">
                <p className="text-[10px] font-bold tracking-wide text-emerald-200">{copy.platformLabel}</p>
                <p className="mt-0.5 text-sm font-black leading-5 text-white sm:text-base">{copy.platformName}</p>
              </div>
            </div>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">{copy.heroTitle}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50/90 sm:text-base">
            {copy.heroDescription}
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-bold text-emerald-50/90 sm:gap-3 sm:text-xs">
              <span className="rounded-full bg-white/10 px-3 py-2">{copy.gpsTag}</span>
              <span className="rounded-full bg-white/10 px-3 py-2">{copy.communeTag}</span>
              <span className="rounded-full bg-white/10 px-3 py-2">{copy.referenceTag}</span>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto -mt-6 max-w-5xl space-y-6 px-4 pb-10 sm:-mt-8 sm:pb-16">
        <div className="relative z-10 grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-emerald-950/5">
          {[
            { number: '01', label: copy.stepType, active: true },
            { number: '02', label: copy.stepDetails, active: false },
            { number: '03', label: copy.stepTrack, active: false },
          ].map((step) => (
            <div key={step.number} className={`flex items-center gap-2 rounded-xl px-2 py-3 sm:gap-3 sm:px-4 ${step.active ? 'bg-emerald-50 text-emerald-800' : 'text-slate-400'}`}>
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${step.active ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-400'}`}>{step.number}</span>
              <span className="text-[10px] font-extrabold leading-4 sm:text-xs">{step.label}</span>
            </div>
          ))}
        </div>

        <section id="complaint-map" className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
          <div className="bg-gradient-to-l from-[#073b36] via-[#075e54] to-[#0a806c] px-5 py-6 text-white sm:px-8">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl shadow-inner">🗺️</span>
              <div>
                <p className="text-[11px] font-bold text-emerald-200">{reference ? copy.badge : copy.stepOne}</p>
                <h2 className="mt-0.5 text-xl font-black">{copy.mapTitle}</h2>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-emerald-50/90">{copy.mapDescription}</p>
          </div>

          <div className="space-y-6 p-4 sm:p-7">
            <div>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <label className="block text-base font-black text-slate-900">{copy.typeQuestion}</label>
                  <p className="mt-1 text-xs text-slate-500">{copy.typeHint}</p>
                </div>
                <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500 sm:inline-flex">{copy.oneChoice}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                {typeOptions.map((item) => (
                  <button key={item.value} type="button" onClick={() => updateField('type', item.value)}
                    className={`relative flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-3 text-center transition-all hover:-translate-y-0.5 ${form.type === item.value ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-md shadow-emerald-100' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:shadow-sm'}`}>
                    {form.type === item.value && <span className="absolute right-2 top-2 text-[10px] font-black text-emerald-600">✓</span>}
                    <span className="text-2xl">{item.icon}</span>
                    <span className="text-[11px] font-extrabold leading-4">{item.label}</span>
                  </button>
                ))}
              </div>
              {selectedTypeOption && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-l from-emerald-50 to-teal-50 px-4 py-3 text-emerald-950">
                <span className="text-2xl">{selectedTypeOption.icon}</span>
                <div>
                  <p className="text-sm font-extrabold">{copy.typeOverview} {selectedTypeOption.label}</p>
                  <p className="mt-1 text-xs leading-6 text-emerald-800">{selectedTypeOption.description}</p>
                </div>
              </div>}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${locationConfirmed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{locationConfirmed ? '✓' : '📍'}</span>
                <div>
                  <p className="text-xs font-bold text-slate-500">{copy.locationStatus}</p>
                  <p className="text-sm font-black text-slate-800">{locationConfirmed ? displayLinkedCommune(form.commune, language, copy.locationLinked) : copy.locationWaiting}</p>
                </div>
              </div>
              <button type="button" onClick={captureLocation} className="rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-blue-700">{copy.useGps}</button>
            </div>

            {detectedCommuneInfo && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              <p className="font-extrabold">{copy.detectedCommune} {displayCommuneName(detectedCommuneInfo.commune, language)}</p>
              <p className="mt-1 text-xs text-emerald-700">{detectedCommuneInfo.province ? `${copy.province} ${detectedCommuneInfo.province}` : ''}{detectedCommuneInfo.region ? ` · ${copy.region} ${detectedCommuneInfo.region}` : ''}</p>
            </div>}
            {detectingCommune && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">{copy.locating}</p>}
            {locationWarning && <p className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{locationWarning}</p>}

            <PublicReportMap
              onSelect={(point) => selectLocation(point.lat, point.lng)}
              focusPoint={mapFocus}
              position={Number.isFinite(Number(form.latitude)) && Number.isFinite(Number(form.longitude)) && form.latitude && form.longitude
                ? { lat: Number(form.latitude), lng: Number(form.longitude) }
                : null}
              language={language}
              commune={detectedCommuneInfo?.commune || form.commune}
            />
            <p className="text-center text-xs font-medium text-slate-500">{copy.mapHint}</p>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">{form.latitude && form.longitude ? `${copy.coordinates} ${form.latitude}, ${form.longitude}` : copy.coordinatesWaiting}</p>
              <a href="#complaint-form" className={`rounded-xl px-4 py-2.5 text-sm font-extrabold text-white transition ${locationConfirmed ? 'bg-emerald-700 shadow-sm hover:bg-emerald-800' : 'pointer-events-none bg-slate-300'}`}>{copy.continue}</a>
            </div>
          </div>
        </section>

        {reference ? (
          <section className="rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-6 text-center shadow-lg shadow-emerald-950/5 sm:p-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-600 text-3xl font-black text-white shadow-lg shadow-emerald-200">✓</div>
            <h2 className="mt-4 text-xl font-black text-emerald-950">{copy.successTitle}</h2>
            <p className="mt-2 text-sm text-emerald-800">{copy.keepReference}</p>
            <p className="mx-auto mt-4 max-w-md break-all rounded-2xl border border-emerald-100 bg-white px-4 py-4 font-mono text-base font-black tracking-wide text-emerald-800 shadow-sm">{reference}</p>
            {emailDelivery === 'SENT' && <p className="mt-3 text-sm font-semibold text-emerald-800">{copy.emailSent}</p>}
            {emailDelivery === 'NOT_CONFIGURED' && <p className="mt-3 text-sm text-amber-800">{copy.emailNotConfigured}</p>}
            {emailDelivery === 'FAILED' && <p className="mt-3 text-sm text-amber-800">{copy.emailFailed}</p>}
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#25D366] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#1ebe5d]">
              {copy.whatsapp}
            </a>
            <button onClick={() => setReference('')} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">{copy.newReport}</button>
          </section>
        ) : (
          <section id="complaint-form" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5 sm:p-8">
            <form onSubmit={submitComplaint} className="space-y-5">
              <div className="flex items-start gap-3 border-b border-slate-100 pb-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-xl text-emerald-700">📝</span>
                <div>
                  <p className="text-[11px] font-black text-emerald-700">02</p>
                  <h2 className="mt-0.5 text-xl font-black text-slate-900">{copy.formTitle}</h2>
                  <p className="mt-1 text-sm text-slate-500">{copy.formSubtitle}</p>
                </div>
              </div>

              {/* Nom + Téléphone */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold text-slate-700">{copy.fullName}
                  <input required value={form.nomCitoyen} onChange={(e) => updateField('nomCitoyen', e.target.value)} maxLength={120}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
                </label>
                <label className="text-sm font-bold text-slate-700">{copy.phone}
                  <input value={form.telephone} onChange={(e) => updateField('telephone', e.target.value)} maxLength={30} type="tel" dir="ltr"
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 text-right outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
                </label>
              </div>

              {/* Email */}
              <label className="block text-sm font-bold text-slate-700">{copy.email}
                <input required value={form.email} onChange={(e) => updateField('email', e.target.value)} maxLength={254} type="email" dir="ltr" placeholder="name@example.com"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 text-right outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
              </label>

              <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-l from-emerald-50 to-teal-50 px-4 py-3">
                <div>
                  <p className="text-xs font-bold text-emerald-700">{copy.selectedType}</p>
                  <p className="mt-1 text-sm font-extrabold text-emerald-950">{selectedTypeOption?.icon} {selectedTypeOption?.label}</p>
                </div>
                <a href="#complaint-map" className="rounded-xl border border-emerald-600 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-white">{copy.changeType}</a>
              </div>

              {/* Priorité */}
              <div>
                <label className="text-sm font-semibold block mb-2">{copy.priority}</label>
                <div className="grid grid-cols-4 gap-2">
                  {priorityOptions.map((p) => (
                    <button key={p.value} type="button" onClick={() => updateField('priorite', p.value)}
                      className={`rounded-xl border-2 py-2.5 text-xs font-bold transition-all ${form.priorite === p.value ? 'text-white border-transparent shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                      style={form.priorite === p.value ? { backgroundColor: p.color } : undefined}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Commune + Quartier */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold text-slate-700">
                  {copy.commune}
                  {detectingCommune && <span className="text-[10px] text-emerald-600 mr-1 animate-pulse">{copy.locating}</span>}
                  {detectedCommuneInfo && !detectingCommune && (
                    <span className="text-[10px] text-emerald-600 mr-1">{copy.autoDetected}{detectedCommuneInfo.province ? ` · ${detectedCommuneInfo.province}` : ''}</span>
                  )}
                  <select required value={form.commune} onChange={(e) => { updateField('commune', e.target.value); setDetectedCommuneInfo(null) }}
                    className={`mt-1.5 w-full rounded-xl border px-3 py-3 outline-none focus:border-emerald-600 ${detectedCommuneInfo ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/60'}`}>
                    <option value="">{copy.chooseCommune}</option>
                    {COMMUNES.map((c) => <option key={c} value={c}>{displayCommuneName(c, language)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-bold text-slate-700">{copy.neighborhood}
                  <input value={form.quartier} onChange={(e) => updateField('quartier', e.target.value)} maxLength={120}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
                </label>
              </div>

              {/* Description */}
              <label className="block text-sm font-bold text-slate-700">{copy.description}
                <textarea required value={form.description} onChange={(e) => updateField('description', e.target.value)} maxLength={2000} rows={4}
                  placeholder={copy.descriptionPlaceholder}
                  className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
              </label>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold text-emerald-900">{copy.reportLocation}</p>
                    <p className="mt-1 text-xs text-emerald-700">{locationConfirmed ? displayLinkedCommune(form.commune, language, copy.locationLinked) : copy.locationWaiting}</p>
                  </div>
                  <a href="#complaint-map" className="rounded-xl border border-emerald-600 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-white">{copy.editLocation}</a>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input type="number" step="any" value={form.latitude} onChange={(e) => { updateField('latitude', e.target.value); setDetectedCommuneInfo(null); setLocationConfirmed(false) }} placeholder={copy.latitude} dir="ltr"
                    className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-right outline-none focus:border-emerald-600" />
                  <input type="number" step="any" value={form.longitude} onChange={(e) => { updateField('longitude', e.target.value); setDetectedCommuneInfo(null); setLocationConfirmed(false) }} placeholder={copy.longitude} dir="ltr"
                    className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs text-right outline-none focus:border-emerald-600" />
                </div>
              </div>

              {/* Honeypot */}
              <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => updateField('website', e.target.value)} className="absolute h-px w-px opacity-0" aria-hidden="true" />

              {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

              <button disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-l from-emerald-700 to-teal-700 px-4 py-3.5 font-black text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-800 hover:to-teal-800 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? copy.sending : copy.send}
              </button>

              <p className="text-center text-xs text-slate-400">
                {copy.protected}
              </p>
            </form>
          </section>
        )}

        {/* Suivi */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-xl text-blue-700">🔍</span>
            <div>
              <p className="text-[11px] font-black text-blue-700">03</p>
              <h2 className="mt-0.5 text-lg font-black text-slate-900">{copy.trackingTitle}</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">{copy.trackingSubtitle}</p>
            </div>
          </div>
          <form onSubmit={trackComplaint} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input value={trackingReference} onChange={(e) => setTrackingReference(e.target.value.toUpperCase())} placeholder={copy.trackingPlaceholder}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 font-mono text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-100" />
            <button disabled={trackingLoading || !trackingReference.trim()}
              className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap">
              {trackingLoading ? copy.tracking : copy.track}
            </button>
          </form>
          {trackingMessage && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{trackingMessage}</p>}
        </section>
      </div>
    </main>
  )
}
