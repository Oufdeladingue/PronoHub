'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import 'react-quill/dist/quill.snow.css'

// Import dynamique pour éviter les erreurs SSR
const ReactQuill = dynamic(() => import('react-quill'), { ssr: false })

interface EmailEditorProps {
  value: string
  onChange: (value: string) => void
}

const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'align': [] }],
    ['link', 'image'],
    ['clean']
  ]
}

const formats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'list', 'bullet',
  'align',
  'link', 'image'
]

export default function EmailEditor({ value, onChange }: EmailEditorProps) {
  const [showHtml, setShowHtml] = useState(false)
  const [htmlCode, setHtmlCode] = useState(value)

  const handleHtmlChange = (newHtml: string) => {
    setHtmlCode(newHtml)
    onChange(newHtml)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          Corps de l'email
        </label>
        <button
          type="button"
          onClick={() => {
            setShowHtml(!showHtml)
            if (!showHtml) {
              setHtmlCode(value)
            }
          }}
          className="text-xs text-purple-600 hover:text-purple-700 font-medium"
        >
          {showHtml ? '📝 Mode visuel' : '</> Code HTML'}
        </button>
      </div>

      {showHtml ? (
        <textarea
          value={htmlCode}
          onChange={(e) => handleHtmlChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm text-gray-900 bg-white"
          rows={15}
          placeholder="<html>...</html>"
        />
      ) : (
        <div className="bg-white rounded-lg border border-gray-300">
          <ReactQuill
            theme="snow"
            value={value}
            onChange={onChange}
            modules={modules}
            formats={formats}
            placeholder="Rédigez votre email ici..."
            className="h-64"
          />
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">
        Variables disponibles: <code className="bg-gray-100 px-1 py-0.5 rounded">[username]</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">[email]</code>
      </p>
    </div>
  )
}
