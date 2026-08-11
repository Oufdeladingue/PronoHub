import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import Anthropic from '@anthropic-ai/sdk'

// Modèle : défaut Opus 5 (surchargeable par env si besoin de coût/latence).
const MODEL = process.env.COMM_TRANSLATE_MODEL || 'claude-opus-5'

// Champs traduisibles d'une communication (mêmes clés que le composer/JSON translations).
const FIELDS = [
  'email_subject',
  'email_preview_text',
  'email_body_html',
  'email_cta_text',
  'notification_title',
  'notification_body',
] as const
type Field = typeof FIELDS[number]

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish (Spain, castellano)',
  de: 'German (Hochdeutsch, tutoiement "du")',
  it: 'Italian (tutoiement "tu")',
}

// Schéma de sortie structurée : les 6 champs, tous en string.
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(FIELDS.map((f) => [f, { type: 'string' }])),
  required: [...FIELDS],
}

const SYSTEM = `You are a professional translator for PronoHub, a football-prediction app (friendly, playful tone).
Translate the given FRENCH marketing content into the target language. Return ONLY the translated fields, as JSON matching the schema.

Rules:
- "email_body_html" is HTML: preserve ALL tags, attributes, inline styles and structure EXACTLY; translate only the human-visible text between tags.
- Preserve these placeholders verbatim wherever they appear, in any field: [username], [email], [HEADER_TITLE], [CTA_TEXT], [CTA_URL], and any {{...}} shortcodes. Never translate or alter them.
- Do NOT translate: brand/product names (PronoHub, WhatsApp, Facebook, Stripe, Free-Kick, One-Shot, Elite Team, Platinium, Premium), URLs, or prices (keep the French format, e.g. "4,99€").
- Natural, idiomatic, warm football wording. Use informal address (tu/du/tú) where the language supports it.
- If a source field is empty, return an empty string for it.`

async function translateTo(client: Anthropic, locale: string, fields: Partial<Record<Field, string>>) {
  const source = Object.fromEntries(FIELDS.map((f) => [f, fields[f] ?? '']))
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // Pas besoin de raisonnement pour une traduction contrainte par schéma → plus rapide/moins cher.
    thinking: { type: 'disabled' },
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Target language: ${LANG_NAMES[locale] || locale}.\n\nFrench source fields (JSON):\n${JSON.stringify(source, null, 2)}`,
      },
    ],
  })
  const textBlock = msg.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined
  if (!textBlock) throw new Error(`Réponse vide pour ${locale}`)
  const parsed = JSON.parse(textBlock.text) as Record<string, string>
  // Ne garder que les champs non vides (les vides retomberont sur le FR à l'envoi).
  const out: Record<string, string> = {}
  for (const f of FIELDS) if (typeof parsed[f] === 'string' && parsed[f].trim()) out[f] = parsed[f]
  return out
}

/**
 * POST /api/admin/communications/translate
 * Body: { fields: { email_subject, email_preview_text, email_body_html, email_cta_text,
 *                   notification_title, notification_body }, targets?: ['en','es','de','it'] }
 * → { translations: { en: {...}, es: {...}, de: {...}, it: {...} } }
 * Traduit le contenu FR vers chaque langue cible (repli FR côté envoi si un champ manque).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!isSuperAdmin(profile?.role as UserRole)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Traduction indisponible : la clé ANTHROPIC_API_KEY n\'est pas configurée sur le serveur.' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const fields = (body?.fields || {}) as Partial<Record<Field, string>>
    const targets: string[] = Array.isArray(body?.targets) && body.targets.length
      ? body.targets.filter((l: string) => l in LANG_NAMES)
      : ['en', 'es', 'de', 'it']

    // Au moins un champ FR non vide
    if (!FIELDS.some((f) => (fields[f] || '').trim())) {
      return NextResponse.json({ error: 'Aucun contenu FR à traduire' }, { status: 400 })
    }

    const client = new Anthropic() // lit ANTHROPIC_API_KEY

    const results = await Promise.allSettled(targets.map((loc) => translateTo(client, loc, fields)))
    const translations: Record<string, Record<string, string>> = {}
    const errors: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') translations[targets[i]] = r.value
      else errors.push(`${targets[i]}: ${r.reason?.message || 'erreur'}`)
    })

    if (Object.keys(translations).length === 0) {
      return NextResponse.json({ error: 'Échec de la traduction', details: errors }, { status: 502 })
    }
    return NextResponse.json({ translations, errors: errors.length ? errors : undefined })
  } catch (error: any) {
    console.error('[communications/translate] error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
