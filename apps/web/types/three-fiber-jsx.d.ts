import type { JSX as R3FJSX } from "@react-three/fiber";

declare global {
  // Merge react-three-fiber's JSX IntrinsicElements into the global JSX namespace
  namespace JSX {
    interface IntrinsicElements extends R3FJSX.IntrinsicElements {}
  }
}
