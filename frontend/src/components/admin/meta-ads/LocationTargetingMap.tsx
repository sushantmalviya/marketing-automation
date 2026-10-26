"use client";

import { useEffect, useState, useMemo } from "react";
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

// Fix Leaflet's default marker icon paths (broken by webpack/next-packager)
if (typeof window !== "undefined" && typeof L !== "undefined" && L?.icon && L?.Marker?.prototype?.options) {
  try {
    const defaultIcon = L.icon({
      iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
      iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });
    L.Marker.prototype.options.icon = defaultIcon;
  } catch {
    // Ignore in SSR/prerender environments
  }
}

// Meta Ads Manager teardrop red pin
const createMetaPinIcon = () => {
  if (typeof window === "undefined" || !L?.divIcon) return undefined;
  return L.divIcon({
    className: "meta-map-pin-wrapper",
    html: `<div style="position: relative; width: 26px; height: 32px; display: flex; align-items: center; justify-content: center;">
      <svg width="26" height="32" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
        <path d="M12 0C5.37258 0 0 5.37258 0 12C0 19.5 12 30 12 30C12 30 24 19.5 24 12C24 5.37258 18.6274 0 12 0Z" fill="#DC2626"/>
        <circle cx="12" cy="11" r="4.5" fill="white"/>
      </svg>
    </div>`,
    iconSize: [26, 32],
    iconAnchor: [13, 30],
    popupAnchor: [0, -28],
  });
};

export interface MapLocationPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

interface LocationTargetingMapProps {
  lat: number;
  lng: number;
  radiusKm?: number;
  locations?: MapLocationPin[];
  onLocationChange?: (lat: number, lng: number) => void;
  onAddLocation?: (lat: number, lng: number) => void;
  heightClass?: string;
  hideSearchBar?: boolean;
}

// Controller component to pan/center the map when coordinates change
function MapCenterController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

function MapEvents({ onLocationChange }: { onLocationChange?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onLocationChange) {
        onLocationChange(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

export default function LocationTargetingMap({
  lat,
  lng,
  radiusKm = 40,
  locations,
  onLocationChange,
  onAddLocation,
  heightClass = "h-64",
  hideSearchBar = false,
}: LocationTargetingMapProps) {
  const center: [number, number] = [lat, lng];
  const [map, setMap] = useState<L.Map | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const pinIcon = useMemo(() => createMetaPinIcon(), []);

  // Fix map rendering issues in modals/wizards
  useEffect(() => {
    if (map) {
      const timeout = setTimeout(() => {
        map.invalidateSize();
      }, 250);
      return () => clearTimeout(timeout);
    }
  }, [map]);

  // If locations array changes and has items, fit map bounds or center on latest
  useEffect(() => {
    if (map && locations && locations.length > 0) {
      if (locations.length === 1) {
        map.setView([locations[0].lat, locations[0].lng], map.getZoom() || 8, { animate: true });
      } else {
        const bounds = L.latLngBounds(locations.map((loc) => [loc.lat, loc.lng]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      }
    }
  }, [locations, map]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const { latitude, longitude } = position.coords;
        if (onLocationChange) {
          onLocationChange(latitude, longitude);
        }
        if (onAddLocation) {
          onAddLocation(latitude, longitude);
        }
        if (map) {
          map.flyTo([latitude, longitude], 12, { animate: true });
        }
      },
      (error) => {
        setIsLocating(false);
        toast.error("Failed to fetch location. Please check your permissions.");
        console.error("Error getting location:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();

      if (data && data.length > 0) {
        const { lat: newLat, lon: newLng, display_name } = data[0];
        const parsedLat = parseFloat(newLat);
        const parsedLng = parseFloat(newLng);
        
        if (onLocationChange) {
          onLocationChange(parsedLat, parsedLng);
        }
        if (onAddLocation) {
          onAddLocation(parsedLat, parsedLng);
        }
        if (map) {
          map.flyTo([parsedLat, parsedLng], 11, { animate: true });
        }
        setSearchQuery("");
      } else {
        toast.error("Location not found");
      }
    } catch {
      toast.error("Failed to search location");
    } finally {
      setIsSearching(false);
    }
  };

  const handleMapClick = (clickLat: number, clickLng: number) => {
    if (onAddLocation) {
      onAddLocation(clickLat, clickLng);
    } else if (onLocationChange) {
      onLocationChange(clickLat, clickLng);
    }
  };

  return (
    <div className={`relative ${heightClass} w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50 group`}>
      {/* Search Bar Overlay */}
      {!hideSearchBar && (
        <div className="absolute top-3 left-3 right-16 z-[400]">
          <form 
            onSubmit={handleSearch}
            className="flex items-center bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden"
          >
            <input
              type="text"
              placeholder="Search for a location or click on the map..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 text-sm outline-none placeholder:text-slate-400"
            />
            <button 
              type="submit" 
              disabled={isSearching}
              className="px-3 py-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 border-l border-slate-200 transition-colors"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </form>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={6}
        scrollWheelZoom={true}
        wheelPxPerZoomLevel={300}
        zoomDelta={0.5}
        zoomSnap={0.5}
        ref={setMap}
        style={{ height: "100%", width: "100%" }}
        className="z-10"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* If single radius circle */}
        {radiusKm > 0 && (!locations || locations.length <= 1) && (
          <Circle
            center={center}
            radius={radiusKm * 1000}
            pathOptions={{
              fillColor: "#3b82f6",
              fillOpacity: 0.25,
              color: "#2563eb",
              weight: 1.5,
            }}
          />
        )}

        {/* Multiple Pins (Panels 8) */}
        {locations && pinIcon && locations.map((loc) => (
          <Marker
            key={loc.id || `${loc.lat}-${loc.lng}`}
            position={[loc.lat, loc.lng]}
            icon={pinIcon}
          >
            <Popup>
              <div className="text-xs font-semibold p-1">
                <p className="font-bold text-slate-900">{loc.name}</p>
                <p className="text-[10px] text-slate-500">
                  Lat: {loc.lat.toFixed(4)}, Lng: {loc.lng.toFixed(4)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        <MapCenterController center={center} />
        <MapEvents onLocationChange={handleMapClick} />
      </MapContainer>

      <button
        type="button"
        onClick={handleLocateMe}
        disabled={isLocating}
        className="absolute bottom-4 right-4 z-[400] flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-70"
        aria-label="Locate Me"
        title="Locate Me"
      >
        {isLocating ? (
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        ) : (
          <LocateFixed className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}
