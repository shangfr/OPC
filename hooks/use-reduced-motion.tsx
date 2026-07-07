import { useReducedMotion } from "motion/react";

/**
 * Hook that returns motion props respecting `prefers-reduced-motion`.
 * When reduced motion is preferred, animations are instant (duration: 0).
 *
 * Note: Most animations are handled globally via `<MotionConfig reducedMotion="user">`
 * in the chat layout. Use this hook only for manual overrides.
 */
export function useMotionAccessibility() {
  const shouldReduce = useReducedMotion();

  return {
    /** Transition override: instant when reduced motion is preferred */
    transition: shouldReduce ? { duration: 0 } : undefined,
    /** Whether animations should play */
    shouldAnimate: !shouldReduce,
  };
}
