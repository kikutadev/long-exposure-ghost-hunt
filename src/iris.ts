export class ShutterIris {
  private readonly overlay: HTMLElement;
  private readonly bladeElements: SVGPathElement[];

  constructor(overlay: HTMLElement, bladeContainer: Element) {
    this.overlay = overlay;
    this.bladeElements = Array.from({ length: 6 }, (_, i) => {
      const blade = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      blade.setAttribute('fill', 'url(#blade-metal)');
      blade.setAttribute('stroke', '#5f6970');
      blade.setAttribute('stroke-width', '1.2');
      blade.setAttribute('data-blade', String(i));
      bladeContainer.appendChild(blade);
      return blade;
    });
  }

  draw(open: number) {
    const aperture = Math.max(0, Math.min(1, open));
    this.overlay.classList.toggle('active', aperture < .999);
    const inner = Math.pow(aperture, .72) * 670;
    const at = (r: number, angle: number) =>
      `${(200 + Math.cos(angle) * r).toFixed(2)} ${(350 + Math.sin(angle) * r).toFixed(2)}`;

    this.bladeElements.forEach((blade, i) => {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const b = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
      const offset = (1 - aperture) * .08;
      blade.setAttribute('d',
        `M ${at(inner, a + offset)} L ${at(1300, a)} L ${at(1300, b)} L ${at(inner, b + offset)} Q ${at(inner * .95, (a + b) / 2)} ${at(inner, a + offset)} Z`);
    });
  }
}
