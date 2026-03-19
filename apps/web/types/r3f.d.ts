/**
 * Augments global JSX namespace with React Three Fiber's intrinsic elements.
 * This silences tsc errors for <mesh>, <boxGeometry>, <ambientLight> etc.
 * when running `tsc --noEmit` standalone (Next.js itself handles this via SWC).
 *
 * @react-three/fiber exports `ThreeElements` which extends JSX.IntrinsicElements
 * when this module is imported in a .d.ts file.
 */

/// <reference types="@react-three/fiber" />
