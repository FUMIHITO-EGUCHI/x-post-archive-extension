import { ICON_PATHS } from "../ui/icon-paths";

const paths = {
  archive: ICON_PATHS.Archive,
  spinner: ICON_PATHS.Spinner,
  check: ICON_PATHS.Check,
  alert: ICON_PATHS.Alert,
  pause: ICON_PATHS.Pause
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
