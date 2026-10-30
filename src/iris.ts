export class ShutterIris {
  private readonly overlay: HTMLElement;
  private readonly bladeElements: SVGPathElement[];
  constructor(overlay: HTMLElement, bladeContainer: Element) {
    this.overlay = overlay;
    this.bladeElements = Array.from({ length: 6 }, (_, i) => {
      const blade = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      blade.setAttribute('fill', ['#20292e', '#303b41', '#192328', '#354047', '#242f35', '#3c474d'][i]);
      blade.setAttribute('stroke', '#879297');
      blade.setAttribute('stroke-width', '1.6');
      blade.setAttribute('data-blade', String(i));
      // A broad hooked plate rotates around its own outer pivot. At closure
      // the six leading edges overlap the centre; no circular masking disk.
      blade.setAttribute('d', 'M -8 -8 L 1100 -80 L 900 950 L 360 620 Q 160 200 -8 -8 Z');
      bladeContainer.appendChild(blade);
      return blade;
    });
  }
  draw(open: number) {
    const aperture = Math.max(0, Math.min(1, open));
    this.overlay.classList.toggle('active', aperture < .999);
    this.bladeElements.forEach((blade, i) => {
      blade.setAttribute('transform', `translate(200 350) rotate(${i * 60}) translate(${aperture * 720} 0) rotate(${aperture * 38} 360 0)`);
    });
  }
}
