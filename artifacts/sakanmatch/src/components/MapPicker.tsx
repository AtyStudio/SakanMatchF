import { useState, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
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

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

interface ClickHandlerProps {
  onMapClick: (lat: number, lng: number) => void;
}

function ClickHandler({ onMapClick }: ClickHandlerProps) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface FlyToProps {
  lat: number;
  lng: number;
  zoom: number;
}

function FlyTo({ lat, lng, zoom }: FlyToProps) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom, { duration: 0.8 });
  }, [lat, lng, zoom, map]);
  return null;
}

interface MapPickerProps {
  value?: LocationResult | null;
  onChange: (result: LocationResult | null) => void;
  defaultCity?: string;
}

const DEFAULT_CENTER: [number, number] = [33.9716, -6.8498];
const DEFAULT_ZOOM = 6;
const PIN_ZOOM = 15;

export function MapPicker({ value, onChange, defaultCity }: MapPickerProps) {
  const [searchQuery, setSearchQuery] = useState(value?.address || defaultCity || "");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom: number } | null>(
    value ? { lat: value.lat, lng: value.lng, zoom: PIN_ZOOM } : null,
  );

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      const addr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      onChange({ lat, lng, address: addr });
      setSearchQuery(addr);
    },
    [onChange],
  );

  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    setSearchError("");
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (!res.ok) throw new Error("Search failed");
      const data: NominatimResult[] = await res.json();
      if (data.length === 0) {
        setSearchError("No results found. Try a different search.");
        return;
      }
      const { lat, lon, display_name } = data[0];
      const result: LocationResult = { lat: parseFloat(lat), lng: parseFloat(lon), address: display_name };
      onChange(result);
      setSearchQuery(display_name);
      setFlyTarget({ lat: result.lat, lng: result.lng, zoom: PIN_ZOOM });
    } catch {
      setSearchError("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleClear = () => {
    onChange(null);
    setSearchQuery("");
    setSearchError("");
    setFlyTarget(null);
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
        {value != null && (
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

      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: "300px", width: "100%", borderRadius: "1rem", zIndex: 0 }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <ClickHandler onMapClick={handleMapClick} />
        {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} zoom={flyTarget.zoom} />}
        {value != null && (
          <Marker
            position={[value.lat, value.lng]}
            draggable
            eventHandlers={{
              dragend(e) {
                const pos = (e.target as L.Marker).getLatLng();
                onChange({ lat: pos.lat, lng: pos.lng, address: value.address });
              },
            }}
          />
        )}
      </MapContainer>

      {value != null ? (
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
