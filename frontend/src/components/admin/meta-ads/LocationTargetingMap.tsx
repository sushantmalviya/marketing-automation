"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

// Fix Leaflet's default marker icon paths (broken by webpack/next-packager)
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface LocationTargetingMapProps {
  lat: number;
  lng: number;
  radiusKm: number;
  onLocationChange?: (lat: number, lng: number) => void;
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

export default function LocationTargetingMap({ lat, lng, radiusKm, onLocationChange }: LocationTargetingMapProps) {
  const center: [number, number] = [lat, lng];
  const [map, setMap] = useState<L.Map | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Fix map rendering issues in modals/wizards
  useEffect(() => {
    if (map) {
      const timeout = setTimeout(() => {
        map.invalidateSize();
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [map]);

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
        if (map) {
          map.flyTo([latitude, longitude], 13, { animate: true });
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
        const { lat: newLat, lon: newLng } = data[0];
        const parsedLat = parseFloat(newLat);
        const parsedLng = parseFloat(newLng);
        
        if (onLocationChange) {
          onLocationChange(parsedLat, parsedLng);
        }
        if (map) {
          map.flyTo([parsedLat, parsedLng], 12, { animate: true });
        }
        setSearchQuery("");
      } else {
        toast.error("Location not found");
      }
    } catch (error) {
      toast.error("Failed to search location");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="relative h-64 w-full rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50 group">
      {/* Search Bar Overlay */}
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

      <MapContainer
        center={center}
        zoom={8}
        scrollWheelZoom={true}
        wheelPxPerZoomLevel={300} // Increase this value to make scroll zoom LESS sensitive (default is 60)
        zoomDelta={0.5} // Decreasing this makes each scroll/click zoom less distance
        zoomSnap={0.5} // Allows the map to rest at fractional zoom levels
        ref={setMap}
        style={{ height: "100%", width: "100%" }}
        className="z-10"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={center}
          radius={radiusKm * 1000} // Convert km to meters
          pathOptions={{
            fillColor: "#3b82f6",
            fillOpacity: 0.35,
            color: "#2563eb",
            weight: 1.5,
          }}
        />
        <MapCenterController center={center} />
        <MapEvents onLocationChange={onLocationChange} />
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
