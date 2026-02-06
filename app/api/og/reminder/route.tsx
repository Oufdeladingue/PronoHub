import { NextRequest, NextResponse } from 'next/server'
import satori from 'satori'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'

// Phrases d'accroche aléatoires
const CATCHPHRASES = [
  'Alors, qui va se tromper cette fois ?',
  'Les experts sont attendus…',
  'Fais ton prono avant de regretter.',
  "C'est le moment de prouver que tu t'y connais.",
  'On sait déjà qui va se tromper…',
  'Ne laisse pas les autres décider à ta place.',
]

// Charger la police Inter depuis Google Fonts
async function loadFont(weight: number = 400): Promise<ArrayBuffer> {
  // Inter font weights: 400 (regular), 700 (bold), 900 (black)
  const fontUrls: Record<number, string> = {
    400: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff',
    700: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6fAZ9hjp-Ek-_EeA.woff',
    900: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuBWYAZ9hjp-Ek-_EeA.woff',
  }

  const fontUrl = fontUrls[weight] || fontUrls[400]

  try {
    const response = await fetch(fontUrl)
    if (response.ok) {
      return await response.arrayBuffer()
    }
  } catch (e) {
    console.error('[OG] Error loading font:', e)
  }

  throw new Error('Could not load font')
}

// Télécharger une image et la convertir en base64 data URL
async function fetchImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null

  try {
    const response = await fetch(url, { next: { revalidate: 3600 } }) // Cache 1h
    if (!response.ok) return null

    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const contentType = response.headers.get('content-type') || 'image/png'
    return `data:${contentType};base64,${base64}`
  } catch (e) {
    console.error('[OG] Error fetching image:', url, e)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Récupérer les paramètres
    const homeTeam = searchParams.get('home') || 'Équipe A'
    const awayTeam = searchParams.get('away') || 'Équipe B'
    const homeLogoUrl = searchParams.get('homeLogo') || ''
    const awayLogoUrl = searchParams.get('awayLogo') || ''
    const competitionLogoUrl = searchParams.get('competitionLogo') || ''
    const matchTime = searchParams.get('time') || '21:00'
    const deadline = searchParams.get('deadline') || '20:30'
    const otherCount = parseInt(searchParams.get('otherCount') || '0', 10)

    // Choisir une phrase d'accroche aléatoire
    const catchphrase = CATCHPHRASES[Math.floor(Math.random() * CATCHPHRASES.length)]

    // Charger les polices (regular et bold)
    let fontDataRegular: ArrayBuffer
    let fontDataBold: ArrayBuffer
    let fontDataBlack: ArrayBuffer
    try {
      ;[fontDataRegular, fontDataBold, fontDataBlack] = await Promise.all([
        loadFont(400),
        loadFont(700),
        loadFont(900),
      ])
    } catch (e) {
      return NextResponse.json({ error: 'Font loading failed' }, { status: 500 })
    }

    // Charger l'image de fond
    const bgPath = path.join(process.cwd(), 'public', 'images', 'og-reminder-bg.png')
    let bgBuffer: Buffer
    try {
      bgBuffer = await fs.readFile(bgPath)
    } catch (e) {
      console.error('[OG] Background image not found:', bgPath)
      return NextResponse.json({ error: 'Background image not found' }, { status: 500 })
    }

    // Télécharger les logos (équipes + compétition)
    const [homeLogoBase64, awayLogoBase64, competitionLogoBase64] = await Promise.all([
      fetchImageAsBase64(homeLogoUrl),
      fetchImageAsBase64(awayLogoUrl),
      fetchImageAsBase64(competitionLogoUrl),
    ])

    // Style commun pour le drop shadow
    const dropShadowStyle = '0px 0px 32px rgba(0,0,0,0.8)'

    // Construire le contenu SVG
    const children: any[] = []

    // Container principal (position relative pour le texte en bas)
    children.push({
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '30px 40px',
          fontFamily: 'Inter',
          position: 'relative',
        },
        children: [
          // Phrase d'accroche en haut (positionnée en absolu, centrée)
          {
            type: 'div',
            props: {
              style: {
                position: 'absolute',
                top: '24px',
                left: '0',
                right: '0',
                display: 'flex',
                justifyContent: 'center',
                fontSize: '32px',
                fontWeight: 700,
                color: '#ff9900',
                textShadow: '0px 0px 32px rgba(0,0,0,1), 2px 2px 8px rgba(0,0,0,0.9)',
              },
              children: catchphrase,
            },
          },
          // Ligne des équipes avec logos
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '50px',
                marginBottom: '16px',
              },
              children: [
                // Équipe domicile
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '16px',
                    },
                    children: [
                      // Logo domicile (avec halo sombre derrière)
                      {
                        type: 'div',
                        props: {
                          style: {
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '170px',
                            height: '170px',
                          },
                          children: [
                            // Halo sombre derrière le logo
                            {
                              type: 'div',
                              props: {
                                style: {
                                  position: 'absolute',
                                  width: '170px',
                                  height: '170px',
                                  borderRadius: '50%',
                                  background: 'radial-gradient(circle, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)',
                                },
                              },
                            },
                            // Logo
                            homeLogoBase64
                              ? {
                                  type: 'img',
                                  props: {
                                    src: homeLogoBase64,
                                    width: 150,
                                    height: 150,
                                  },
                                }
                              : {
                                  type: 'div',
                                  props: {
                                    style: {
                                      width: '150px',
                                      height: '150px',
                                      borderRadius: '50%',
                                      background: 'rgba(255,255,255,0.2)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '60px',
                                    },
                                    children: '⚽',
                                  },
                                },
                          ],
                        },
                      },
                      // Nom équipe domicile (plus grand avec shadow)
                      {
                        type: 'span',
                        props: {
                          style: {
                            fontSize: '32px',
                            fontWeight: 700,
                            color: '#ffffff',
                            textShadow: '0px 0px 24px rgba(0,0,0,0.9), 2px 2px 4px rgba(0,0,0,0.8)',
                            maxWidth: '220px',
                            textAlign: 'center',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          },
                          children: homeTeam,
                        },
                      },
                    ],
                  },
                },
                // Section centrale (Logo compétition + VS + Heure)
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                    },
                    children: [
                      // Logo compétition au-dessus du VS (avec fond blanc)
                      competitionLogoBase64
                        ? {
                            type: 'div',
                            props: {
                              style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '70px',
                                height: '70px',
                                borderRadius: '50%',
                                background: 'rgba(255,255,255,0.95)',
                                padding: '8px',
                                marginBottom: '4px',
                                boxShadow: '0px 0px 16px rgba(0,0,0,0.5)',
                              },
                              children: {
                                type: 'img',
                                props: {
                                  src: competitionLogoBase64,
                                  width: 54,
                                  height: 54,
                                },
                              },
                            },
                          }
                        : null,
                      // VS (plus gras, style différent)
                      {
                        type: 'span',
                        props: {
                          style: {
                            fontSize: '40px',
                            fontWeight: 900,
                            color: '#FFCC00',
                            textShadow: '0px 0px 20px rgba(255,204,0,0.5), 3px 3px 6px rgba(0,0,0,0.8)',
                            letterSpacing: '4px',
                          },
                          children: 'VS',
                        },
                      },
                      // Heure du match
                      {
                        type: 'span',
                        props: {
                          style: {
                            fontSize: '32px',
                            fontWeight: 700,
                            color: '#ffffff',
                            textShadow: '2px 2px 4px rgba(0,0,0,0.7)',
                          },
                          children: matchTime,
                        },
                      },
                    ].filter(Boolean), // Enlever les null (si pas de logo compétition)
                  },
                },
                // Équipe extérieur
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '16px',
                    },
                    children: [
                      // Logo extérieur (avec halo sombre derrière)
                      {
                        type: 'div',
                        props: {
                          style: {
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '170px',
                            height: '170px',
                          },
                          children: [
                            // Halo sombre derrière le logo
                            {
                              type: 'div',
                              props: {
                                style: {
                                  position: 'absolute',
                                  width: '170px',
                                  height: '170px',
                                  borderRadius: '50%',
                                  background: 'radial-gradient(circle, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)',
                                },
                              },
                            },
                            // Logo
                            awayLogoBase64
                              ? {
                                  type: 'img',
                                  props: {
                                    src: awayLogoBase64,
                                    width: 150,
                                    height: 150,
                                  },
                                }
                              : {
                                  type: 'div',
                                  props: {
                                    style: {
                                      width: '150px',
                                      height: '150px',
                                      borderRadius: '50%',
                                      background: 'rgba(255,255,255,0.2)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '60px',
                                    },
                                    children: '⚽',
                                  },
                                },
                          ],
                        },
                      },
                      // Nom équipe extérieur (plus grand avec shadow)
                      {
                        type: 'span',
                        props: {
                          style: {
                            fontSize: '32px',
                            fontWeight: 700,
                            color: '#ffffff',
                            textShadow: '0px 0px 24px rgba(0,0,0,0.9), 2px 2px 4px rgba(0,0,0,0.8)',
                            maxWidth: '220px',
                            textAlign: 'center',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          },
                          children: awayTeam,
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          // Deadline
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(0,0,0,0.7)',
                padding: '14px 32px',
                borderRadius: '30px',
                marginTop: '12px',
              },
              children: [
                {
                  type: 'span',
                  props: {
                    style: {
                      fontSize: '22px',
                      color: '#94a3b8',
                    },
                    children: "Tu as jusqu'à :",
                  },
                },
                {
                  type: 'span',
                  props: {
                    style: {
                      fontSize: '28px',
                      fontWeight: 700,
                      color: '#FFCC00',
                    },
                    children: deadline,
                  },
                },
              ],
            },
          },
          // Autres matchs si présents (positionné en bas, centré)
          ...(otherCount > 0
            ? [
                {
                  type: 'div',
                  props: {
                    style: {
                      position: 'absolute',
                      bottom: '8px',
                      left: '0',
                      right: '0',
                      display: 'flex',
                      justifyContent: 'center',
                      fontSize: '20px',
                      fontWeight: 600,
                      color: '#ffffff',
                      textShadow: '1px 1px 4px rgba(0,0,0,0.7)',
                    },
                    children: `+ ${otherCount} autre${otherCount > 1 ? 's' : ''} rencontre${otherCount > 1 ? 's' : ''}`,
                  },
                },
              ]
            : []),
        ],
      },
    })

    // Générer le SVG overlay avec satori
    const svg = await satori(
      {
        type: 'div',
        props: {
          style: {
            width: '100%',
            height: '100%',
            display: 'flex',
          },
          children: children,
        },
      },
      {
        width: 1024,
        height: 512,
        fonts: [
          {
            name: 'Inter',
            data: fontDataRegular,
            weight: 400,
            style: 'normal',
          },
          {
            name: 'Inter',
            data: fontDataBold,
            weight: 700,
            style: 'normal',
          },
          {
            name: 'Inter',
            data: fontDataBlack,
            weight: 900,
            style: 'normal',
          },
        ],
      }
    )

    // Convertir le SVG overlay en PNG transparent
    const overlayPng = await sharp(Buffer.from(svg)).png().toBuffer()

    // Redimensionner le fond à 1024x512 et composer avec l'overlay
    const finalImage = await sharp(bgBuffer)
      .resize(1024, 512, { fit: 'cover' })
      .composite([
        {
          input: overlayPng,
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer()

    return new NextResponse(finalImage, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (error) {
    console.error('[OG] Error generating image:', error)
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
  }
}
