'use client'

import { MotionConfig } from 'framer-motion'

/** Respeta `prefers-reduced-motion` en todas las animaciones de framer-motion. */
export default function Providers({ children }: { children: React.ReactNode }) {
    return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
