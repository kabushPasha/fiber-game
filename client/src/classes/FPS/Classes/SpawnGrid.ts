import * as THREE from 'three';

// Small Cell class
export class Cell<T = any> {
  pos: THREE.Vector3;
  item: T | null = null;

  constructor(position: THREE.Vector3) {
    this.pos = position;
  }

  get isFree(): boolean {
    return this.item === null;
  }

  occupy(item: T): void {
    this.item = item;
    // @ts-ignore: allow item to have `cell` property
    (item as any).cell = this;
  }

  clear(): void {
    if (this.item) {
      // @ts-ignore
      (this.item as any).cell = null;
      this.item = null;
    }
  }
}

export class SpawnGrid<T = any> {
  cells: Cell<T>[] = [];

  constructor(sizex: number = 3, sizey: number = 3) {
    this.init(sizex, sizey);
  }

  init(sizex: number, sizey: number): void {
    this.cells = [];

    const stepX = 1 / sizex;
    const stepY = 1 / sizey;
    const halfX = 0.5;
    const halfY = 0.5;

    for (let i = 0; i < sizex; i++) {
      for (let j = 0; j < sizey; j++) {
        const posX = -halfX + stepX / 2 + i * stepX;
        const posY = -halfY + stepY / 2 + j * stepY;
        const posZ = 0.5;
        this.cells.push(new Cell<T>(new THREE.Vector3(posX, posY, posZ)));
      }
    }
  }

  get freeCells(): Cell<T>[] {
    return this.cells.filter(cell => cell.isFree);
  }

  getFreeCell(): Cell<T> | null {
    const freeCells = this.freeCells;
    if (freeCells.length === 0) return null;
    const index = Math.floor(Math.random() * freeCells.length);
    return freeCells[index];
  }
}
