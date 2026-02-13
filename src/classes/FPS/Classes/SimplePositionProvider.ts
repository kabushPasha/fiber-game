// src/classes/SimplePositionProvider.ts

import * as THREE from 'three';

export class SimplePositionProvider {
  size: THREE.Vector3;

  constructor(size: THREE.Vector3) {
    this.size = size.clone();
  }

  getFreePosition(): THREE.Vector3 {
    return new THREE.Vector3(
      (Math.random() - 0.5) * this.size.x,
      (Math.random() - 0.5) * this.size.y,
      this.size.z * 0.5
    );
  }

  setSize(size: THREE.Vector3) {
    this.size.copy(size);
  }

  setPosition( obj:any) {
    obj.position.copy( this.getFreePosition());
  }

  reset() {
    
  }
}

export class EmptyPositionProvider extends SimplePositionProvider {

  setPosition( ) {
  }

  reset() {
    
  }
}