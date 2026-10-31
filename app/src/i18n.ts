import { getLocales } from 'expo-localization';

const en = {
  appName: 'Knock Knock',
  nearby: (n: number) => (n === 0 ? 'No houses nearby yet' : n === 1 ? '1 house nearby' : `${n} houses nearby`),
  markHouse: 'Mark my house',
  placingTitle: 'Is this your house?',
  placingHint: 'Tap the map or drag the pumpkin to adjust. It must be within 150 m of you.',
  notePlaceholder: 'Note for visitors (optional)',
  confirmPlace: 'Put me on the map',
  cancel: 'Cancel',
  liveTitle: 'Your house is on the map 🎃',
  liveUntil: (time: string) => `It disappears automatically at ${time}.`,
  endButton: 'Out of candy',
  endConfirmTitle: 'Out of candy?',
  endConfirmBody: 'Your house will be removed from the map.',
  endConfirm: 'Remove my house',
  yourHouse: 'Your house',
  candyHere: 'Candy here!',
  locationDenied: 'Allow location access to mark your house.',
  locationFailed: 'Could not get your location. Try again outside or near a window.',
  genericError: 'Something went wrong. Try again.',
  offline: 'Cannot reach the server.',
  recenter: 'Show my location',
};

type Strings = typeof en;

/** Lithuanian plural forms: 1 namas, 2–9 namai, 10–20 namų, 21 namas… */
function namai(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'namas';
  if (mod10 >= 2 && (mod100 < 11 || mod100 > 19)) return 'namai';
  return 'namų';
}

const lt: Strings = {
  appName: 'Tuk tuk',
  nearby: (n) => (n === 0 ? 'Šalia kol kas nėra namų' : `Šalia ${n} ${namai(n)}`),
  markHouse: 'Pažymėti mano namus',
  placingTitle: 'Ar čia jūsų namai?',
  placingHint: 'Bakstelėkite žemėlapį arba tempkite moliūgą. Turi būti ne toliau kaip 150 m nuo jūsų.',
  notePlaceholder: 'Žinutė lankytojams (nebūtina)',
  confirmPlace: 'Įtraukti į žemėlapį',
  cancel: 'Atšaukti',
  liveTitle: 'Jūsų namai žemėlapyje 🎃',
  liveUntil: (time) => `Automatiškai išnyks ${time}.`,
  endButton: 'Baigėsi saldainiai',
  endConfirmTitle: 'Baigėsi saldainiai?',
  endConfirmBody: 'Jūsų namai bus pašalinti iš žemėlapio.',
  endConfirm: 'Pašalinti',
  yourHouse: 'Jūsų namai',
  candyHere: 'Čia vaišina!',
  locationDenied: 'Leiskite naudoti vietą, kad galėtumėte pažymėti namus.',
  locationFailed: 'Nepavyko nustatyti vietos. Bandykite lauke arba prie lango.',
  genericError: 'Kažkas nepavyko. Bandykite dar kartą.',
  offline: 'Nepavyksta pasiekti serverio.',
  recenter: 'Rodyti mano vietą',
};

const languageCode = getLocales()[0]?.languageCode;

export const t: Strings = languageCode === 'lt' ? lt : en;
export const locale = languageCode === 'lt' ? 'lt-LT' : undefined;
