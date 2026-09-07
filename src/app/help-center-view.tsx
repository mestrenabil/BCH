'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, type ViewType } from '@/lib/store'
import { t } from '@/lib/i18n'

// ===== CONTENT DATA (bilingual) =====
interface Guide {
  id: string
  icon: string
  title: { ar: string; fr: string }
  desc: { ar: string; fr: string }
  view: ViewType
  color: string
}

const GUIDES: Guide[] = [
  { id: 'dashboard', icon: '📊', view: 'dashboard', color: '#10b981', title: { ar: 'لوحة القيادة', fr: 'Tableau de bord' }, desc: { ar: 'نظرة شاملة على المؤشرات، الإحصائيات، وحالة العمليات اليومية', fr: 'Vue d’ensemble des indicateurs et statistiques quotidiens' } },
  { id: 'map', icon: '🗺️', view: 'map', color: '#3b82f6', title: { ar: 'الخريطة', fr: 'Carte SIG' }, desc: { ar: 'خريطة تفاعلية تعرض التدخلات جغرافياً مع إمكانية الإنشاء بالنقر', fr: 'Carte interactive des interventions géolocalisées' } },
  { id: 'interventions', icon: '📋', view: 'interventions', color: '#f59e0b', title: { ar: 'التدخلات', fr: 'Interventions' }, desc: { ar: 'إنشاء وتدبير عمليات 3D (القوارض، الحشرات، التطهير)', fr: 'Créer et gérer les opérations 3D' } },
  { id: 'campagnes', icon: '🎪', view: 'campagnes', color: '#8b5cf6', title: { ar: 'الحملات', fr: 'Campagnes' }, desc: { ar: 'تنظيم التدخلات في حملات موسمية مع متابعة الميزانية والإنجاز', fr: 'Organiser les interventions en campagnes saisonnières' } },
  { id: 'agents', icon: '👥', view: 'agents', color: '#06b6d4', title: { ar: 'الفرق والأعوان', fr: 'Équipes & Agents' }, desc: { ar: 'تدبير الأعوان الميدانيين وفرق العمل', fr: 'Gérer les agents de terrain' } },
  { id: 'inventory', icon: '📦', view: 'inventory', color: '#84cc16', title: { ar: 'المخزون', fr: 'Inventaire' }, desc: { ar: 'تتبع المنتجات، الكميات، تواريخ الانتهاء، وحركات المخزون', fr: 'Suivi des produits et mouvements de stock' } },
  { id: 'documents', icon: '📄', view: 'documents', color: '#ec4899', title: { ar: 'المستندات', fr: 'Documents' }, desc: { ar: 'رفع وتصنيف المستندات الرسمية وربطها بالتدخلات', fr: 'Gestion des documents officiels' } },
  { id: 'reports', icon: '📈', view: 'reports', color: '#ef4444', title: { ar: 'التقارير', fr: 'Rapports' }, desc: { ar: 'رسوم بيانية وإحصائيات تفصيلية للأداء', fr: 'Graphiques et statistiques détaillées' } },
  { id: 'calendar', icon: '📅', view: 'calendar', color: '#7c3aed', title: { ar: 'التقويم', fr: 'Calendrier' }, desc: { ar: 'عرض التدخلات المبرمجة في تقويم شهري/أسبوعي', fr: 'Vue calendrier des interventions' } },
  { id: 'complaints', icon: '📢', view: 'complaints', color: '#d97706', title: { ar: 'الشكايات', fr: 'Réclamations' }, desc: { ar: 'تتبع شكايات المواطنين وربطها بالتدخلات', fr: 'Suivi des réclamations citoyennes' } },
  { id: 'export', icon: '📤', view: 'export', color: '#0891b2', title: { ar: 'التصدير', fr: 'Exportation' }, desc: { ar: 'تصدير التقارير بصيغة CSV و PDF', fr: 'Export CSV et PDF' } },
  { id: 'settings', icon: '⚙️', view: 'settings', color: '#64748b', title: { ar: 'الإعدادات', fr: 'Paramètres' }, desc: { ar: 'تهيئة المنصة، الطباعة، الإشعارات، والمظهر', fr: 'Configuration de la plateforme' } },
]

interface FaqItem {
  q: { ar: string; fr: string }
  a: { ar: string; fr: string }
}

