/// <reference types="@react-three/fiber" />

import { extend } from '@react-three/fiber'
import { Object3D } from 'three'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: any
      mesh: any
      boxGeometry: any
      planeGeometry: any
      meshStandardMaterial: any
      meshBasicMaterial: any
      primitive: any
      ambientLight: any
      directionalLight: any
      hemisphereLight: any
    }
  }
}