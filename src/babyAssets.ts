import * as THREE from 'three';

export type SkinPresetKey = 'warm' | 'rosy' | 'golden';
export type EyePresetKey = 'brown' | 'hazel' | 'blue';
export type HairPresetKey = 'dark-curls' | 'blonde-swoop' | 'chestnut-waves';

export interface SkinPreset {
  label: string;
  base: string;
  blush: string;
  crease: string;
  lip: string;
  sheen: string;
}

export interface EyePreset {
  label: string;
  outer: string;
  mid: string;
  inner: string;
  fleck: string;
}

export interface HairPreset {
  label: string;
  style: 'curls' | 'swoop' | 'waves';
  base: string;
  highlight: string;
  sheen: string;
  brow: string;
}

export const SKIN_PRESETS: Record<SkinPresetKey, SkinPreset> = {
  warm: {
    label: 'Trigueño rosado (Bichito)',
    base: '#e5af92',
    blush: '#df7568',
    crease: '#bc795d',
    lip: '#ca6862',
    sheen: '#ffd5c2',
  },
  rosy: {
    label: 'Rosado suave',
    base: '#f2c5b0',
    blush: '#ec8c85',
    crease: '#d29780',
    lip: '#dd7b79',
    sheen: '#ffe3d6',
  },
  golden: {
    label: 'Canela dorado',
    base: '#cc8f6d',
    blush: '#c66d5c',
    crease: '#9c6246',
    lip: '#b86359',
    sheen: '#f4bea0',
  },
};

export const EYE_PRESETS: Record<EyePresetKey, EyePreset> = {
  brown: {
    label: 'Café muy oscuro (Bichito)',
    outer: '#110a07',
    mid: '#28170e',
    inner: '#492b18',
    fleck: '#7c4e2b',
  },
  hazel: {
    label: 'Miel cálido',
    outer: '#261e12',
    mid: '#644a22',
    inner: '#9a7a36',
    fleck: '#cfa954',
  },
  blue: {
    label: 'Azul grisáceo',
    outer: '#182838',
    mid: '#385872',
    inner: '#6e94b2',
    fleck: '#b2d0e6',
  },
};