const FAQ: FaqItem[] = [
  {
    q: { ar: 'كيف أضيف تدخلاً جديداً؟', fr: 'Comment ajouter une intervention ?' },
    a: { ar: 'اضغط على زر "إضافة تدخل" (+) في الشريط الجانبي أو استخدم اختصار Alt+N. املأ الحقول المطلوبة (النوع، التاريخ، الحي، العون) ثم احفظ.', fr: 'Cliquez sur « Ajouter intervention » ou utilisez Alt+N. Remplissez les champs requis puis enregistrez.' },
  },
  {
    q: { ar: 'ما هي حملات 3D؟', fr: 'Que sont les campagnes 3D ?' },
    a: { ar: 'الحملات تتيح تجميع عدة تدخلات تحت هدف موسمي مشترك (مثلاً: حملة الربيع)، مع متابعة الميزانية ونسبة الإنجاز في مكان واحد.', fr: 'Les campagnes regroupent plusieurs interventions sous un objectif saisonnier, avec suivi du budget.' },
  },
  {
    q: { ar: 'كيف أبحث بسرعة عن عنصر؟', fr: 'Comment rechercher rapidement ?' },
    a: { ar: 'اضغط Ctrl+K (أو Cmd+K على ماك) لفتح البحث الشامل. يبحث في التدخلات، المنتجات، الأعوان، المستندات، والشكايات في آن واحد.', fr: 'Ctrl+K (ou Cmd+K) ouvre la recherche globale dans tous les modules.' },
  },
  {
    q: { ar: 'هل بياناتي محمية حسب الجماعة؟', fr: 'Mes données sont-elles isolées par commune ?' },
    a: { ar: 'نعم. كل مسؤول جماعة يرى فقط بيانات جماعته. المسؤول العام (admin) يرى كل الجماعات.', fr: 'Oui. Chaque responsable ne voit que sa commune. L’admin voit tout.' },
  },
  {
    q: { ar: 'كيف أبدّل لغة الواجهة أو الثيم؟', fr: 'Comment changer la langue ou le thème ?' },
    a: { ar: 'استخدم زر 🌐 في الهيدار للتبديل بين العربية والفرنسية، وزر 🌙/☀️ للوضع الليلي/النهاري. كما يمكن من خلال البحث الشامل (Ctrl+K).', fr: 'Bouton 🌐 (langue) et 🌙/☀️ (thème) dans l’en-tête, ou via Ctrl+K.' },
  },
  {
    q: { ar: 'هل يمكنني تصدير نسخة احتياطية؟', fr: 'Puis-je exporter une sauvegarde ?' },
    a: { ar: 'نعم، زر 💾 في الهيدار يحمّل نسخة JSON كاملة من قاعدة البيانات.', fr: 'Oui, le bouton 💾 télécharge une sauvegarde JSON complète.' },
  },
]

const SHORTCUTS = [
  { keys: 'Ctrl + K', ar: 'فتح البحث الشامل', fr: 'Recherche globale' },
  { keys: 'Alt + N', ar: 'إضافة تدخل جديد', fr: 'Nouvelle intervention' },
  { keys: 'Alt + 1..9', ar: 'الانتقال السريع بين الوحدات', fr: 'Navigation rapide entre modules' },
  { keys: 'Alt + S', ar: 'تركيز حقل البحث', fr: 'Focus le champ de recherche' },
  { keys: 'Esc', ar: 'إغلاق النوافذ المنبثقة', fr: 'Fermer les dialogues' },
]

const TIPS = [
  { icon: '⭐', ar: 'استخدم المفضلة لحفظ التدخلات المهمة للوصول السريع.', fr: 'Utilisez les favoris pour un accès rapide aux interventions clés.' },
  { icon: '🔔', ar: 'فعّل أصوات الإشعارات من الإعدادات لتلقي تنبيهات فورية.', fr: 'Activez les sons de notification dans les paramètres.' },
  { icon: '📊', ar: 'استخدم مقارنة التدخلات لتحليل الأداء بين الفترات.', fr: 'Comparez les interventions pour analyser les performances.' },
  { icon: '📅', ar: 'رايع التقويم أسبوعياً للتأكد من جدولة التدخلات المبرمجة.', fr: 'Consultez le calendrier chaque semaine.' },
  { icon: '💾', ar: 'خذ نسخة احتياطية بانتظام قبل التعديلات الكبيرة.', fr: 'Sauvegardez régulièrement avant les gros changements.' },
]

