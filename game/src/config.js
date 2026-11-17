// SOLMAR STREETS — world constants and the city plan.
// Solmar is a small sun-soaked coastal city, about 520 metres across: a harbour on the
// west, a downtown grid in the middle, a beach promenade on the east and a lighthouse on
// the north-east point. Roads run on a regular grid so traffic, the minimap and the
// missions can all share the same street names and coordinates.

export const WORLD = {
  /** Half the side of the playable square, in metres. */
  half: 260,
  /** Road centre-lines, both directions. */
  roadLines: [-160, -80, 0, 80, 160],
  /** Width of every road, in metres. */
  roadWidth: 12,
  /** Where the sand starts (east) and the harbour water starts (west). */
  beachX: 216,
  harbourX: -244,
};

export const DISTRICTS = {
  harbour: { x0: -244, z0: -170, x1: -172, z1: 170, label: 'Pelabuhan' },
  downtown: { x0: -170, z0: -170, x1: 170, z1: 170, label: 'Pusat Kota' },
  promenade: { x0: 196, z0: -180, x1: 216, z1: 180, label: 'Promenade' },
  beach: { x0: 216, z0: -240, x1: 260, z1: 240, label: 'Pantai' },
  lighthouse: { x0: 196, z0: -240, x1: 260, z1: -180, label: 'Mercusuar' },
};

/** Named places the missions and the HUD refer to. */
export const PLACES = {
  garage: { x: 30, z: 116, label: 'Bengkel Keluarga' },
  garageDrive: { x: 30, z: 134, label: 'Halaman Bengkel' },
  promenadeContact: { x: 206, z: -40, label: 'Kontak Promenade' },
  harbourPier: { x: -218, z: 60, label: 'Dermaga Pelabuhan' },
  warehouse: { x: -192, z: -64, label: 'Gudang Pelabuhan' },
  downtownLot: { x: 86, z: -112, label: 'Parkir Pusat Kota' },
  witnessSpot: { x: 96, z: 44, label: 'Titik Temu Saksi' },
  checkpointNorth: { x: 0, z: -160, label: 'Perempatan Utara' },
  lighthouse: { x: 224, z: -212, label: 'Mercusuar' },
};

export const COLOURS = {
  sky: 0x8ec9e8,
  fog: 0xa8d0e6,
  sun: 0xfff2d0,
  ground: 0x9aa08e,
  asphalt: 0x3a3d42,
  sidewalk: 0xb9b3a4,
  sand: 0xe8d49a,
  sea: 0x2e7fa8,
  seaDeep: 0x1d5f86,
  building: [0xd8c9b0, 0xc9b8a4, 0xb7a88f, 0xd0c0a8, 0xc2b49a, 0xe0d3bc],
  glass: 0x7fb4d8,
  grass: 0x7da05c,
};

export const PLAYER = {
  walkSpeed: 6,
  sprintSpeed: 9.5,
  radius: 0.55,
  maxHp: 100,
};

export const CAR = {
  accel: 15,
  brake: 34,
  reverseMax: 11,
  maxSpeed: 34,
  steerMax: 0.55,
  radius: 1.5,
};

export const WEAPON = {
  name: 'Pistol',
  damage: 34,
  magSize: 12,
  reloadSeconds: 1.3,
  fireInterval: 0.22,
  range: 90,
};

/** Wanted level thresholds: crimes add stars, hiding and time take them away. */
export const WANTED = {
  steal: 1,
  assault: 1,
  copDown: 1,
  max: 5,
  decaySeconds: 12,
  hideSeconds: 9,
};

/** Cash rewards and starting money. */
export const ECONOMY = {
  startCash: 250,
  missionReward: [400, 700, 900, 1200, 2000],
};
