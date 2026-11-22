const paths = {
  archive: "M4 13v6h16v-6 M4 13h5l1 2h4l1-2h5 M12 3v8 M9 8l3 3 3-3",
  spinner: "M12 3a9 9 0 1 0 9 9",
  check: "M5 12l5 5L20 6",
  alert: "M12 3 2 20h20L12 3Z M12 9v4 M12 17h.01",
  pause: "M9 5v14 M15 5v14"
};

export function createUiIcon(name: keyof typeof paths): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "20");
  svg.setAttribute("height", "20");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", paths[name]);
  svg.append(path);
  return svg;
}