// ===== COMPONENT =====
export default function HelpCenterView() {
  const { language, setCurrentView } = useAppStore()
  const [search, setSearch] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [activeTab, setActiveTab] = useState<'guides' | 'faq' | 'shortcuts' | 'tips'>('guides')

  const filteredGuides = useMemo(() => {
    if (!search.trim()) return GUIDES
    const q = search.toLowerCase()
    return GUIDES.filter((g) =>
      g.title.ar.toLowerCase().includes(q) ||
      g.title.fr.toLowerCase().includes(q) ||
      g.desc.ar.toLowerCase().includes(q) ||
      g.desc.fr.toLowerCase().includes(q)
    )
  }, [search])

  const filteredFaq = useMemo(() => {
    if (!search.trim()) return FAQ
    const q = search.toLowerCase()
    return FAQ.filter((f) =>
      f.q.ar.toLowerCase().includes(q) || f.q.fr.toLowerCase().includes(q) ||
      f.a.ar.toLowerCase().includes(q) || f.a.fr.toLowerCase().includes(q)
    )
  }, [search])

  const tabBtn = (tab: typeof activeTab, label: string, icon: string) => `
    px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
    ${activeTab === tab
      ? 'bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-md'
      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}
  `

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-[1200px] mx-auto" role="region" aria-label={t('helpTitle', language)}>
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-l from-emerald-600 via-teal-600 to-emerald-700 text-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">❓ {t('helpTitle', language)}</h1>
            <p className="text-sm text-emerald-50 mt-1">{t('helpSubtitle', language)}</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2 text-center">
            <div className="text-[11px] text-emerald-100">{t('helpVersion', language)}</div>
            <div className="text-lg font-bold">2.0.0</div>
          </div>
        </div>
        {/* Search */}
        <div className="mt-4 relative">
          <span className="absolute top-1/2 -translate-y-1/2 start-3 text-emerald-100" aria-hidden>🔍</span>
          <input
            type="search"
            className="w-full ps-10 pe-3 py-2.5 rounded-xl bg-white/15 backdrop-blur-sm text-white placeholder:text-emerald-100 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 focus:bg-white/25 transition-all"
            placeholder={t('helpSearchPlaceholder', language)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('helpSearchPlaceholder', language)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap" role="tablist">
        <button className={tabBtn('guides', t('helpGuides', language), '📘')} onClick={() => setActiveTab('guides')} role="tab" aria-selected={activeTab === 'guides'}>
          📘 {t('helpGuides', language)}
        </button>
        <button className={tabBtn('faq', t('helpFaq', language), '💬')} onClick={() => setActiveTab('faq')} role="tab" aria-selected={activeTab === 'faq'}>
          💬 {t('helpFaq', language)}
        </button>
        <button className={tabBtn('shortcuts', t('helpShortcuts', language), '⌨️')} onClick={() => setActiveTab('shortcuts')} role="tab" aria-selected={activeTab === 'shortcuts'}>
          ⌨️ {t('helpShortcuts', language)}
        </button>
        <button className={tabBtn('tips', t('helpTips', language), '💡')} onClick={() => setActiveTab('tips')} role="tab" aria-selected={activeTab === 'tips'}>
          💡 {t('helpTips', language)}
        </button>
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {/* GUIDES */}
          {activeTab === 'guides' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="tabpanel">
              {filteredGuides.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setCurrentView(g.view)}
                  className="text-start rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: `${g.color}20` }}>
                      {g.icon}
                    </div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100">{g.title[language]}</h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{g.desc[language]}</p>
                  <div className="mt-3 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    {t('viewAll', language)} ←
                  </div>
                </button>
              ))}
              {filteredGuides.length === 0 && (
                <p className="col-span-full text-center text-sm text-slate-400 py-10">{t('searchNoResults', language)}</p>
              )}
            </div>
          )}

          {/* FAQ */}
          {activeTab === 'faq' && (
            <div className="space-y-2" role="tabpanel">
              {filteredFaq.map((item, i) => (
                <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-start hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
                    aria-expanded={openFaq === i}
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-100 text-sm">{item.q[language]}</span>
                    <span className={`text-slate-400 transition-transform shrink-0 ${openFaq === i ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pb-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-700 pt-3">
                          {item.a[language]}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}

          {/* SHORTCUTS */}
          {activeTab === 'shortcuts' && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden" role="tabpanel">
              <table className="w-full text-sm">
                <tbody>
                  {SHORTCUTS.map((s, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/40">
                      <td className="px-4 py-3">
                        <kbd className="font-mono text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-600">{s.keys}</kbd>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{s[language]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TIPS */}
          {activeTab === 'tips' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="tabpanel">
              {TIPS.map((tip, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-4">
                  <span className="text-2xl shrink-0">{tip.icon}</span>
                  <p className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">{tip[language]}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer / support */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 text-center">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('helpContactSupport', language)}: <span className="font-mono text-emerald-600 dark:text-emerald-400">support@3d-salé.ma</span>
        </p>
        <p className="text-xs text-slate-400 mt-1">{t('footerText', language)}</p>
      </div>
    </div>
  )
}