export const HAIR_PRESETS: Record<HairPresetKey, HairPreset> = {
  'dark-curls': {
    label: 'Azabache ondulado (Bichito)',
    style: 'curls',
    base: '#120e0d',
    highlight: '#27201e',
    sheen: '#453833',
    brow: '#181210',
  },
  'blonde-swoop': {
    label: 'Rubio sedoso',
    style: 'swoop',
    base: '#c99b5f',
    highlight: '#e8c892',
    sheen: '#ffe7bd',
    brow: '#a27b4b',
  },
  'chestnut-waves': {
    label: 'Ondas castañas',
    style: 'waves',
    base: '#5c3c28',
    highlight: '#875e43',
    sheen: '#b58669',
    brow: '#4b2f1f',
  },
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba(hex: string, a: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

// Micro-poros y suavidad orgánica de piel de bebé
export function createSkinBumpTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  // Grano sutil de piel (sin ruido brusco)
  for (let i = 0; i < 2400; i++) {
    const x = ((i * 73) % size);
    const y = ((i * 137 + Math.floor(i / 19) * 11) % size);
    const v = 123 + (i % 11);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

// Textura anatómica de rostro 3D con rubor en mejillas, sombreado suave en cuencas oculares, nariz, labios sonrientes y nacimiento del pelo
export function createSculptedHeadSkinTexture(skin: SkinPreset, hair: HairPreset): THREE.CanvasTexture {
  const w = 1024;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // 1. Base piel saludable
  ctx.fillStyle = skin.base;
  ctx.fillRect(0, 0, w, h);

  // 2. Sombreado sutil de profundidad en la zona trasera/baja de la cabeza y cuello
  const backShadow = ctx.createRadialGradient(w * 0.5, h * 0.52, w * 0.18, w * 0.5, h * 0.52, w * 0.52);
  backShadow.addColorStop(0, 'rgba(0,0,0,0)');
  backShadow.addColorStop(0.7, rgba(skin.crease, 0.08));
  backShadow.addColorStop(1, rgba(skin.crease, 0.24));
  ctx.fillStyle = backShadow;
  ctx.fillRect(0, 0, w, h);

  // 3. Iluminación suave en frente y puente nasal (subsurface scatter glow)
  const foreheadGlow = ctx.createRadialGradient(w * 0.5, h * 0.36, 10, w * 0.5, h * 0.38, 128);
  foreheadGlow.addColorStop(0, rgba(skin.sheen, 0.38));
  foreheadGlow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = foreheadGlow;
  ctx.fillRect(w * 0.32, h * 0.22, w * 0.36, h * 0.28);

  // 4. Cuencas oculares almendradas con oclusión ambiental muy suave
  [-1, 1].forEach((side) => {
    const ex = w * (0.5 + side * 0.062);
    const ey = h * 0.485;
    const socketGrad = ctx.createRadialGradient(ex, ey, 12, ex, ey, 50);
    socketGrad.addColorStop(0, rgba(skin.crease, 0.36));
    socketGrad.addColorStop(0.55, rgba(skin.crease, 0.14));
    socketGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = socketGrad;
    ctx.beginPath();
    ctx.ellipse(ex, ey, 52, 38, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // 5. Rubor tierno y cálido en sus mejillas redonditas (como en las fotos reales)
  [-1, 1].forEach((side) => {
    const cx = w * (0.5 + side * 0.086);
    const cy = h * 0.575;
    const blushGrad = ctx.createRadialGradient(cx, cy, 8, cx, cy, 95);
    blushGrad.addColorStop(0, rgba(skin.blush, 0.66));
    blushGrad.addColorStop(0.48, rgba(skin.blush, 0.34));
    blushGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blushGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 96, 74, side * 0.10, 0, Math.PI * 2);
    ctx.fill();

    // Hoyuelo de sonrisa suave al costado de las mejillas
    ctx.strokeStyle = rgba(skin.crease, 0.26);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(w * (0.5 + side * 0.036), h * 0.618, 16, side > 0 ? -0.5 : Math.PI - 0.5, side > 0 ? 0.6 : Math.PI + 0.6);
    ctx.stroke();
  });

  // 6. Toque rosado en la puntita de la nariz ancha de botón y sombreado sutil debajo
  const noseTipGrad = ctx.createRadialGradient(w * 0.5, h * 0.548, 2, w * 0.5, h * 0.548, 30);
  noseTipGrad.addColorStop(0, rgba(skin.blush, 0.42));
  noseTipGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = noseTipGrad;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.548, 32, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fosas nasales suaves y sombra bajo la nariz
  ctx.fillStyle = rgba(skin.crease, 0.54);
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.ellipse(w * (0.5 + side * 0.0115), h * 0.563, 5.2, 3.0, side * -0.25, 0, Math.PI * 2);
    ctx.fill();
  });

  // 7. Sonrisa tierna entreabierta característica de Bichito
  const mouthY = h * 0.624;
  const lipGrad = ctx.createRadialGradient(w * 0.5, mouthY, 3, w * 0.5, mouthY, 38);
  lipGrad.addColorStop(0, rgba(skin.lip, 0.85));
  lipGrad.addColorStop(0.65, rgba(skin.lip, 0.38));
  lipGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lipGrad;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, mouthY, 35, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Interior de sonrisa feliz suave
  ctx.fillStyle = 'rgba(115, 42, 42, 0.68)';
  ctx.beginPath();
  ctx.moveTo(w * 0.472, mouthY - 2);
  ctx.quadraticCurveTo(w * 0.5, mouthY + 9, w * 0.528, mouthY - 2);
  ctx.quadraticCurveTo(w * 0.5, mouthY + 2, w * 0.472, mouthY - 2);
  ctx.fill();

  const chinFold = ctx.createRadialGradient(w * 0.5, h * 0.662, 2, w * 0.5, h * 0.662, 28);
  chinFold.addColorStop(0, rgba(skin.crease, 0.28));
  chinFold.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = chinFold;
  ctx.fillRect(w * 0.44, h * 0.635, w * 0.12, h * 0.055);

  // 8. Sombra suave de nacimiento del cabello abundante en coronilla, sienes y nuca
  const scalpGrad = ctx.createLinearGradient(0, 0, 0, h * 0.45);
  scalpGrad.addColorStop(0, rgba(hair.base, 0.96));
  scalpGrad.addColorStop(0.58, rgba(hair.base, 0.78));
  scalpGrad.addColorStop(0.82, rgba(hair.base, 0.28));
  scalpGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = scalpGrad;
  ctx.fillRect(0, 0, w, h * 0.45);

  // Cubrir nuca y patillas suavemente en los laterales
  const leftNape = ctx.createLinearGradient(w * 0.30, 0, w * 0.16, 0);
  leftNape.addColorStop(0, 'rgba(0,0,0,0)');
  leftNape.addColorStop(1, rgba(hair.base, 0.92));
  ctx.fillStyle = leftNape;
  ctx.fillRect(0, h * 0.14, w * 0.32, h * 0.46);

  const rightNape = ctx.createLinearGradient(w * 0.70, 0, w * 0.84, 0);
  rightNape.addColorStop(0, 'rgba(0,0,0,0)');
  rightNape.addColorStop(1, rgba(hair.base, 0.92));
  ctx.fillStyle = rightNape;
  ctx.fillRect(w * 0.68, h * 0.14, w * 0.32, h * 0.46);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Mapa de rugosidad para la cabeza: mejillas, nariz y frente ligeramente más luminosos y suaves
export function createHeadRoughnessTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#a4a4a4'; // ~0.64 roughness base
  ctx.fillRect(0, 0, size, size);

  // Mejillas y frente con brillo sedoso natural (~0.45)
  const zones: Array<[number, number, number]> = [
    [size * 0.5, size * 0.38, 65],
    [size * 0.418, size * 0.578, 52],
    [size * 0.582, size * 0.578, 52],
    [size * 0.5, size * 0.548, 22],
    [size * 0.5, size * 0.625, 22],
  ];

  zones.forEach(([x, y, r]) => {
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, '#6e6e6e');
    g.addColorStop(1, 'rgba(164,164,164,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  return new THREE.CanvasTexture(canvas);
}

// Textura anatómica para el cuerpo (piel suave con rubor cálido en manitas, rodillas, hombros y pancita)
export function createBodySkinTexture(skin: SkinPreset): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = skin.base;
  ctx.fillRect(0, 0, size, size);

  // Suaves variaciones de tono cálido para evitar sensación de plástico uniforme
  const blushMid = ctx.createLinearGradient(0, 0, 0, size);
  blushMid.addColorStop(0, rgba(skin.sheen, 0.14));
  blushMid.addColorStop(0.5, rgba(skin.blush, 0.10));
  blushMid.addColorStop(1, rgba(skin.crease, 0.12));
  ctx.fillStyle = blushMid;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Textura polar de ojo realista (para SphereGeometry rotada PI/2 en X, de modo que el polo norte quede al frente +Z)
export function createBabyEyeTexture(eye: EyePreset): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Esclera marfil cálida (nunca blanco nuclear) con sombreado suave en la parte trasera
  const scleraGrad = ctx.createLinearGradient(0, h * 0.25, 0, h);
  scleraGrad.addColorStop(0, '#fcfaf7');
  scleraGrad.addColorStop(0.45, '#f4efea');
  scleraGrad.addColorStop(1, '#d8c9c2');
  ctx.fillStyle = scleraGrad;
  ctx.fillRect(0, 0, w, h);

  // Zona del iris (y = 48..126 -> ángulo polar ~17°..44° para mostrar iris grande y esquinas claras de esclerótica)
  const irisStart = 48;
  const irisEnd = 126;

  const irisGrad = ctx.createLinearGradient(0, irisStart, 0, irisEnd);
  irisGrad.addColorStop(0, eye.outer);
  irisGrad.addColorStop(0.28, eye.inner);
  irisGrad.addColorStop(0.68, eye.mid);
  irisGrad.addColorStop(0.92, eye.outer);
  irisGrad.addColorStop(1, '#120d0b');
  ctx.fillStyle = irisGrad;
  ctx.fillRect(0, irisStart, w, irisEnd - irisStart);

  // Fibras radiales del iris alrededor de los 360° (eje X)
  for (let i = 0; i < 160; i++) {
    const x = (i / 160) * w;
    const isBright = i % 3 === 0;
    ctx.strokeStyle = isBright ? rgba(eye.fleck, 0.34) : rgba(eye.outer, 0.38);
    ctx.lineWidth = isBright ? 1.8 : 2.4;
    ctx.beginPath();
    ctx.moveTo(x, irisStart + 4);
    ctx.lineTo(x + (i % 2 === 0 ? 2 : -2), irisEnd - 6);
    ctx.stroke();
  }

  // Anillo limbal oscuro exterior bien definido
  const limbalGrad = ctx.createLinearGradient(0, irisEnd - 18, 0, irisEnd + 6);
  limbalGrad.addColorStop(0, 'rgba(0,0,0,0)');
  limbalGrad.addColorStop(0.6, rgba(eye.outer, 0.92));
  limbalGrad.addColorStop(1, 'rgba(220,205,200,0.45)');
  ctx.fillStyle = limbalGrad;
  ctx.fillRect(0, irisEnd - 18, w, 24);

  // Pupila profunda (y = 0..64)
  ctx.fillStyle = '#090707';
  ctx.fillRect(0, 0, w, irisStart + 5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

// Textura sedosa de hebras de cabello para las mechas 3D
export function createHairStrandTexture(hair: HairPreset): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const size = 256;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d')!;

  cCtx.fillStyle = hair.base;
  cCtx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#707070';
  bCtx.fillRect(0, 0, size, size);

  for (let i = 0; i < 140; i++) {
    const y = (i / 140) * size;
    const isLight = i % 3 === 0;
    cCtx.strokeStyle = isLight ? rgba(hair.highlight, 0.65) : rgba(hair.base, 0.85);
    cCtx.lineWidth = isLight ? 1.5 : 2.2;
    cCtx.beginPath();
    cCtx.moveTo(0, y);
    cCtx.lineTo(size, y + Math.sin(i * 0.7) * 2);
    cCtx.stroke();

    const bv = 95 + (i % 5) * 28;
    bCtx.strokeStyle = `rgb(${bv},${bv},${bv})`;
    bCtx.lineWidth = 1.6;
    bCtx.beginPath();
    bCtx.moveTo(0, y);
    bCtx.lineTo(size, y);
    bCtx.stroke();
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(1, 2);

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(1, 2);

  return { map, bump };
}

// Textura de tejido de algodón suave para la ropa
export function createFabricTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = '#969696';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 4) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  return tex;
}

// Textura acanalada de punto (ribbed knit) para cuellos y puños
export function createRibbedKnitBumpTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#686868';
  ctx.fillRect(0, 0, size, size);

  for (let x = 0; x < size; x += 6) {
    const grad = ctx.createLinearGradient(x, 0, x + 6, 0);
    grad.addColorStop(0, '#555555');
    grad.addColorStop(0.5, '#b8b8b8');
    grad.addColorStop(1, '#555555');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, 6, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 2);
  return tex;
}

// Textura acolchada de pañal suave de algodón
export function createQuiltedDiaperTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#fdfaf5';
  ctx.fillRect(0, 0, size, size);

  // Costura acolchada muy sutil en rombos + micro-puntitos
  ctx.strokeStyle = 'rgba(218, 206, 194, 0.45)';
  ctx.lineWidth = 1.2;
  const step = 24;
  for (let i = -size; i < size * 2; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(i, size);
    ctx.lineTo(i + size, 0);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

// Sombra de contacto realista en el suelo del estudio
export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 120);
  grad.addColorStop(0, 'rgba(54, 34, 22, 0.36)');
  grad.addColorStop(0.4, 'rgba(54, 34, 22, 0.18)');
  grad.addColorStop(0.76, 'rgba(54, 34, 22, 0.05)');
  grad.addColorStop(1, 'rgba(54, 34, 22, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

/**
 * Genera una mecha/rizo 3D orgánica afilada hacia la punta (tapered ribbon tube)
 * a partir de una curva CatmullRomCurve3, evitando tubos cilíndricos duros.
 */
export function createTaperedHairLockGeometry(
  curve: THREE.CatmullRomCurve3,
  tubularSegments = 24,
  radialSegments = 8,
  baseRadius = 0.026,
  flattenY = 0.55
): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const P = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    curve.getPointAt(t, P);
    N.copy(frames.normals[i]);
    B.copy(frames.binormals[i]);

    // Perfil afilado: ancho natural en raíz/cuerpo y punta fina al final
    const envelope = Math.sin(Math.pow(t, 0.65) * Math.PI);
    const radiusW = Math.max(0.0018, baseRadius * (0.25 + 0.95 * envelope) * (1 - 0.55 * Math.pow(t, 2.2)));
    const radiusH = radiusW * flattenY;

    for (let j = 0; j <= radialSegments; j++) {
      const v = (j / radialSegments) * Math.PI * 2;
      const sin = Math.sin(v);
      const cos = -Math.cos(v);

      normal.x = cos * N.x * radiusW + sin * B.x * radiusH;
      normal.y = cos * N.y * radiusW + sin * B.y * radiusH;
      normal.z = cos * N.z * radiusW + sin * B.z * radiusH;

      vertex.copy(P).add(normal);
      positions.push(vertex.x, vertex.y, vertex.z);

      normal.normalize();
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(t, j / radialSegments);
    }
  }

  for (let j = 1; j <= tubularSegments; j++) {
    for (let i = 1; i <= radialSegments; i++) {
      const a = (radialSegments + 1) * (j - 1) + (i - 1);
      const b = (radialSegments + 1) * j + (i - 1);
      const c = (radialSegments + 1) * j + i;
      const d = (radialSegments + 1) * (j - 1) + i;
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geo;
}
