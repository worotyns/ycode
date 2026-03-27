'use client';

/**
 * Map Settings Component
 *
 * Settings panel for map layers (Mapbox-powered).
 * Controls coordinates, zoom, style, marker visibility, and interactivity.
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import ColorPicker from './ColorPicker';
import SettingsPanel from './SettingsPanel';

import { useSettingsStore } from '@/stores/useSettingsStore';
import { MAP_STYLE_OPTIONS, DEFAULT_MAP_SETTINGS } from '@/lib/map-utils';
import { useDebounce } from '@/hooks/use-debounce';
import type { Layer, MapSettings as MapSettingsType, MapStyle } from '@/types';

type SearchResult = { place_name: string; center: [number, number] };

const ZOOM_MIN = 1;
const ZOOM_MAX = 22;
const ZOOM_STEP = 0.1;

interface MapSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

export default function MapSettings({ layer, onLayerUpdate }: MapSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const mapSettings = useMemo(
    () => ({ ...DEFAULT_MAP_SETTINGS, ...layer?.settings?.map }),
    [layer?.settings?.map]
  );
  const hasToken = !!useSettingsStore((s) => s.getSettingByKey('mapbox_access_token'));

  // Local input state for lat/lng/zoom to allow free typing
  const [latInput, setLatInput] = useState(String(mapSettings.latitude));
  const [lngInput, setLngInput] = useState(String(mapSettings.longitude));
  const [zoomInput, setZoomInput] = useState(String(mapSettings.zoom));

  const [addressQuery, setAddressQuery] = useState(mapSettings.search || '');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddressFocused, setIsAddressFocused] = useState(false);
  const debouncedQuery = useDebounce(addressQuery, 400);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Sync local inputs when layer selection changes
  useEffect(() => {
    setLatInput(String(mapSettings.latitude));
    setLngInput(String(mapSettings.longitude));
    setZoomInput(String(mapSettings.zoom));
    setAddressQuery(mapSettings.search || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer?.id]);

  const updateMapSettings = useCallback(
    (updates: Partial<MapSettingsType>) => {
      if (!layer) return;

      onLayerUpdate(layer.id, {
        settings: {
          ...layer.settings,
          map: {
            ...mapSettings,
            ...updates,
          },
        },
      });
    },
    [layer, mapSettings, onLayerUpdate]
  );

  const debouncedUpdateRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const debouncedUpdateMapSettings = useCallback(
    (updates: Partial<MapSettingsType>) => {
      clearTimeout(debouncedUpdateRef.current);
      debouncedUpdateRef.current = setTimeout(() => updateMapSettings(updates), 300);
    },
    [updateMapSettings]
  );
  useEffect(() => () => clearTimeout(debouncedUpdateRef.current), []);

  const handleLatChange = useCallback(
    (value: string) => {
      setLatInput(value);
      const num = parseFloat(value);
      if (!isNaN(num) && num >= -90 && num <= 90) {
        debouncedUpdateMapSettings({ latitude: num });
      }
    },
    [debouncedUpdateMapSettings]
  );

  const handleLngChange = useCallback(
    (value: string) => {
      setLngInput(value);
      const num = parseFloat(value);
      if (!isNaN(num) && num >= -180 && num <= 180) {
        debouncedUpdateMapSettings({ longitude: num });
      }
    },
    [debouncedUpdateMapSettings]
  );

  const handleZoomChange = useCallback(
    (value: string) => {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, num));
        setZoomInput(String(clamped));
        debouncedUpdateMapSettings({ zoom: clamped });
      }
    },
    [debouncedUpdateMapSettings]
  );

  const handleSliderZoomChange = useCallback(
    (values: number[]) => {
      const zoom = values[0];
      setZoomInput(String(zoom));
      debouncedUpdateMapSettings({ zoom });
    },
    [debouncedUpdateMapSettings]
  );

  // Geocoding search via API route
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 3) {
      setSearchResults([]);
      return;
    }

    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setIsSearching(true);
    fetch(`/ycode/api/maps/geocode?q=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setSearchResults(json.data);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setSearchResults([]);
        }
      })
      .finally(() => setIsSearching(false));
  }, [debouncedQuery]);

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      const [lng, lat] = result.center;
      setLatInput(String(lat));
      setLngInput(String(lng));
      setAddressQuery(result.place_name);
      setSearchResults([]);
      updateMapSettings({ latitude: lat, longitude: lng, search: result.place_name });
    },
    [updateMapSettings]
  );

  if (!layer || layer.name !== 'map') {
    return null;
  }

  return (
    <SettingsPanel
      title="Map"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
      action={
        <Button
          asChild
          size="xs"
          variant={hasToken ? 'secondary' : 'destructive'}
        >
          <Link href="/ycode/integrations/apps?app=mapbox">
            Config
          </Link>
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        {/* Address search */}
        <Popover open={isAddressFocused && searchResults.length > 0}>
          <div className="grid grid-cols-3 items-start">
            <Label variant="muted" className="pt-2">Address</Label>
            <div className="col-span-2 relative">
              <PopoverAnchor asChild>
                <Input
                  value={addressQuery}
                  onChange={(e) => setAddressQuery(e.target.value)}
                  onFocus={() => setIsAddressFocused(true)}
                  onBlur={() => setTimeout(() => setIsAddressFocused(false), 150)}
                  placeholder="Search for an address..."
                />
              </PopoverAnchor>
              {isSearching && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  ...
                </div>
              )}
            </div>
          </div>
          <PopoverContent
            align="end"
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="w-auto max-w-none max-h-48 overflow-y-auto p-1 border-transparent"
          >
            {searchResults.map((result, i) => (
              <button
                key={i}
                className="flex w-full cursor-pointer items-center rounded-sm py-1.5 px-2 text-xs text-muted-foreground outline-hidden hover:bg-accent hover:text-accent-foreground truncate"
                onClick={() => handleSelectResult(result)}
              >
                {result.place_name}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Coordinates */}
        <div className="grid grid-cols-3 items-center">
          <div className="flex items-center gap-1.5">
            <Label variant="muted">Coord.</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Icon name="info" className="size-3 opacity-70" />
              </TooltipTrigger>
              <TooltipContent>Latitude / Longitude</TooltipContent>
            </Tooltip>
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-2">
            <Input
              value={latInput}
              onChange={(e) => handleLatChange(e.target.value)}
              placeholder="40.7128"
            />
            <Input
              value={lngInput}
              onChange={(e) => handleLngChange(e.target.value)}
              placeholder="-74.0060"
            />
          </div>
        </div>

        {/* Zoom */}
        <div className="grid grid-cols-3 items-center">
          <Label variant="muted">Zoom</Label>
          <div className="col-span-2 flex items-center gap-2">
            <Slider
              value={[parseFloat(zoomInput) || mapSettings.zoom]}
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={ZOOM_STEP}
              onValueChange={handleSliderZoomChange}
              className="flex-1 min-w-0"
            />
            <div className="w-14 shrink-0">
              <Input
                stepper
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={ZOOM_STEP}
                value={zoomInput}
                onChange={(e) => handleZoomChange(e.target.value)}
                className="pr-5!"
              />
            </div>
          </div>
        </div>

        {/* Style */}
        <div className="grid grid-cols-3 items-center">
          <Label variant="muted">Style</Label>
          <div className="col-span-2">
            <Select
              value={mapSettings.style}
              onValueChange={(value: MapStyle) =>
                updateMapSettings({ style: value })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MAP_STYLE_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Marker */}
        <div className="grid grid-cols-3 items-center gap-2">
          <Label variant="muted">Marker</Label>
          <div className="col-span-2 [&>div]:w-full [&>button]:w-full">
            <ColorPicker
              value={mapSettings.markerColor || ''}
              onChange={(value) => updateMapSettings({ markerColor: value || null })}
              onClear={() => updateMapSettings({ markerColor: null })}
              defaultValue="#2e79d6"
              placeholder="No marker"
              solidOnly
            />
          </div>
        </div>

        {/* Behavior */}
        <div className="grid grid-cols-3 items-start gap-2">
          <Label variant="muted">Behavior</Label>
          <div className="col-span-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="map-interactive"
                checked={mapSettings.interactive}
                onCheckedChange={(checked: boolean) =>
                  updateMapSettings({ interactive: checked })
                }
              />
              <Label
                variant="muted"
                htmlFor="map-interactive"
                className="cursor-pointer"
              >
                Interactive
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="map-scroll-zoom"
                checked={mapSettings.scrollZoom}
                disabled={!mapSettings.interactive}
                onCheckedChange={(checked: boolean) =>
                  updateMapSettings({ scrollZoom: checked })
                }
              />
              <Label
                variant="muted"
                htmlFor="map-scroll-zoom"
                className="cursor-pointer"
              >
                Zoom with scroll
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="map-nav-control"
                checked={mapSettings.showNavControl}
                onCheckedChange={(checked: boolean) =>
                  updateMapSettings({ showNavControl: checked })
                }
              />
              <Label
                variant="muted"
                htmlFor="map-nav-control"
                className="cursor-pointer"
              >
                Navigation control
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="map-scale-bar"
                checked={mapSettings.showScaleBar}
                onCheckedChange={(checked: boolean) =>
                  updateMapSettings({ showScaleBar: checked })
                }
              />
              <Label
                variant="muted"
                htmlFor="map-scale-bar"
                className="cursor-pointer"
              >
                Scale bar
              </Label>
            </div>
          </div>
        </div>
      </div>
    </SettingsPanel>
  );
}
