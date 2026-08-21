import { useEffect, useRef, useState } from 'react'

interface MediaObserverEntry { isIntersecting: boolean }
interface MediaObserver { observe(element: Element): void; disconnect(): void }
interface MediaObserverConstructor { new (callback: (entries: MediaObserverEntry[]) => void, options?: { rootMargin?: string }): MediaObserver }

function mediaObserverConstructor(): MediaObserverConstructor | undefined {
  return (globalThis as typeof globalThis & { IntersectionObserver?: MediaObserverConstructor }).IntersectionObserver
}

export function useLazyMedia(loading?: 'eager' | 'lazy') {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(() => loading !== 'lazy' || mediaObserverConstructor() === undefined)

  useEffect(() => {
    if (loading !== 'lazy') {
      if (!visible) setVisible(true)
      return
    }
    if (visible) return
    const element = ref.current
    const Observer = mediaObserverConstructor()
    if (element === null || Observer === undefined) {
      setVisible(true)
      return
    }
    const observer = new Observer(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '1200px 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [loading, visible])

  return { ref, visible }
}
