'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import { EMAIL_COLORS } from '@/lib/admin/email-templates'
import MatchPickerModal from '@/components/admin/MatchPickerModal'

interface EmailEditorProps {
  value: string
  onChange: (value: string) => void
}

const VARIABLES = [
  { label: '[username]', value: '[username]', description: 'Pseudo' },
  { label: '[email]', value: '[email]', description: 'Email' },
]

const EMOJI_CATEGORIES = [
  {
    label: 'Courants',
    emojis: ['😀', '😂', '😍', '🥳', '😎', '🤩', '😏', '🤔', '😢', '😡', '🙏', '👋'],
  },
  {
    label: 'Sport',
    emojis: ['⚽', '🏆', '🥇', '🥈', '🥉', '🏅', '🎯', '🔥', '💪', '👏', '⭐', '🌟'],
  },
  {
    label: 'Objets',
    emojis: ['📣', '📢', '🔔', '💡', '🎉', '🎊', '✅', '❌', '⚠️', '💬', '📧', '🚀'],
  },
  {
    label: 'Fleches',
    emojis: ['➡️', '⬅️', '⬆️', '⬇️', '👉', '👈', '👆', '👇', '↗️', '↘️', '🔄', '🔁'],
  },
]

export default function EmailEditor({ value, onChange }: EmailEditorProps) {
  const [showSource, setShowSource] = useState(false)
  const [sourceValue, setSourceValue] = useState(value)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showVariables, setShowVariables] = useState(false)
  const [showEmojis, setShowEmojis] = useState(false)
  const [showMatchPicker, setShowMatchPicker] = useState(false)
  const customColorRef = useRef<HTMLInputElement>(null)

  const closeAllDropdowns = useCallback(() => {
    setShowColorPicker(false)
    setShowVariables(false)
    setShowEmojis(false)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          style: 'color: #ff9900; text-decoration: underline;',
        },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          style: 'max-width: 100%; height: auto; border-radius: 8px;',
        },
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3 text-gray-900',
      },
    },
  })

  // Sync external value changes into editor (e.g. template change)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '')
    }
  }, [value, editor])

  // Sync source view
  useEffect(() => {
    if (showSource) {
      setSourceValue(value)
    }
  }, [showSource, value])

  const toggleSource = useCallback(() => {
    if (showSource) {
      // Switching from source to WYSIWYG: apply source changes
      onChange(sourceValue)
      if (editor) {
        editor.commands.setContent(sourceValue)
      }
    }
    setShowSource(!showSource)
  }, [showSource, sourceValue, onChange, editor])

  const handleSourceChange = useCallback((newSource: string) => {
    setSourceValue(newSource)
    onChange(newSource)
  }, [onChange])

  const setLink = useCallback(() => {
    if (!editor) return
    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('URL du lien:', previousUrl || 'https://')
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  const insertImage = useCallback(() => {
    if (!editor) return
    const url = window.prompt('URL de l\'image:', 'https://')
    if (!url) return
    editor.chain().focus().setImage({ src: url }).run()
  }, [editor])

  const insertVariable = useCallback((variable: string) => {
    if (!editor) return
    editor.chain().focus().insertContent(variable).run()
    setShowVariables(false)
  }, [editor])

  const insertMatches = useCallback((matchIds: string[]) => {
    if (!editor || matchIds.length === 0) return
    const content = matchIds.map(id => `[match_ID=${id}]`).join('<br/>')
    editor.chain().focus().insertContent(content).run()
    setShowMatchPicker(false)
  }, [editor])

  const insertEmoji = useCallback((emoji: string) => {
    if (!editor) return
    editor.chain().focus().insertContent(emoji).run()
  }, [editor])

  const indent = useCallback(() => {
    if (!editor) return
    // Wrap selection or current block in a div with padding-left
    const { from, to } = editor.state.selection
    const node = editor.state.doc.nodeAt(from)
    // Insert content wrapped with margin
    editor.chain().focus().command(({ tr, state }) => {
      const { $from } = state.selection
      const parent = $from.parent
      // Get current indent level from existing style
      const currentAttrs = parent.attrs
      const currentStyle = (currentAttrs as any).style || ''
      const match = currentStyle.match(/margin-left:\s*(\d+)px/)
      const currentIndent = match ? parseInt(match[1]) : 0
      const newIndent = Math.min(currentIndent + 32, 160)
      // We'll use the HTML approach - wrap in a blockquote-like structure
      return false
    }).run()
    // Simpler approach: use the native indent via wrapping in a div
    // For email compatibility, insert non-breaking spaces at the beginning
    const { $from } = editor.state.selection
    const startOfLine = $from.start()
    editor.chain().focus().insertContentAt(startOfLine, '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;').run()
  }, [editor])

  const outdent = useCallback(() => {
    if (!editor) return
    // Remove leading non-breaking spaces from current line
    const { $from } = editor.state.selection
    const parent = $from.parent
    const text = parent.textContent
    if (text.startsWith('\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0')) {
      const startOfLine = $from.start()
      // Delete the 6 nbsp characters
      editor.chain().focus().command(({ tr }) => {
        tr.delete(startOfLine, startOfLine + 6)
        return true
      }).run()
    }
  }, [editor])

  const applyCustomColor = useCallback((color: string) => {
    if (!editor || !color) return
    editor.chain().focus().setColor(color).run()
    setShowColorPicker(false)
  }, [editor])

  if (!editor) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          Corps de l'email
        </label>
        <button
          type="button"
          onClick={toggleSource}
          className="text-xs text-purple-600 hover:text-purple-700 font-medium"
        >
          {showSource ? 'Editeur visuel' : '<> Code source'}
        </button>
      </div>

      {showSource ? (
        <textarea
          value={sourceValue}
          onChange={(e) => handleSourceChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm text-gray-900 bg-white"
          rows={15}
          placeholder="<p>Votre contenu HTML...</p>"
        />
      ) : (
        <div className="border border-gray-300 rounded-lg overflow-hidden bg-white">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
            {/* Formatting */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={`px-2 py-1 text-xs rounded font-bold ${
                editor.isActive('bold') ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200 text-gray-700'
              }`}
              title="Gras"
            >
              B
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={`px-2 py-1 text-xs rounded italic ${
                editor.isActive('italic') ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200 text-gray-700'
              }`}
              title="Italique"
            >
              I
            </button>

            <div className="w-px h-5 bg-gray-300 mx-1" />

            {/* Headings */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`px-2 py-1 text-xs rounded font-semibold ${
                editor.isActive('heading', { level: 2 }) ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200 text-gray-700'
              }`}
              title="Titre H2"
            >
              H2
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`px-2 py-1 text-xs rounded font-semibold ${
                editor.isActive('heading', { level: 3 }) ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200 text-gray-700'
              }`}
              title="Titre H3"
            >
              H3
            </button>

            <div className="w-px h-5 bg-gray-300 mx-1" />

            {/* List & Quote */}
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={`px-2 py-1 text-xs rounded ${
                editor.isActive('bulletList') ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200 text-gray-700'
              }`}
              title="Liste"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`px-2 py-1 text-xs rounded ${
                editor.isActive('blockquote') ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200 text-gray-700'
              }`}
              title="Citation"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
              </svg>
            </button>

            {/* Indent / Outdent */}
            <button
              type="button"
              onClick={indent}
              className="px-2 py-1 text-xs rounded hover:bg-gray-200 text-gray-700"
              title="Retrait (indenter)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5h8M13 9h5M13 13h8M13 17h5M3 5l4 4-4 4" />
              </svg>
            </button>
            <button
              type="button"
              onClick={outdent}
              className="px-2 py-1 text-xs rounded hover:bg-gray-200 text-gray-700"
              title="Supprimer le retrait"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h10M11 9h7M11 13h10M11 17h7M7 5L3 9l4 4" />
              </svg>
            </button>

            <div className="w-px h-5 bg-gray-300 mx-1" />

            {/* Link */}
            <button
              type="button"
              onClick={setLink}
              className={`px-2 py-1 text-xs rounded ${
                editor.isActive('link') ? 'bg-purple-100 text-purple-700' : 'hover:bg-gray-200 text-gray-700'
              }`}
              title="Lien"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </button>

            {/* Image */}
            <button
              type="button"
              onClick={insertImage}
              className="px-2 py-1 text-xs rounded hover:bg-gray-200 text-gray-700"
              title="Inserer une image"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            <div className="w-px h-5 bg-gray-300 mx-1" />

            {/* Emoji picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowEmojis(!showEmojis); setShowColorPicker(false); setShowVariables(false) }}
                className={`px-2 py-1 text-xs rounded ${showEmojis ? 'bg-purple-100' : 'hover:bg-gray-200'} text-gray-700`}
                title="Inserer un emoji"
              >
                <span className="text-base leading-none">😀</span>
              </button>
              {showEmojis && (
                <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-lg shadow-lg border border-gray-200 z-20 w-[280px]">
                  {EMOJI_CATEGORIES.map(({ label, emojis }) => (
                    <div key={label} className="mb-2">
                      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</span>
                      <div className="grid grid-cols-12 gap-0.5 mt-0.5">
                        {emojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-base leading-none"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Color picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowColorPicker(!showColorPicker); setShowVariables(false); setShowEmojis(false) }}
                className="px-2 py-1 text-xs rounded hover:bg-gray-200 text-gray-700 flex items-center gap-1"
                title="Couleur du texte"
              >
                <span className="w-4 h-4 rounded border border-gray-300" style={{
                  backgroundColor: editor.getAttributes('textStyle').color || '#000000'
                }} />
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showColorPicker && (
                <div className="absolute top-full left-0 mt-1 p-2 bg-white rounded-lg shadow-lg border border-gray-200 z-20 min-w-40">
                  <div className="grid grid-cols-5 gap-1.5">
                    {EMAIL_COLORS.map(({ color, label }) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          editor.chain().focus().setColor(color).run()
                          setShowColorPicker(false)
                        }}
                        className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                        style={{ backgroundColor: color }}
                        title={label}
                      />
                    ))}
                  </div>
                  <div className="border-t border-gray-200 mt-2 pt-2 flex items-center gap-2">
                    <input
                      ref={customColorRef}
                      type="color"
                      defaultValue="#ff9900"
                      className="w-6 h-6 rounded border border-gray-300 cursor-pointer p-0"
                      title="Choisir une couleur personnalisee"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customColorRef.current) {
                          applyCustomColor(customColorRef.current.value)
                        }
                      }}
                      className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Appliquer
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      editor.chain().focus().unsetColor().run()
                      setShowColorPicker(false)
                    }}
                    className="w-full text-xs text-gray-500 hover:text-gray-700 mt-1.5 text-center"
                  >
                    Retirer la couleur
                  </button>
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-gray-300 mx-1" />

            {/* Variables */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setShowVariables(!showVariables); setShowColorPicker(false); setShowEmojis(false) }}
                className="px-2 py-1 text-xs rounded hover:bg-gray-200 text-gray-700 font-medium"
                title="Inserer une variable"
              >
                {'{x}'}
              </button>
              {showVariables && (
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 min-w-[180px]">
                  {VARIABLES.map(({ label, value: v, description }) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                    >
                      <code className="text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded text-xs">{label}</code>
                      <span className="text-gray-500 text-xs">{description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-px h-5 bg-gray-300 mx-1" />

            {/* Match picker */}
            <button
              type="button"
              onClick={() => { setShowMatchPicker(true); closeAllDropdowns() }}
              className="px-2 py-1 text-xs rounded hover:bg-gray-200 text-gray-700"
              title="Insérer un match"
            >
              <span className="text-base leading-none">⚽</span>
            </button>
          </div>

          {/* Editor content */}
          <div onClick={closeAllDropdowns}>
            <EditorContent editor={editor} />
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 mt-2">
        Variables disponibles: <code className="bg-gray-100 px-1 py-0.5 rounded">[username]</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">[email]</code>, <code className="bg-gray-100 px-1 py-0.5 rounded">[match_ID=...]</code> (via ⚽)
      </p>

      <MatchPickerModal
        isOpen={showMatchPicker}
        onClose={() => setShowMatchPicker(false)}
        onSelectMatches={insertMatches}
      />
    </div>
  )
}
