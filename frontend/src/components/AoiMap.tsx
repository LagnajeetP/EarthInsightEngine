"use client";
import { useEffect } from "react";
import type { Aoi } from "@/lib/api";

interface Props {
  aois: Aoi[];
  selectedId?: number;
  onSelect?: (id: number) => void;
}

// Dynamically load Leaflet only on the client
export default function AoiMap({ aois, selectedId, onSelect }: Props) {
  useEffect(() => {
    // Leaflet modifies the DOM directly, so we initialise it inside useEffect
    let map: import("leaflet").Map | null = null;

    (async () => {
      const L = (await import("leaflet")).default;

      // Fix default marker icon paths broken by webpack
      // @ts-expect-error _getIconUrl is not in types
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const container = document.getElementById("aoi-map");
      if (!container) return;
      // Prevent double-init in strict mode
      if ((container as HTMLElement & { _leaflet_id?: string })._leaflet_id) return;

      map = L.map("aoi-map", { zoomControl: true }).setView([20, 0], 2);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO",
        maxZoom: 19,
      }).addTo(map);

      aois.forEach((aoi) => {
        const bounds: [[number, number], [number, number]] = [
          [aoi.bbox_min_lat, aoi.bbox_min_lon],
          [aoi.bbox_max_lat, aoi.bbox_max_lon],
        ];
        const rect = L.rectangle(bounds, {
          color: selectedId === aoi.id ? "#7eb8ff" : "#3b82f6",
          weight: selectedId === aoi.id ? 2 : 1,
          fillOpacity: selectedId === aoi.id ? 0.25 : 0.1,
        }).addTo(map!);
        rect.bindTooltip(aoi.name, { permanent: false });
        rect.on("click", () => onSelect?.(aoi.id));
      });

      if (aois.length > 0) {
        const allBounds = L.latLngBounds(
          aois.map((a) => [
            [a.bbox_min_lat, a.bbox_min_lon],
            [a.bbox_max_lat, a.bbox_max_lon],
          ] as [[number, number], [number, number]])
            .flat()
        );
        map.fitBounds(allBounds, { padding: [40, 40] });
      }
    })();

    return () => {
      map?.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div
        id="aoi-map"
        style={{ width: "100%", height: "100%", borderRadius: 8, background: "#0c1a2e" }}
      />
    </>
  );
}
