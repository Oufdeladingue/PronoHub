import { NextRequest, NextResponse } from 'next/server'
import React from 'react'
import satori from 'satori'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'

// Charger la police Inter depuis Google Fonts
async function loadFont(weight: number = 400): Promise<ArrayBuffer> {
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
    console.error('[OG-NewMatches] Error loading font:', e)
  }

  throw new Error('Could not load font')
}

// Télécharger une image et la convertir en base64 data URL
async function fetchImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null

  try {
    const response = await fetch(url, { next: { revalidate: 3600 } })
    if (!response.ok) return null

    const buffer = await response.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const contentType = response.headers.get('content-type') || 'image/png'
    return `data:${contentType};base64,${base64}`
  } catch (e) {
    console.error('[OG-NewMatches] Error fetching image:', url, e)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Paramètres
    const tournament = searchParams.get('tournament') || 'Tournoi'
    const homeTeam = searchParams.get('home') || 'Équipe A'
    const awayTeam = searchParams.get('away') || 'Équipe B'
    const homeLogoUrl = searchParams.get('homeLogo') || ''
    const awayLogoUrl = searchParams.get('awayLogo') || ''
    const competitionLogoUrl = searchParams.get('competitionLogo') || ''
    const matchTime = searchParams.get('time') || '21:00'
    const otherCount = parseInt(searchParams.get('otherCount') || '0', 10)

    // Charger les polices
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
    const bgPath = path.join(process.cwd(), 'public', 'images', 'og-new-matches-bg.png')
    let bgBuffer: Buffer
    try {
      bgBuffer = await fs.readFile(bgPath)
    } catch (e) {
      console.error('[OG-NewMatches] Background image not found:', bgPath)
      return NextResponse.json({ error: 'Background image not found' }, { status: 500 })
    }

    // Télécharger les logos en parallèle
    const [homeLogoBase64, awayLogoBase64, competitionLogoBase64] = await Promise.all([
      fetchImageAsBase64(homeLogoUrl),
      fetchImageAsBase64(awayLogoUrl),
      fetchImageAsBase64(competitionLogoUrl),
    ])

    // Construire le layout
    const children: any[] = []

    // Container principal - flexbox horizontal : titre en haut à gauche, badge à droite (90% hauteur)
    children.push({
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '24px 32px',
          fontFamily: 'Inter',
        },
        children: [
          // ===== PARTIE GAUCHE : Titre aligné en haut =====
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                width: '50%',
                paddingTop: '16px',
                paddingRight: '16px',
              },
              children: [
                {
                  type: 'span',
                  props: {
                    style: {
                      fontSize: '52px',
                      fontWeight: 900,
                      color: '#ffffff',
                      lineHeight: 1.15,
                      textShadow: '0px 0px 32px rgba(0,0,0,1), 3px 3px 8px rgba(0,0,0,0.9)',
                    },
                    children: 'Le coach',
                  },
                },
                {
                  type: 'span',
                  props: {
                    style: {
                      fontSize: '52px',
                      fontWeight: 900,
                      color: '#ffffff',
                      lineHeight: 1.15,
                      textShadow: '0px 0px 32px rgba(0,0,0,1), 3px 3px 8px rgba(0,0,0,0.9)',
                    },
                    children: 'demande un',
                  },
                },
                {
                  type: 'span',
                  props: {
                    style: {
                      fontSize: '52px',
                      fontWeight: 900,
                      color: '#ff9900',
                      lineHeight: 1.15,
                      textShadow: '0px 0px 32px rgba(255,153,0,0.6), 3px 3px 8px rgba(0,0,0,0.9)',
                    },
                    children: 'changement...',
                  },
                },
              ],
            },
          },

          // ===== PARTIE DROITE : Badge infos match (90% hauteur) =====
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '46%',
                height: '460px',
                background: 'rgba(30, 41, 59, 0.60)',
                borderRadius: '20px',
                padding: '20px 24px',
                gap: '16px',
              },
              children: [
                // Nom du tournoi
                {
                  type: 'span',
                  props: {
                    style: {
                      fontSize: '32px',
                      fontWeight: 700,
                      color: '#ff9900',
                      textAlign: 'center',
                      textShadow: '1px 1px 4px rgba(0,0,0,0.6)',
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    },
                    children: tournament,
                  },
                },

                // Logo compétition (version blanche)
                ...(competitionLogoBase64
                  ? [
                      {
                        type: 'img',
                        props: {
                          src: competitionLogoBase64,
                          width: 64,
                          height: 64,
                          style: {
                            filter: 'brightness(0) invert(1)',
                          },
                        },
                      },
                    ]
                  : []),

                // Section match : logos + noms + VS + heure
                {
                  type: 'div',
                  props: {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '20px',
                      width: '100%',
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
                            gap: '8px',
                            flex: '1',
                          },
                          children: [
                            homeLogoBase64
                              ? {
                                  type: 'img',
                                  props: {
                                    src: homeLogoBase64,
                                    width: 80,
                                    height: 80,
                                  },
                                }
                              : {
                                  type: 'div',
                                  props: {
                                    style: {
                                      width: '80px',
                                      height: '80px',
                                      borderRadius: '50%',
                                      background: 'rgba(255,255,255,0.15)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '42px',
                                    },
                                    children: '⚽',
                                  },
                                },
                            {
                              type: 'span',
                              props: {
                                style: {
                                  fontSize: '20px',
                                  fontWeight: 700,
                                  color: '#ffffff',
                                  textAlign: 'center',
                                  maxWidth: '140px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  textShadow: '1px 1px 3px rgba(0,0,0,0.7)',
                                },
                                children: homeTeam,
                              },
                            },
                          ],
                        },
                      },

                      // VS + Heure
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                          },
                          children: [
                            {
                              type: 'span',
                              props: {
                                style: {
                                  fontSize: '36px',
                                  fontWeight: 900,
                                  color: '#ff9900',
                                  textShadow: '0px 0px 12px rgba(255,153,0,0.4), 2px 2px 4px rgba(0,0,0,0.8)',
                                },
                                children: 'VS',
                              },
                            },
                            {
                              type: 'span',
                              props: {
                                style: {
                                  fontSize: '28px',
                                  fontWeight: 700,
                                  color: '#ffffff',
                                  textShadow: '1px 1px 3px rgba(0,0,0,0.7)',
                                },
                                children: matchTime,
                              },
                            },
                          ],
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
                            gap: '8px',
                            flex: '1',
                          },
                          children: [
                            awayLogoBase64
                              ? {
                                  type: 'img',
                                  props: {
                                    src: awayLogoBase64,
                                    width: 80,
                                    height: 80,
                                  },
                                }
                              : {
                                  type: 'div',
                                  props: {
                                    style: {
                                      width: '80px',
                                      height: '80px',
                                      borderRadius: '50%',
                                      background: 'rgba(255,255,255,0.15)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '42px',
                                    },
                                    children: '⚽',
                                  },
                                },
                            {
                              type: 'span',
                              props: {
                                style: {
                                  fontSize: '20px',
                                  fontWeight: 700,
                                  color: '#ffffff',
                                  textAlign: 'center',
                                  maxWidth: '140px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  textShadow: '1px 1px 3px rgba(0,0,0,0.7)',
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

                // Bouton "X autres matchs" si otherCount > 0
                ...(otherCount > 0
                  ? [
                      {
                        type: 'div',
                        props: {
                          style: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(30, 41, 59, 0.90)',
                            border: '2px solid #ff9900',
                            borderRadius: '14px',
                            padding: '12px 32px',
                            marginTop: '4px',
                          },
                          children: {
                            type: 'span',
                            props: {
                              style: {
                                fontSize: '24px',
                                fontWeight: 700,
                                color: '#ff9900',
                              },
                              children: `${otherCount} autre${otherCount > 1 ? 's' : ''} match${otherCount > 1 ? 's' : ''}`,
                            },
                          },
                        },
                      },
                    ]
                  : []),
              ],
            },
          },
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
      } as React.ReactElement,
      {
        width: 1024,
        height: 512,
        fonts: [
          { name: 'Inter', data: fontDataRegular, weight: 400, style: 'normal' as const },
          { name: 'Inter', data: fontDataBold, weight: 700, style: 'normal' as const },
          { name: 'Inter', data: fontDataBlack, weight: 900, style: 'normal' as const },
        ],
      }
    )

    // Composer : fond + overlay
    const overlayPng = await sharp(Buffer.from(svg)).png().toBuffer()

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

    return new NextResponse(new Uint8Array(finalImage), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (error) {
    console.error('[OG-NewMatches] Error generating image:', error)
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 })
  }
}
