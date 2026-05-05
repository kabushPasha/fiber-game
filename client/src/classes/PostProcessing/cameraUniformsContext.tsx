import React, { createContext, useContext, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector2, Matrix4, PerspectiveCamera } from 'three';
import { uniform } from 'three/tsl';

// ---- CameraUniforms type ----
export type CameraUniformsType = {
  cameraNearFar: ReturnType<typeof uniform<Vector2>>;
  cameraWorldMatrix: ReturnType<typeof uniform<Matrix4>>;
  cameraWorldMatrixInverse: ReturnType<typeof uniform<Matrix4>>;
  cameraProjectionMatrixInverse: ReturnType<typeof uniform<Matrix4>>;
};

// ---- React Context ----
const CameraUniformsContext = createContext<CameraUniformsType | null>(null);

type CameraUniformsProviderProps = React.PropsWithChildren<{
  camera?: PerspectiveCamera;
}>;

// ---- Provider ----
export const CameraUniformsProvider = ({ camera: cam, children }: CameraUniformsProviderProps) => {
  const { camera: defaultCamera } = useThree();
  const camera = cam ?? defaultCamera as PerspectiveCamera;

  const uniforms = useMemo<CameraUniformsType>(() => ({
    cameraNearFar: uniform(new Vector2()),
    cameraWorldMatrix: uniform(new Matrix4()),
    cameraWorldMatrixInverse: uniform(new Matrix4()),
    cameraProjectionMatrixInverse: uniform(new Matrix4()),
  }), []);

  // Update every frame
  useFrame(() => {
    uniforms.cameraNearFar.value.set(camera.near, camera.far);
    uniforms.cameraWorldMatrix.value.copy(camera.matrixWorld);
    uniforms.cameraWorldMatrixInverse.value.copy(camera.matrixWorldInverse);
    uniforms.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
  });

  return (
    <CameraUniformsContext.Provider value={uniforms}>
      {children}
    </CameraUniformsContext.Provider>
  );
};

// ---- Hook to consume ----
export const useCameraUniforms = (): CameraUniformsType => {
  const context = useContext(CameraUniformsContext);
  if (!context) throw new Error('useCameraUniforms must be used within a CameraUniformsProvider');
  return context;
};