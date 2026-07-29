/**
 * Intégration Discord — publication d'embeds via un webhook de salon.
 * Les webhooks sont créés par l'utilisateur (Paramètres serveur → Intégrations → Webhooks),
 * ne nécessitent ni OAuth ni validation Discord, et acceptent des images distantes (nos OG).
 */

const ORANGE = 0xff9900
const WEBHOOK_RE = /^https:\/\/(?:ptb\.|canary\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/

export function isValidDiscordWebhook(url: unknown): url is string {
  return typeof url === 'string' && WEBHOOK_RE.test(url.trim())
}

export interface DiscordEmbed {
  title: string
  description?: string
  url?: string // rend le titre cliquable
  imageUrl?: string // grande image (nos OG 1200x630)
  thumbnailUrl?: string // petite image (logo compétition)
  color?: number
  footer?: string
  fields?: { name: string; value: string; inline?: boolean }[]
}

/**
 * Poste un embed sur un webhook Discord. Best-effort : ne throw jamais (retourne false en cas d'échec).
 * @returns true si Discord a accepté (2xx)
 */
export async function postDiscordEmbed(webhookUrl: string, embed: DiscordEmbed): Promise<boolean> {
  if (!isValidDiscordWebhook(webhookUrl)) return false
  try {
    const payload = {
      username: 'PronoHub',
      avatar_url: 'https://www.pronohub.club/images/logo.png',
      embeds: [
        {
          title: embed.title.slice(0, 256),
          description: embed.description?.slice(0, 4096),
          url: embed.url,
          color: embed.color ?? ORANGE,
          ...(embed.imageUrl ? { image: { url: embed.imageUrl } } : {}),
          ...(embed.thumbnailUrl ? { thumbnail: { url: embed.thumbnailUrl } } : {}),
          ...(embed.fields?.length ? { fields: embed.fields.slice(0, 25) } : {}),
          footer: { text: embed.footer || 'PronoHub — pronos foot entre potes' },
        },
      ],
    }
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}
