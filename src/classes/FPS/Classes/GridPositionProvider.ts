// src/classes/GridPositionProvider.ts

import * as THREE from 'three';
import { SimplePositionProvider } from './SimplePositionProvider';
import { SpawnGrid, Cell } from './SpawnGrid';

export class GridPositionProvider extends SimplePositionProvider {
    private spawnGrid: SpawnGrid;

    constructor({
        size = new THREE.Vector3(3,3,0.1),
        gridx = 3,
        gridy = 3,
    }: {
        size?: THREE.Vector3;
        gridx?: number;
        gridy?: number;
    }) {
        super(size);
        this.spawnGrid = new SpawnGrid(gridx, gridy);
    }

    override setPosition(obj: any) {
        const cell: Cell | null = this.spawnGrid.getFreeCell();
        if (!cell) return;

        // Clear previous cell
        if ((obj as any).cell) { (obj as any).cell.clear(); }
        cell.occupy(obj);
        obj.position.copy(cell.pos.clone().multiply(this.size));
    }

    release(obj: any) {
        if ((obj as any).cell) { (obj as any).cell.clear(); }
    }

    reset() {
        for (const cell of this.spawnGrid.cells) { cell.clear(); }
    }

}