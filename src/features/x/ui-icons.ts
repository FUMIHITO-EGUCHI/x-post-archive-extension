const paths = {
  archive: "M12 3v11 M7 10l5 5 5-5 M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  spinner: "M12 3a9 9 0 1 1-9 9",
  check: "M5 12.5l4.5 4.5L19 7",
  alert: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18Z M12 7.5v5.5 M12 16.5h.01",
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
