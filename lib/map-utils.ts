/**
 * Map Utilities
 *
 * Generates self-contained HTML for Mapbox GL JS map embeds.
 * Used by LayerRenderer (canvas/published) and page-fetcher (static HTML export).
 */

import type { ColorVariable, MapSettings, MapStyle } from '@/types';

const MAPBOX_GL_VERSION = 'v3.20.0';
const MAPBOX_CDN_BASE = `https://cdn.jsdelivr.net/npm/mapbox-gl@${MAPBOX_GL_VERSION}/dist`;

const STYLE_URLS: Record<MapStyle, string> = {
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
};

export const MAP_STYLE_OPTIONS: { value: MapStyle; label: string }[] = [
  { value: 'streets', label: 'Streets' },
  { value: 'satellite', label: 'Satellite' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'outdoors', label: 'Outdoors' },
];

export const DEFAULT_MAP_SETTINGS: MapSettings = {
  latitude: 40.712749,
  longitude: -74.005994,
  zoom: 12,
  style: 'streets',
  markerColor: '#2e79d6',
  interactive: true,
  scrollZoom: true,
  showNavControl: false,
  showScaleBar: false,
  search: 'New York',
};

/** Resolve a map style shorthand to a Mapbox style URL */
export function getMapboxStyleUrl(style: MapStyle): string {
  return STYLE_URLS[style] || STYLE_URLS.streets;
}

/** Resolve a marker color value, looking up color variables when referenced */
export function resolveMarkerColor(
  markerColor: string | null,
  colorVariables: ColorVariable[],
): string | null {
  if (!markerColor) return null;
  const match = markerColor.match(/^color:var\(--([^)]+)\)$/);
  if (match) {
    const variable = colorVariables.find((v) => v.id === match[1]);
    return variable?.value || null;
  }
  return markerColor;
}

/**
 * Build a self-contained HTML document that renders a Mapbox GL JS map.
 * Loaded via iframe srcdoc in both the editor and published/exported pages.
 */
export function buildMapEmbedHtml(
  settings: MapSettings,
  accessToken: string
): string {
  const styleUrl = getMapboxStyleUrl(settings.style);
  const {
    latitude, longitude, zoom, markerColor, interactive,
    scrollZoom, showNavControl, showScaleBar,
  } = settings;

  const disableHandlers: string[] = [];
  if (!interactive) {
    disableHandlers.push(
      'map.dragPan.disable();',
      'map.boxZoom.disable();',
      'map.doubleClickZoom.disable();',
      'map.touchZoomRotate.disable();',
      'map.keyboard.disable();',
    );
  }
  if (!interactive || !scrollZoom) {
    disableHandlers.push('map.scrollZoom.disable();');
  }

  const controls: string[] = [];
  if (showNavControl) controls.push('map.addControl(new mapboxgl.NavigationControl());');
  if (showScaleBar) controls.push('map.addControl(new mapboxgl.ScaleControl());');

  const markerScript = markerColor
    ? `new mapboxgl.Marker({color:'${markerColor.replace(/'/g, "\\'")}'}).setLngLat([${longitude}, ${latitude}]).addTo(map);`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link href="${MAPBOX_CDN_BASE}/mapbox-gl.css" rel="stylesheet">
<script src="${MAPBOX_CDN_BASE}/mapbox-gl.js"><${'/'}script>
<style>
  *{margin:0;padding:0}
  html,body,#map{width:100%;height:100%}
</style>
</head>
<body>
<div id="map"></div>
<script>
  mapboxgl.accessToken='${accessToken.replace(/'/g, "\\'")}';
  var map=new mapboxgl.Map({
    container:'map',
    style:'${styleUrl}',
    center:[${longitude},${latitude}],
    zoom:${zoom},
    attributionControl:true
  });
  ${disableHandlers.join('\n  ')}
  ${controls.join('\n  ')}
  ${markerScript}
<${'/'}script>
</body>
</html>`;
}
