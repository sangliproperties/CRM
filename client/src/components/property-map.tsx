import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';

interface PropertyMapProps {
  latitude: string | null;
  longitude: string | null;
  title: string;
}

export function PropertyMap({ latitude, longitude, title }: PropertyMapProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="w-full h-[300px] bg-muted rounded-md flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Google Maps API key not configured
        </p>
      </div>
    );
  }

  if (!latitude || !longitude) {
    return (
      <div className="w-full h-[300px] bg-muted rounded-md flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Location coordinates not available
        </p>
      </div>
    );
  }

  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);

  if (isNaN(lat) || isNaN(lng)) {
    return (
      <div className="w-full h-[300px] bg-muted rounded-md flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Invalid location coordinates
        </p>
      </div>
    );
  }

  const position = { lat, lng };

  return (
    <div className="w-full h-[300px] rounded-md overflow-hidden border">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={position}
          defaultZoom={15}
          mapId="property-map"
        >
          <Marker position={position} title={title} />
        </Map>
      </APIProvider>
    </div>
  );
}
