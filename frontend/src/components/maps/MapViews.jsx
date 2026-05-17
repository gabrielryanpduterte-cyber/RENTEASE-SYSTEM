import { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Building2, MapPin } from 'lucide-react';
import { hasCoordinates, normalizeCoordinates } from '../../utils/nominatim.js';

const DEFAULT_CENTER = [8.5883, 123.3405];
const DEFAULT_ZOOM = 15;

const markerIcon = L.divIcon({
  className: 're-leaflet-pin',
  html: '<span></span>',
  iconSize: [28, 34],
  iconAnchor: [14, 32],
  popupAnchor: [0, -30],
});

function coordinatePair(value) {
  const coordinates = normalizeCoordinates(value);
  return coordinates ? [coordinates.latitude, coordinates.longitude] : null;
}

function MapRecenter({ center, zoom = DEFAULT_ZOOM }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, map, zoom]);

  return null;
}

function PickEvents({ onPick }) {
  useMapEvents({
    click(event) {
      onPick?.({
        latitude: Number(event.latlng.lat.toFixed(7)),
        longitude: Number(event.latlng.lng.toFixed(7)),
      });
    },
  });

  return null;
}

function BaseTiles() {
  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />
  );
}

export function LocationPicker({ latitude, longitude, onPick, disabled = false }) {
  const center = coordinatePair({ latitude, longitude }) || DEFAULT_CENTER;

  return (
    <div className="location-picker-map">
      <MapContainer center={center} zoom={DEFAULT_ZOOM} scrollWheelZoom={!disabled}>
        <BaseTiles />
        <MapRecenter center={center} />
        {!disabled && <PickEvents onPick={onPick} />}
        {hasCoordinates({ latitude, longitude }) ? (
          <Marker
            position={center}
            icon={markerIcon}
            draggable={!disabled}
            eventHandlers={{
              dragend(event) {
                const marker = event.target;
                const position = marker.getLatLng();
                onPick?.({
                  latitude: Number(position.lat.toFixed(7)),
                  longitude: Number(position.lng.toFixed(7)),
                });
              },
            }}
          />
        ) : (
          <Circle center={center} radius={250} pathOptions={{ color: '#2d6a4f', fillOpacity: 0.08 }} />
        )}
      </MapContainer>
    </div>
  );
}

export function PropertyMap({ property, className = '' }) {
  const position = coordinatePair(property);

  if (!position) {
    return (
      <div className={`property-map-empty ${className}`}>
        <MapPin size={20} />
        <span>Location pin not set.</span>
      </div>
    );
  }

  return (
    <div className={`property-map ${className}`}>
      <MapContainer center={position} zoom={DEFAULT_ZOOM} scrollWheelZoom={false}>
        <BaseTiles />
        <MapRecenter center={position} />
        <Marker position={position} icon={markerIcon}>
          <Popup>
            <strong>{property?.house_name || 'Property'}</strong>
            <span>{property?.location_label || property?.address || ''}</span>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

export function PropertiesMap({ properties = [], selectedId = null, onSelect }) {
  const markers = properties.filter((property) => hasCoordinates(property));
  const center = useMemo(() => {
    if (markers.length === 0) {
      return DEFAULT_CENTER;
    }

    const total = markers.reduce(
      (sum, item) => ({
        latitude: sum.latitude + Number(item.latitude),
        longitude: sum.longitude + Number(item.longitude),
      }),
      { latitude: 0, longitude: 0 },
    );

    return [total.latitude / markers.length, total.longitude / markers.length];
  }, [markers]);

  if (markers.length === 0) {
    return null;
  }

  return (
    <section className="properties-map-panel" aria-label="Property map">
      <div className="properties-map-copy">
        <Building2 size={20} />
        <div>
          <h2>Map View</h2>
          <p>{markers.length} property pin{markers.length === 1 ? '' : 's'} available</p>
        </div>
      </div>
      <div className="properties-map">
        <MapContainer center={center} zoom={13} scrollWheelZoom>
          <BaseTiles />
          <MapRecenter center={center} zoom={13} />
          {markers.map((property) => {
            const position = coordinatePair(property);
            return (
              <Marker
                key={property.boarding_house_id}
                position={position}
                icon={markerIcon}
                opacity={selectedId && selectedId !== property.boarding_house_id ? 0.68 : 1}
              >
                <Popup>
                  <strong>{property.house_name || 'Property'}</strong>
                  <span>{property.address || property.location_label || ''}</span>
                  {onSelect && (
                    <button type="button" onClick={() => onSelect(property)}>
                      View Rooms
                    </button>
                  )}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </section>
  );
}
