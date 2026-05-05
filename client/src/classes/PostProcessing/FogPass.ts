import { Vector2, TempNode, NodeUpdateType, Matrix4, Node, TextureNode, UniformNode } from 'three/webgpu';
import { nodeObject, Fn, uv, uniform, convertToTexture, vec4, getViewPosition, clamp, sub, exp } from 'three/tsl';
import type { PerspectiveCamera } from 'three';

class FogOperatorNode extends TempNode {

  static get type(): string { return 'FogOperatorNode'; }

  private textureNode: TextureNode;
  private camera: PerspectiveCamera;
  private _cameraNearFar = uniform(new Vector2());
  private _cameraWorldMatrix = uniform(new Matrix4());
  private _cameraWorldMatrixInverse = uniform(new Matrix4());
  private _cameraProjectionMatrixInverse = uniform(new Matrix4());
  public heightFalloff: ReturnType<typeof uniform>;
  public density: ReturnType<typeof uniform>;

  constructor(
    textureNode: TextureNode,
    camera: PerspectiveCamera,
    heightFalloff?: UniformNode<number>,
    density?: UniformNode<number>
  ) {
    super('vec4');

    this.textureNode = textureNode;
    this.camera = camera;
    this.updateBeforeType = NodeUpdateType.FRAME;

    this.heightFalloff = heightFalloff ?? uniform(0.01);
    this.density = density ?? uniform(0.0025);
  }

  updateBefore(): void {
    this._cameraNearFar.value.set(this.camera.near, this.camera.far);
    this._cameraWorldMatrix.value.copy(this.camera.matrixWorld);
    this._cameraWorldMatrixInverse.value.copy(this.camera.matrixWorldInverse);
    this._cameraProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse);
  }

  setup(): Node {
    const uvNode = uv();

    const fog = Fn(() => {
      const depth = this.textureNode.sample(uvNode).r;

      // Reconstruct view-space position
      const viewPos = getViewPosition(uvNode, depth, this._cameraProjectionMatrixInverse);
      const viewDepth = viewPos.length();
      const worldPos = this._cameraWorldMatrix.mul(vec4(viewPos, 1.0)).xyz;


      // Calc Fog
      const heightFactor = exp(worldPos.y.negate().mul(this.heightFalloff));

      // Adjusted density
      const adjustedDensity = this.density.mul(heightFactor);

      // Exponential fog factor
      const fogFactor = clamp(sub(1.0, exp(viewDepth.negate().mul(adjustedDensity))), 0.0, 1.0);

      return vec4(fogFactor);
    });

    return fog();
  }
}

export default FogOperatorNode;

export const FogNode = (
  node: Node,
  camera: PerspectiveCamera,
  heightFalloff?: UniformNode<number>,
  density?: UniformNode<number>
): Node =>
  nodeObject(new FogOperatorNode(
    convertToTexture(node),
    camera,
    heightFalloff,
    density
  ));