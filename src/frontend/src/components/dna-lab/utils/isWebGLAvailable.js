export function isWebGLAvailable() {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return !!(window.WebGLRenderingContext && gl);
  } catch (e) {
    return false;
  }
}
