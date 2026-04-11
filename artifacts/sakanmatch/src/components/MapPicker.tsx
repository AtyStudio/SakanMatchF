import { useEffect, useRef, useState, useCallback } from "react";
import { Search, Loader2, MapPin } from "lucide-react";

import "leaflet/dist/leaflet.css";
import L from "leaflet";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

export interface LocationResult {
  lat: number;
  lng: number;
  address: string;
}

interface MapPickerProps {
  value?: LocationResult | null;
  onChange: (result: LocationResult | null) => void;
  defaultCity?: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

export function MapPicker({ value, onChange, defaultCity }: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState(value?.address || defaultCity || "");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const DEFAULT_CENTER: [number, number] = [33.9716, -6.8498];
  const DEFAULT_ZOOM = 6;
  const PIN_ZOOM = 15;

  const setPin = useCallback(
    (lat: number, lng: number, address: string) => {
      if (!mapRef.current) return;
      if (!markerRef.current) {
        markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current!.getLatLng();
          onChange({ lat: pos.lat, lng: pos.lng, address });
        });
      } else {
        markerRef.current.setLatLng([lat, lng]);
        markerRef.current.off("dragend");
        markerRef.current.on("dragend", () => {
          const pos = markerRef.current!.getLatLng();
          onChange({ lat: pos.lat, lng: pos.lng, address });
        });
      }
      mapRef.current.setView([lat, lng], PIN_ZOOM);
      onChange({ lat, lng, address });
    },
    [onChange],
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: value ? [value.lat, value.lng] : DEFAULT_CENTER,
      zoom: value ? PIN_ZOOM : DEFAULT_ZOOM,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const addr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setPin(lat, lng, addr);
      setSearchQuery(addr);
    });

    mapRef.current = map;

    if (value) {
      markerRef.current = L.marker([value.lat, value.lng], { draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current!.getLatLng();
        onChange({ lat: pos.lat, lng: pos.lng, address: value.address });
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    setSearchError("");
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=ma`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (!res.ok) throw new Error("Search failed");
      const data: NominatimResult[] = await res.json();
      if (data.length === 0) {
        setSearchError("No results found. Try a different search.");
        return;
      }
      const { lat, lon, display_name } = data[0];
      setPin(parseFloat(lat), parseFloat(lon), display_name);
      setSearchQuery(display_name);
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, setPin]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleClear = () => {
    if (markerRef.current && mapRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    onChange(null);
    setSearchQuery("");
    setSearchError("");
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search address or area..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching || !searchQuery.trim()}
          className="px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
        </button>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-3 rounded-xl border-2 border-border text-muted-foreground hover:border-destructive/40 hover:text-destructive transition-all text-sm"
          >
            Clear
          </button>
        )}
      </div>

      {searchError && (
        <p className="text-xs text-destructive">{searchError}</p>
      )}

      <div
        ref={mapContainerRef}
        className="w-full h-64 sm:h-80 rounded-2xl overflow-hidden border-2 border-border"
        style={{ zIndex: 0 }}
      />

      {value ? (
        <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-primary mb-0.5">Pin dropped</p>
            <p className="text-xs text-muted-foreground truncate">{value.address}</p>
            <p className="text-xs text-muted-foreground">
              {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center">
          Click on the map or search an address to drop a pin
        </p>
      )}
    </div>
  );
}
