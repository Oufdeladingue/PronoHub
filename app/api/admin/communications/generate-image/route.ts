import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth-helpers'
import { UserRole } from '@/types'
import { loadOgFont } from '@/lib/og-fonts'
import satori from 'satori'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const maxDuration = 60

// Cloudflare Workers AI (text-to-image) — palier gratuit. Voir env Coolify.
const CF_ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID
const CF_TOKEN = process.env.CLOUDFLARE_AI_TOKEN
const CF_MODEL = process.env.CLOUDFLARE_AI_IMAGE_MODEL || '@cf/black-forest-labs/flux-1-schnell'

/** Génère un fond illustré 1:1 via Cloudflare Workers AI (base64 → Buffer). */
async function generateBackground(prompt: string): Promise<Buffer> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${CF_MODEL}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
      // FLUX-schnell : steps max 8. On demande explicitement "no text" (l'IA écrit mal ;
      // le titre net est ajouté ensuite via satori).
      body: JSON.stringify({ prompt, steps: 6 }),
    }
  )
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Cloudflare AI ${res.status}: ${detail.slice(0, 300)}`)
  }
  const data = (await res.json()) as any
  const b64 = data?.result?.image
  if (!b64 || typeof b64 !== 'string') {
    throw new Error('Réponse image vide de Cloudflare AI')
  }
  return Buffer.from(b64, 'base64')
}

// --- Support des emojis dans satori (Inter n'a pas les glyphes emoji) ---
// On convertit chaque emoji en SVG Twemoji, chargé par satori via loadAdditionalAsset.
const emojiCache = new Map<string, string>()

function toCodePoint(unicodeSurrogates: string): string {
  const r: string[] = []
  let c = 0, p = 0, i = 0
  while (i < unicodeSurrogates.length) {
    c = unicodeSurrogates.charCodeAt(i++)
    if (p) {
      r.push((0x10000 + ((p - 0xd800) << 10) + (c - 0xdc00)).toString(16))
      p = 0
    } else if (0xd800 <= c && c <= 0xdbff) {
      p = c
    } else {
      r.push(c.toString(16))
    }
  }
  return r.join('-')
}

function getIconCode(segment: string): string {
  const U200D = String.fromCharCode(0x200d)
  // Retirer le sélecteur de variante FE0F sauf pour les séquences ZWJ
  return toCodePoint(segment.indexOf(U200D) < 0 ? segment.replace(/️/g, '') : segment)
}

async function loadEmojiSvg(segment: string): Promise<string> {
  const code = getIconCode(segment)
  const cached = emojiCache.get(code)
  if (cached) return cached
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${code}.svg`)
    if (!res.ok) return ''
    const svg = await res.text()
    const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
    emojiCache.set(code, dataUri)
    return dataUri
  } catch {
    return ''
  }
}

