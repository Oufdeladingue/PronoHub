'use client'

import { useState } from 'react'

interface EmailEditorProps {
  value: string
  onChange: (value: string) => void
}

export default function EmailEditor({ value, onChange }: EmailEditorProps) {
  const [showPreview, setShowPreview] = useState(false)

  const insertHtml = (html: string) => {
    const textarea = document.querySelector('textarea[name="email-html"]') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = value.substring(0, start) + html + value.substring(end)
      onChange(newValue)

      // Repositionner le curseur après l'insertion
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + html.length, start + html.length)
      }, 0)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          Corps de l'email (HTML)
        </label>
        <div className="flex items-center gap-2">
          {/* Boutons d'aide HTML */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => insertHtml('<strong></strong>')}
              className="px-2 py-1 text-xs font-bold hover:bg-gray-200 rounded"
              title="Gras"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => insertHtml('<em></em>')}
              className="px-2 py-1 text-xs italic hover:bg-gray-200 rounded"
              title="Italique"
            >
              I
            </button>
            <button
              type="button"
              onClick={() => insertHtml('<a href=""></a>')}
              className="px-2 py-1 text-xs hover:bg-gray-200 rounded"
              title="Lien"
            >
              🔗
            </button>
            <button
              type="button"
              onClick={() => insertHtml('<p></p>')}
              className="px-2 py-1 text-xs hover:bg-gray-200 rounded"
              title="Paragraphe"
            >
              ¶
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="text-xs text-purple-600 hover:text-purple-700 font-medium"
          >
            {showPreview ? '📝 Édition' : '👁️ Aperçu'}
          </button>
        </div>
      </div>

      {showPreview ? (
        <div className="w-full px-4 py-4 border border-gray-300 rounded-lg bg-white min-h-64 prose prose-sm max-w-none">
          <div dangerouslySetInnerHTML={{ __html: value }} />
        </div>
      ) : (
        <textarea
          name="email-html"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm text-gray-900 bg-white"
          rows={15}
          placeholder="<html>...</html>"
        />
      )}

      <p className="text-xs text-gray-500 mt-2">
        Variables disponibles: <code className="bg-gray-100 px-1 py-0.5 rounded">[username]</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">[email]</code>
      </p>
    </div>
  )
}
