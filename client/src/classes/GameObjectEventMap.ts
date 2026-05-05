import * as THREE from 'three';

export interface GameObjectEventMap extends THREE.Object3DEventMap {
  tick: { type: "tick"; source: THREE.Object3D; delta: number }
  hover: { type: "hover"; source: THREE.Object3D; delta: number }
  hit: { type: "hit"; source: THREE.Object3D }
  mount: { type: "mount"; source: THREE.Object3D }
  add_score: {type: "add_score", source: THREE.Object3D; score: number }
  score_change: {type: "score_change", source: THREE.Object3D}
}

export type GameObject = THREE.Object3D<GameObjectEventMap>