const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const DEFAULT_COUNTRY_CODES = 'ph';

export function hasCoordinates(value) {
  const latitude = value?.latitude;
  const longitude = value?.longitude;
  return latitude !== null
    && latitude !== undefined
    && latitude !== ''
    && longitude !== null
    && longitude !== undefined
    && longitude !== ''
    && Number.isFinite(Number(latitude))
    && Number.isFinite(Number(longitude));
}

export function normalizeCoordinates(value) {
  if (!hasCoordinates(value)) {
    return null;
  }

  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }

  return { latitude, longitude };
}

export async function searchAddresses(query, { signal, limit = 5, countryCodes = DEFAULT_COUNTRY_CODES } = {}) {
  const search = String(query || '').trim();
  if (search.length < 3) {
    return [];
  }

  const params = new URLSearchParams({
    q: search,
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(Math.max(1, Math.min(Number(limit) || 5, 8))),
  });

  if (countryCodes) {
    params.set('countrycodes', countryCodes);
  }

  const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error('Address search failed.');
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item) => ({
      id: String(item.place_id || `${item.lat},${item.lon}`),
      label: item.display_name || '',
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      type: item.type || item.class || 'place',
    }))
    .filter((item) => item.label && Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
}
