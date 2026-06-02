'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 بايت'
  const k = 1024
  const sizes = ['بايت', 'كيلوبايت', 'ميغابايت', 'غيغابايت']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

interface DocumentRecord {
  id: string
  titre: string
  description: string
  categorie: string
  commune: string
  nomFichier: string
  cheminFichier: string
  typeFichier: string
  tailleFichier: number
  reference: string
  dateDocument: string | null
  uploadedBy: string
  createdAt: string
  updatedAt: string
}

export default function PdfViewer({ document: doc, onClose }: { document: DocumentRecord; onClose: () => void }) {
  const [iframeScale, setIframeScale] = useState(100)
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfUrl = `/api/documents/download/${doc.id}`

  const zoomIn = () => setIframeScale(Math.min(200, iframeScale + 25))
  const zoomOut = () => setIframeScale(Math.max(50, iframeScale - 25))
  const fitWidth = () => setIframeScale(100)
  const resetZoom = () => setIframeScale(100)

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === '+' || e.key === '=') zoomIn()
      if (e.key === '-') zoomOut()
      if (e.key === '0') resetZoom()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[70] flex flex-col"
      dir="rtl"
    >
      {/* PDF Toolbar */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-500/20 rounded-lg flex items-center justify-center">
            <span className="text-lg">📕</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate max-w-[300px]">{doc.titre}</h3>
            <p className="text-[11px] text-slate-400">{doc.nomFichier} — {formatFileSize(doc.tailleFichier)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-slate-700 rounded-lg px-2 py-1">
            <button onClick={zoomOut} disabled={iframeScale <= 50}
              className="p-1 hover:bg-slate-600 rounded transition-colors disabled:opacity-30" title="تصغير">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
            <button onClick={resetZoom} className="text-xs text-white font-mono min-w-[45px] text-center hover:text-emerald-300 transition-colors">
              {iframeScale}%
            </button>
            <button onClick={zoomIn} disabled={iframeScale >= 200}
              className="p-1 hover:bg-slate-600 rounded transition-colors disabled:opacity-30" title="تكبير">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </button>
            <button onClick={fitWidth} title="عرض كامل العرض"
              className="p-1 hover:bg-slate-600 rounded transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 12a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          {/* Fullscreen */}
          <button onClick={() => {
            if (containerRef.current) {
              if (document.fullscreenElement) document.exitFullscreen()
              else containerRef.current.requestFullscreen()
            }
          }} title="ملء الشاشة"
            className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13.707 1.707a1 1 0 01-1.414-1.414L17.586 13H16a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0v-1.586l-2.293 2.293z" clipRule="evenodd" />
            </svg>
          </button>
          {/* Open in new tab */}
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
            className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors" title="فتح في تبويب جديد">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
              <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
            </svg>
          </a>
          {/* Download */}
          <a href={pdfUrl} download
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 text-white">
            ⬇️ تحميل
          </a>
          {/* Close */}
          <button onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Document Info Bar */}
      <div className="bg-slate-800/50 border-b border-slate-700/50 px-4 py-1.5 flex items-center gap-4 shrink-0 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">{doc.categorie}</span>
        </span>
        {doc.commune && (
          <span>الجماعة: <strong className="text-slate-300">{doc.commune}</strong></span>
        )}
        {doc.reference && (
          <span>المرجع: <strong className="text-slate-300" dir="ltr">{doc.reference}</strong></span>
        )}
        {doc.uploadedBy && (
          <span>بواسطة: <strong className="text-slate-300">{doc.uploadedBy}</strong></span>
        )}
      </div>

      {/* PDF Content */}
      <div ref={containerRef} className="flex-1 overflow-auto bg-slate-800" dir="ltr">
        <div className="flex justify-center p-4 min-h-full" style={{ transform: `scale(${iframeScale / 100})`, transformOrigin: 'top center' }}>
          <iframe
            src={pdfUrl}
            className="w-full max-w-[900px] border-0 shadow-2xl rounded-lg"
            style={{ height: 'calc(100vh - 130px)', minHeight: '600px' }}
            title={doc.titre}
          />
        </div>
      </div>
    </motion.div>
  )
}
