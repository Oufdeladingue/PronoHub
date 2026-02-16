'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
  target: number
  suffix?: string
  duration?: number
}

export function AnimatedCounter({ target, suffix = '', duration = 1200 }: AnimatedCounterProps) {
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  // Start animation when element enters viewport
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [started])

  // Animate count
  useEffect(() => {
    if (!started) return

    const steps = 40
    const increment = target / steps
    const stepDuration = duration / steps
    let current = 0
    let step = 0

    const timer = setInterval(() => {
      step++
      // Ease-out: fast start, slow end
      const progress = step / steps
      const eased = 1 - Math.pow(1 - progress, 3)
      current = Math.round(eased * target)
      setCount(current)

      if (step >= steps) {
        setCount(target)
        clearInterval(timer)
      }
    }, stepDuration)

    return () => clearInterval(timer)
  }, [started, target, duration])

  const formatted = count >= 1000
    ? `${Math.floor(count / 1000)} ${String(count % 1000).padStart(3, '0')}`
    : String(count)

  return (
    <span ref={ref}>
      {formatted}{suffix}
    </span>
  )
}
