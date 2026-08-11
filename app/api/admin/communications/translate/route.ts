import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import Anthropic from '@anthropic-ai/sdk'

// Fournisseur de traduction :
//   1. DeepL API Free (DEEPL_API_KEY) — gratuit, prioritaire, excellent EN/ES/DE/IT
//   2. Anthropic (ANTHROPIC_API_KEY) — repli payant
//   3. sinon → 503 (saisie manuelle des onglets)
const DEEPL_KEY = process.env.DEEPL_API_KEY
// Modèle Anthropic : défaut Opus 5 (surchargeable par env si besoin de coût/latence).
const MODEL = process.env.COMM_TRANSLATE_MODEL || 'claude-opus-5'

// Champs traduisibles d'une communication (mêmes clés que le composer/JSON translations).
// `email_content_html` = contenu interne WYSIWYG (nouveau flux, éditeur visuel) ;
// `email_body_html` = HTML complet (records legacy en HTML brut). On envoie l'un OU l'autre
// selon le record ; les champs vides sont ignorés → un seul aller-retour.
const FIELDS = [
  'email_subject',
  'email_preview_text',
  'email_content_html',
  'email_body_html',
  'email_cta_text',
  'notification_title',
  'notification_body',
] as const
type Field = typeof FIELDS[number]

// Codes langue DeepL (EN doit être régionalisé : EN-GB).
const DEEPL_LANG: Record<string, string> = { en: 'EN-GB', es: 'ES', de: 'DE', it: 'IT' }
// Noms de langue pour le prompt Anthropic.
const LANG_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish (Spain, castellano)',
  de: 'German (Hochdeutsch, tutoiement "du")',
  it: 'Italian (tutoiement "tu")',
}
const SUPPORTED = Object.keys(DEEPL_LANG) // en, es, de, it

/* ------------------------------------------------------------------ *
 * Protection des placeholders / prix / marques avant traduction.
 * On enveloppe les tokens dans un tag <x>…</x> que DeepL ignore
 * (ignore_tags) et que Claude est instruit de préserver ; on le
 * retire ensuite. Le wrapping ne s'applique qu'aux nœuds TEXTE
 * (jamais dans une balise) → les attributs comme href="[CTA_URL]"
 * ne sont pas cassés.
 * ------------------------------------------------------------------ */
const PROTECT_RE = /(\[[^\]\n]+\])|(\{\{[^}\n]+\}\})|(\d+[.,]\d+\s?€)/g

function protect(text: string): string {
  // Découpe en segments texte / balise ; index pair = texte, impair = balise.
  return text
    .split(/(<[^>]+>)/)
    .map((seg, i) => (i % 2 === 1 ? seg : seg.replace(PROTECT_RE, (m) => `<x>${m}</x>`)))
    .join('')
}

function unprotect(text: string): string {
  return text.replace(/<\/?x>/g, '')
}

/* ------------------------- DeepL (gratuit) ------------------------- */
async function translateWithDeepL(locale: string, fields: Partial<Record<Field, string>>) {
  const target = DEEPL_LANG[locale]
  if (!target) throw new Error(`Langue non supportée: ${locale}`)

  // N'envoyer que les champs non vides (DeepL refuse les chaînes vides).
  const entries = FIELDS
    .map((f) => [f, (fields[f] ?? '').trim() ? protect(fields[f]!) : null] as const)
    .filter((e): e is [Field, string] => e[1] !== null)
  if (entries.length === 0) return {}

  const base = DEEPL_KEY!.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'
  const res = await fetch(`${base}/v2/translate`, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: entries.map(([, v]) => v),
      source_lang: 'FR',
      target_lang: target,
      tag_handling: 'html',
      ignore_tags: ['x'],
      preserve_formatting: true,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`DeepL ${res.status}: ${detail.slice(0, 200)}`)
  }

  const data = (await res.json()) as { translations?: { text: string }[] }
  const out: Record<string, string> = {}
  entries.forEach(([f], i) => {
    const raw = data.translations?.[i]?.text ?? ''
    const clean = unprotect(raw)
    if (clean.trim()) out[f] = clean
  })
  return out
}

/* ------------------------- Anthropic (repli) ---------------------- */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: Object.fromEntries(FIELDS.map((f) => [f, { type: 'string' }])),
  required: [...FIELDS],
}

const SYSTEM = `You are a professional translator for PronoHub, a football-prediction app (friendly, playful tone).
Translate the given FRENCH marketing content into the target language. Return ONLY the translated fields, as JSON matching the schema.

Rules:
- "email_content_html" and "email_body_html" are HTML: preserve ALL tags, attributes, inline styles and structure EXACTLY; translate only the human-visible text between tags.
- Preserve these placeholders verbatim wherever they appear, in any field: [username], [email], [HEADER_TITLE], [CTA_TEXT], [CTA_URL], and any {{...}} shortcodes. Never translate or alter them.
- Do NOT translate: brand/product names (PronoHub, WhatsApp, Facebook, Stripe, Free-Kick, One-Shot, Elite Team, Platinium, Premium), URLs, or prices (keep the French format, e.g. "4,99€").
- Natural, idiomatic, warm football wording. Use informal address (tu/du/tú) where the language supports it.
- If a source field is empty, return an empty string for it.`

async function translateWithClaude(client: Anthropic, locale: string, fields: Partial<Record<Field, string>>) {
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
 * Fournisseur : DeepL API Free si DEEPL_API_KEY, sinon Anthropic si ANTHROPIC_API_KEY.
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

    const provider: 'deepl' | 'claude' | null = DEEPL_KEY
      ? 'deepl'
      : process.env.ANTHROPIC_API_KEY
        ? 'claude'
        : null

    if (!provider) {
      return NextResponse.json(
        {
          error:
            'Traduction automatique indisponible : configure DEEPL_API_KEY (DeepL API Free, gratuit) ou ANTHROPIC_API_KEY sur le serveur. Sinon, remplis les onglets de langue à la main.',
        },
        { status: 503 }
      )
    }

    const body = await request.json()
    const fields = (body?.fields || {}) as Partial<Record<Field, string>>
    const targets: string[] = Array.isArray(body?.targets) && body.targets.length
      ? body.targets.filter((l: string) => SUPPORTED.includes(l))
      : [...SUPPORTED]

    // Au moins un champ FR non vide
    if (!FIELDS.some((f) => (fields[f] || '').trim())) {
      return NextResponse.json({ error: 'Aucun contenu FR à traduire' }, { status: 400 })
    }

    const client = provider === 'claude' ? new Anthropic() : null // lit ANTHROPIC_API_KEY

    const results = await Promise.allSettled(
      targets.map((loc) =>
        provider === 'deepl' ? translateWithDeepL(loc, fields) : translateWithClaude(client!, loc, fields)
      )
    )
    const translations: Record<string, Record<string, string>> = {}
    const errors: string[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') translations[targets[i]] = r.value
      else errors.push(`${targets[i]}: ${r.reason?.message || 'erreur'}`)
    })

    if (Object.keys(translations).length === 0) {
      return NextResponse.json({ error: 'Échec de la traduction', details: errors }, { status: 502 })
    }
    return NextResponse.json({ translations, provider, errors: errors.length ? errors : undefined })
  } catch (error: any) {
    console.error('[communications/translate] error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
