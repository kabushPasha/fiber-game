import { Vector2, TempNode, NodeUpdateType } from 'three/webgpu';
import { nodeObject, Fn, uv, uniform, convertToTexture, vec2, vec3, vec4, mat3, luminance, add, mat4,getViewPosition,screenUV } from 'three/tsl';
import { HalfFloatType,  RenderTarget, RendererUtils, QuadMesh, NodeMaterial,   Matrix4, DepthTexture } from 'three/webgpu';
import { clamp,length,exp, sub,float, If,  max,  texture, passTexture, velocity, viewZToPerspectiveDepth, struct, ivec2, mix } from 'three/tsl';



class FogOperatorNode extends TempNode {

	static get type() { return 'FogOperatorNode';}

	constructor( textureNode,camera ) {
		super( 'vec4' );

		this.textureNode = textureNode;
		this.camera = camera;
		this.updateBeforeType = NodeUpdateType.FRAME;
		
		this._cameraNearFar = uniform( new Vector2() );
		this._cameraWorldMatrix = uniform( new Matrix4() );
		this._cameraWorldMatrixInverse = uniform( new Matrix4() );
		this._cameraProjectionMatrixInverse = uniform( new Matrix4() );
		
		this.heightFalloff = uniform(0.01);
		this.density = uniform(0.0025);
	}


	updateBefore(  ) {
		this._cameraNearFar.value.set( this.camera.near, this.camera.far );
		this._cameraWorldMatrix.value.copy( this.camera.matrixWorld );
		this._cameraWorldMatrixInverse.value.copy( this.camera.matrixWorldInverse );
		this._cameraProjectionMatrixInverse.value.copy( this.camera.projectionMatrixInverse );
	}

	setup() {
		const uvNode = uv();

		const fog = Fn( () => {
			const depth = this.textureNode.sample(uvNode).r; 
			// Reconstruct view-space position
			const viewPos = getViewPosition(uvNode, depth, this._cameraProjectionMatrixInverse);
			const viewDepth = length(viewPos);
			const worldPos = this._cameraWorldMatrix.mul(vec4(viewPos, 1.0)).xyz;

			// Calc Fog
			const heightFactor = exp(worldPos.y.negate().mul(this.heightFalloff));
			
			// Adjusted density
			const adjustedDensity = this.density.mul(heightFactor);
			
			// Exponential fog factor
			const fogFactor = clamp(sub(1.0, exp(viewDepth.negate().mul(adjustedDensity))),0.0,1.0);
			
			return vec4(fogFactor);
		});
		const outputNode = fog();
		return outputNode;
	}

}

export default FogOperatorNode;

export const FogNode = ( node,camera ) => nodeObject( new FogOperatorNode( convertToTexture( node ),camera ) );
