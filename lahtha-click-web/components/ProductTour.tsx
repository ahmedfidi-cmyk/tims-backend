'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface TourStep {
  /** CSS selector for the element to spotlight. If not found, the step is skipped. */
  selector: string
  title: string
  body: string
}

interface ProductTourProps {
  /** Unique id for this tour — namespaces its "completed" flag in localStorage. */
  tourId: string
  steps: TourStep[]
  /** Auto-launch on first visit (default true). Always false if steps is empty. */
  autoStart?: boolean
}

const STORAGE_PREFIX = 'lahtha-tour-done:'
const START_EVENT = 'lahtha:start-tour'

/** Fire this from anywhere (e.g. a nav link) to (re)launch a tour by id. */
export function startTour(tourId: string) {
  window.dispatchEvent(new CustomEvent(START_EVENT, { detail: { tourId } }))
}

interface Rect { top: number; left: number; width: number; height: number }

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

/**
 * A small, dependency-free guided tour: a dark overlay with a spotlight cutout
 * around a target element, plus a tooltip card with step navigation. Steps
 * whose selector isn't present in the DOM are skipped automatically (e.g. a
 * step that targets content hidden behind a loading/empty state).
 */
export default function ProductTour({ tourId, steps, autoStart = true }: ProductTourProps) {
  const [stepIndex, setStepIndex] = useState<number | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [everCompleted, setEverCompleted] = useState(false)
  const reduceMotion = useRef(false)

  const storageKey = `${STORAGE_PREFIX}${tourId}`

  const finish = useCallback(() => {
    setStepIndex(null)
    setRect(null)
    try { window.localStorage.setItem(storageKey, '1') } catch { /* storage unavailable, non-fatal */ }
    setEverCompleted(true)
  }, [storageKey])

  const begin = useCallback(() => {
    if (steps.length === 0) return
    setStepIndex(0)
  }, [steps.length])

  // First-visit auto-start + listen for manual (re)start requests from anywhere.
  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let done = false
    try { done = window.localStorage.getItem(storageKey) === '1' } catch { /* ignore */ }
    setEverCompleted(done)
    if (autoStart && !done && steps.length > 0) {
      const t = setTimeout(begin, 600) // let the page finish its own first render/fetch
      return () => clearTimeout(t)
    }
  }, [autoStart, storageKey, steps.length, begin])

  useEffect(() => {
    function onStart(e: Event) {
      const detail = (e as CustomEvent<{ tourId: string }>).detail
      if (detail?.tourId === tourId) begin()
    }
    window.addEventListener(START_EVENT, onStart)
    return () => window.removeEventListener(START_EVENT, onStart)
  }, [tourId, begin])

  // Track (and skip past missing) the current step's target element.
  useEffect(() => {
    if (stepIndex === null) return
    if (stepIndex >= steps.length) { finish(); return }

    const step = steps[stepIndex]
    const el = step ? document.querySelector(step.selector) : null
    if (!el) {
      setStepIndex((i) => (i === null ? null : i + 1)) // target absent — skip to next step
      return
    }
    el.scrollIntoView({ block: 'center', behavior: reduceMotion.current ? 'auto' : 'smooth' })
    const update = () => setRect(measure(el))
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [stepIndex, steps, finish])

  if (stepIndex === null) {
    // Discoverable re-entry point once a visitor has already been through (or
    // skipped) the tour once. Before that, autoStart alone is the entry point.
    if (!everCompleted || steps.length === 0) return null
    return (
      <button
        onClick={begin}
        className="fixed bottom-5 end-5 z-40 bg-lahtha-ink text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg hover:opacity-90 flex items-center gap-2"
      >
        🧭 جولة إرشادية
      </button>
    )
  }

  const step = steps[stepIndex]
  if (!step || !rect) return null

  const pad = 8
  const isLast = stepIndex === steps.length - 1
  // Prefer the tooltip below the target; flip above if there isn't room.
  const spaceBelow = window.innerHeight - (rect.top + rect.height)
  const showAbove = spaceBelow < 180 && rect.top > 180
  const tooltipTop = showAbove ? Math.max(12, rect.top - pad) : rect.top + rect.height + pad

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={step.title}>
      {/* Dimmed backdrop with a spotlight rectangle cut out via box-shadow. */}
      <div
        className="absolute rounded-lg transition-all duration-200"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: '0 0 0 9999px rgba(11, 20, 55, 0.65)',
          pointerEvents: 'none',
        }}
      />
      {/* Inert scrim: absorbs clicks so the page underneath can't be interacted
          with mid-tour, without closing the tour itself (that's Skip/Finish only). */}
      <div className="absolute inset-0" />
      <div
        className="absolute w-[min(320px,90vw)] bg-white rounded-xl shadow-2xl p-4 pointer-events-auto"
        style={{
          top: showAbove ? undefined : tooltipTop,
          bottom: showAbove ? window.innerHeight - tooltipTop : undefined,
          left: Math.min(Math.max(12, rect.left), window.innerWidth - 332),
        }}
      >
        <p className="text-xs text-ink-900/50 mb-1">{stepIndex + 1} من {steps.length}</p>
        <h3 className="font-bold text-ink-900 mb-1">{step.title}</h3>
        <p className="text-sm text-ink-900/70 leading-relaxed mb-4">{step.body}</p>
        <div className="flex items-center justify-between">
          <button onClick={finish} className="text-xs text-ink-900/50 hover:text-ink-900">تخطي الجولة</button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                onClick={() => setStepIndex((i) => (i === null ? null : i - 1))}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                السابق
              </button>
            )}
            <button
              onClick={() => (isLast ? finish() : setStepIndex((i) => (i === null ? null : i + 1)))}
              className="btn-primary text-xs px-3 py-1.5"
            >
              {isLast ? 'إنهاء الجولة' : 'التالي'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