/** Overlay satori : dégradé sombre en bas + wordmark + titre net. Retourne un PNG transparent. */
async function buildOverlay(title: string): Promise<Buffer> {
  const [reg, bold, black] = await Promise.all([loadOgFont(400), loadOgFont(700), loadOgFont(900)])
  // Titre : réduire la taille si long pour éviter le débordement
  const len = title.length
  const fontSize = len > 60 ? 40 : len > 40 ? 52 : len > 24 ? 60 : 72

  const tree = {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '40px 48px',
        fontFamily: 'Inter',
        // Assombrit le bas pour la lisibilité, garde le haut de l'image visible
        backgroundImage:
          'linear-gradient(180deg, rgba(10,10,20,0.30) 0%, rgba(10,10,20,0) 32%, rgba(10,10,20,0.55) 68%, rgba(10,10,20,0.90) 100%)',
      },
      children: [
        // Wordmark PronoHub (haut gauche)
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center' },
            children: [
              {
                type: 'span',
                props: {
                  style: {
                    fontSize: '26px', fontWeight: 900, color: '#ff9900',
                    letterSpacing: '2px', textShadow: '0 2px 8px rgba(0,0,0,0.95)',
                  },
                  children: 'PRONO',
                },
              },
              {
                type: 'span',
                props: {
                  style: {
                    fontSize: '26px', fontWeight: 900, color: '#ffffff',
                    letterSpacing: '2px', textShadow: '0 2px 8px rgba(0,0,0,0.95)',
                  },
                  children: 'HUB',
                },
              },
            ],
          },
        },
        // Titre (bas)
        {
          type: 'div',
          props: {
            style: { display: 'flex', maxWidth: '860px' },
            children: [
              {
                type: 'span',
                props: {
                  style: {
                    fontSize: `${fontSize}px`, fontWeight: 900, color: '#ffffff', lineHeight: 1.1,
                    textShadow: '0 4px 24px rgba(0,0,0,1), 0 2px 6px rgba(0,0,0,0.95)',
                  },
                  children: title,
                },
              },
            ],
          },
        },
      ],
    },
  }

  const svg = await satori(tree as any, {
    width: 1024,
    height: 512,
    fonts: [
      { name: 'Inter', data: reg, weight: 400 as const, style: 'normal' as const },
      { name: 'Inter', data: bold, weight: 700 as const, style: 'normal' as const },
      { name: 'Inter', data: black, weight: 900 as const, style: 'normal' as const },
    ],
    // Rendu des emojis en images Twemoji (Inter n'a pas les glyphes emoji)
    loadAdditionalAsset: async (code: string, segment: string) => {
      if (code === 'emoji') return loadEmojiSvg(segment)
      return '' // autres scripts non gérés → ignorés (nos titres = latin + emoji)
    },
  })
  return sharp(Buffer.from(svg)).png().toBuffer()
}

/**
 * POST /api/admin/communications/generate-image
 * Body: { prompt: string, title?: string, overlay?: boolean }
 * → { url } : PNG 1024x512 (fond IA + titre net) uploadé dans le bucket communication-images.
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

    if (!CF_ACCOUNT || !CF_TOKEN) {
      return NextResponse.json(
        { error: 'Génération indisponible : configure CLOUDFLARE_ACCOUNT_ID et CLOUDFLARE_AI_TOKEN sur le serveur.' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const prompt = (body?.prompt || '').toString().trim()
    const title = (body?.title || '').toString().trim()
    const overlay = body?.overlay !== false // défaut : true

    if (!prompt) {
      return NextResponse.json({ error: 'Décris le visuel souhaité (prompt vide).' }, { status: 400 })
    }

    // Enrichir le prompt : ambiance sport, zone haute plus calme pour le texte, pas de texte IA
    const fullPrompt =
      `${prompt}. Cinematic sports poster background, football/soccer atmosphere, dramatic lighting, ` +
      `high detail, vibrant colors, keep the top area darker and uncluttered for a text overlay. ` +
      `No text, no letters, no words, no watermark.`

    const bg = await generateBackground(fullPrompt)

    // 1024x512 (cover), + overlay titre si demandé
    const resized = await sharp(bg).resize(1024, 512, { fit: 'cover' }).png().toBuffer()
    let finalBuf = resized
    if (overlay && title) {
      const overlayPng = await buildOverlay(title)
      finalBuf = await sharp(resized).composite([{ input: overlayPng, top: 0, left: 0 }]).png().toBuffer()
    }

    // Upload dans le bucket public (service role)
    const admin = createAdminClient()
    const path = `ai/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`
    const { error: upErr } = await admin.storage
      .from('communication-images')
      .upload(path, finalBuf, { contentType: 'image/png', cacheControl: '3600', upsert: false })
    if (upErr) throw new Error(`Upload: ${upErr.message}`)

    const { data: { publicUrl } } = admin.storage.from('communication-images').getPublicUrl(path)
    return NextResponse.json({ url: publicUrl })
  } catch (error: any) {
    console.error('[communications/generate-image] error:', error)
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 })
  }
}
