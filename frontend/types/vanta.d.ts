declare module "vanta/dist/vanta.globe.min" {
  interface VantaGlobeOptions {
    el: HTMLElement;
    THREE?: unknown;
    mouseControls?: boolean;
    touchControls?: boolean;
    gyroControls?: boolean;
    minHeight?: number;
    minWidth?: number;
    scale?: number;
    scaleMobile?: number;
    color?: number;
    color2?: number;
    backgroundColor?: number;
    backgroundAlpha?: number;
    size?: number;
  }

  interface VantaEffect {
    destroy: () => void;
  }

  const GLOBE: (options: VantaGlobeOptions) => VantaEffect;
  export default GLOBE;
}
