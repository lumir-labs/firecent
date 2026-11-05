import { useState, useEffect, useRef, useCallback } from 'react'

export function useScrolled({
    threshold = 10,
    ref = null,
    smooth = false,
}: {
    threshold?: number
    ref?: React.RefObject<HTMLElement> | null
    smooth?: boolean
} = {}) {
    const [scrolled, setScrolled] = useState(false)
    const [scrollY, setScrollY] = useState(0)
    const ticking = useRef(false)

    const handleScroll = useCallback(() => {
        if (ticking.current) return
        ticking.current = true

        requestAnimationFrame(() => {
            const y = ref?.current ? ref.current.scrollTop : window.scrollY

            setScrolled(y > threshold)
            if (smooth) setScrollY(y)
            ticking.current = false
        })
    }, [threshold, ref, smooth])

    useEffect(() => {
        // ✅ window is only accessed inside useEffect → safe in Next.js
        const target = ref?.current ?? window
        target.addEventListener('scroll', handleScroll, { passive: true })
        handleScroll()
        return () => target.removeEventListener('scroll', handleScroll)
    }, [handleScroll, ref])

    return smooth ? { scrolled, scrollY } : scrolled
}