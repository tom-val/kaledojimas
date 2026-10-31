import type { House } from '@/utils/api';
import type { LatLng } from '@/utils/geo';

export type Placement = {
  /** Where the device is — the pin must stay within `radius` of it. */
  anchor: LatLng;
  pin: LatLng;
  radius: number;
  onPinChange: (pin: LatLng) => void;
};

export type HouseMapProps = {
  /** The map animates here whenever this object changes. */
  focus: LatLng;
  houses: House[];
  myHouseId?: string;
  userLocation: LatLng | null;
  placement: Placement | null;
  onCenterChange: (center: LatLng) => void;
};
