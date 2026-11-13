import * as THREE from 'three';

export type ClothingCategory = 'tops' | 'bottoms' | 'shoes' | 'accessories';

export interface ClothingItem {
  id: string;
  category: ClothingCategory;
  name: string;
  color: string;
  secondaryColor?: string;
  subType: string;
  photoUrl?: string;
  isCustom?: boolean;
}

export interface SavedOutfit {
  id: string;
  name: string;
  topId: string | null;
  bottomId: string | null;
  shoesId: string | null;
  accessoryId: string | null;
  createdAt: string;
}

interface WardrobeState {
  items: ClothingItem[];
  currentOutfit: {
    topId: string | null;
    bottomId: string | null;
    shoesId: string | null;
    accessoryId: string | null;
  };
  savedOutfits: SavedOutfit[];
  activeCategory: ClothingCategory;
  backgroundTheme: 'studio' | 'nursery' | 'minimal';
  babyFaceUrl: string;
}

const STORAGE_KEY = 'bichito-wardrobe-v1';
const DEFAULT_BABY_FACE_URL = '/baby-face.jpg';

// Textura microscópica de tejido de algodón/punto para la ropa
function createFabricTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = '#969696';
  ctx.lineWidth = 1;
  for (let i = 0; i < 128; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 128);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(128, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  return tex;
}

// Textura sutil de poros suaves de piel de bebé
function createSkinBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 650; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const v = 122 + Math.floor(Math.random() * 14);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

// Sombra de contacto realista en el piso del estudio
function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 10, 128, 128, 118);
  grad.addColorStop(0, 'rgba(48, 32, 24, 0.42)');
  grad.addColorStop(0.38, 'rgba(48, 32, 24, 0.22)');
  grad.addColorStop(0.75, 'rgba(48, 32, 24, 0.06)');
  grad.addColorStop(1, 'rgba(48, 32, 24, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

// Probador 3D Realista del Bebé con Three.js
export class BabyStyle3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private babyRoot: THREE.Group;
  private headGroup!: THREE.Group;

  private fabricBumpMap: THREE.CanvasTexture;
  private skinBumpMap: THREE.CanvasTexture;

  // Materiales de piel realista y cabello
  private skinMaterial!: THREE.MeshPhysicalMaterial;
  private headMaterial!: THREE.MeshPhysicalMaterial;
  private hairMaterial!: THREE.MeshStandardMaterial;
  private diaperMaterial!: THREE.MeshStandardMaterial;

  // Mallas de ropa y accesorios
  private diaperGroup!: THREE.Group;
  private bareFeetToes: THREE.Object3D[] = [];

  private topLayer!: THREE.Group;
  private topTorsoMesh!: THREE.Mesh;
  private topCollarMesh!: THREE.Mesh;
  private topHemMesh!: THREE.Mesh;
  private topSleeveLeft!: THREE.Mesh;
  private topSleeveRight!: THREE.Mesh;
  private topCuffLeft!: THREE.Mesh;
  private topCuffRight!: THREE.Mesh;
  private topFrontPatch!: THREE.Mesh;

  private bottomLayer!: THREE.Group;
  private bottomWaistband!: THREE.Mesh;
  private bottomPelvisMesh!: THREE.Mesh;
  private bottomLegLeft!: THREE.Mesh;
  private bottomLegRight!: THREE.Mesh;
  private bottomCuffLeft!: THREE.Mesh;
  private bottomCuffRight!: THREE.Mesh;
  private bottomSkirtMesh!: THREE.Mesh;

  private shoesLayer!: THREE.Group;
  private shoeUpperLeft!: THREE.Mesh;
  private shoeUpperRight!: THREE.Mesh;
  private shoeToeLeft!: THREE.Mesh;
  private shoeToeRight!: THREE.Mesh;
  private shoeSoleLeft!: THREE.Mesh;
  private shoeSoleRight!: THREE.Mesh;
  private shoeStrapLeft!: THREE.Mesh;
  private shoeStrapRight!: THREE.Mesh;

  private accessoryLayer!: THREE.Group;
  private hatGroup!: THREE.Group;
  private hatMesh!: THREE.Mesh;
  private hatBrim!: THREE.Mesh;
  private hatPomPom!: THREE.Mesh;
  private bibGroup!: THREE.Group;
  private bibMesh!: THREE.Mesh;
  private bibTrim!: THREE.Mesh;

  // Control de cámara / rotación 360
  private isDragging = false;
  private previousPointer = { x: 0, y: 0 };
  private targetRotationY = 0;
  private targetPitchX = 0.04;
  private autoRotate = false;
  private animationFrameId: number | null = null;
  private activeFaceTexture: THREE.Texture | null = null;
  private activeClothingTexture: THREE.Texture | null = null;

  public state: WardrobeState;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;

    this.fabricBumpMap = createFabricTexture();
    this.skinBumpMap = createSkinBumpTexture();
    this.state = this.loadState();

    this.scene = new THREE.Scene();
    const width = this.container.clientWidth || 360;
    const height = this.container.clientHeight || 440;
    this.camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 50);
    this.camera.position.set(0, 0.58, 3.65);
    this.camera.lookAt(0, 0.44, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.babyRoot = new THREE.Group();
    this.scene.add(this.babyRoot);

    this.setupStudioEnvironment();
    this.setupLighting();
    this.initMaterials();
    this.buildRealBaby();
    this.buildTailoredClothing();
    this.setupInteractions();
    this.applyTheme(this.state.backgroundTheme);
    this.loadBabyFacePhoto(this.state.babyFaceUrl || DEFAULT_BABY_FACE_URL);
    this.updateOutfitMeshes();

    this.onWindowResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.onWindowResize);

    this.animate = this.animate.bind(this);
    this.animate();
  }

  private loadState(): WardrobeState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          items: Array.isArray(parsed.items) ? parsed.items : [],
          currentOutfit: parsed.currentOutfit || { topId: null, bottomId: null, shoesId: null, accessoryId: null },
          savedOutfits: Array.isArray(parsed.savedOutfits) ? parsed.savedOutfits : [],
          activeCategory: 'tops',
          backgroundTheme: parsed.backgroundTheme || 'studio',
          babyFaceUrl: parsed.babyFaceUrl || DEFAULT_BABY_FACE_URL
        };
      }
    } catch (e) {
      console.warn('Error loading wardrobe state:', e);
    }
    return {
      items: [],
      currentOutfit: { topId: null, bottomId: null, shoesId: null, accessoryId: null },
      savedOutfits: [],
      activeCategory: 'tops',
      backgroundTheme: 'studio',
      babyFaceUrl: DEFAULT_BABY_FACE_URL
    };
  }

  public saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        items: this.state.items,
        currentOutfit: this.state.currentOutfit,
        savedOutfits: this.state.savedOutfits,
        backgroundTheme: this.state.backgroundTheme,
        babyFaceUrl: this.state.babyFaceUrl
      }));
    } catch (e) {
      console.warn('Error saving wardrobe state:', e);
    }
  }

  private setupStudioEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0xfff6ed);

    const softbox1 = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    softbox1.position.set(4, 5, 5);
    softbox1.lookAt(0, 0, 0);
    envScene.add(softbox1);

    const softbox2 = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ color: 0xffeede, side: THREE.DoubleSide })
    );
    softbox2.position.set(-5, 3, 2);
    softbox2.lookAt(0, 0, 0);
    envScene.add(softbox2);

    const renderTarget = pmremGenerator.fromScene(envScene, 0.04);
    this.scene.environment = renderTarget.texture;
    pmremGenerator.dispose();
  }

  private setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0xfffaf4, 0xe8d5c8, 1.35);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff8f0, 1.75);
    keyLight.position.set(2.4, 4.2, 4.0);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0006;
    keyLight.shadow.radius = 3;
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfff0e6, 0.95);
    fillLight.position.set(-3.2, 2.2, 2.4);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffeed9, 0.85);
    rimLight.position.set(0, 3.5, -3.5);
    this.scene.add(rimLight);
  }

  private initMaterials() {
    // Tono base cálido natural de bebé coincidente con las fotos reales del usuario
    const baseSkinColor = new THREE.Color('#dba68c');

    this.skinMaterial = new THREE.MeshPhysicalMaterial({
      color: baseSkinColor,
      roughness: 0.64,
      metalness: 0.0,
      sheen: 0.45,
      sheenRoughness: 0.65,
      sheenColor: new THREE.Color('#ffd8c6'),
      clearcoat: 0.05,
      clearcoatRoughness: 0.75,
      bumpMap: this.skinBumpMap,
      bumpScale: 0.004,
      envMapIntensity: 0.45
    });

    this.headMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.68,
      metalness: 0.0,
      sheen: 0.25,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color('#ffdfd0'),
      envMapIntensity: 0.35
    });

    this.hairMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1e1714'),
      roughness: 0.78,
      metalness: 0.04,
      envMapIntensity: 0.55
    });

    this.diaperMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#fcfaf7'),
      roughness: 0.88,
      metalness: 0.0,
      bumpMap: this.fabricBumpMap,
      bumpScale: 0.03
    });
  }

  /**
   * Proyecta cualquier foto del rostro del bebé sobre una textura equirectangular 1024x512
   * con transición suave hacia el tono de piel muestreado del propio rostro y cabello oscuro en la coronilla.
   */
  public loadBabyFacePhoto(photoUrl: string) {
    this.state.babyFaceUrl = photoUrl;
    this.saveState();

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const texW = 1024;
      const texH = 512;
      const canvas = document.createElement('canvas');
      canvas.width = texW;
      canvas.height = texH;
      const ctx = canvas.getContext('2d')!;

      // 1. Muestrear el tono de piel natural de la foto (frente / mejillas iluminadas)
      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = 64;
      sampleCanvas.height = 64;
      const sCtx = sampleCanvas.getContext('2d')!;
      sCtx.drawImage(img, 0, 0, 64, 64);
      const sampled = this.sampleSkinColorFromCanvas(sCtx);

      // Ajustar tono de piel del cuerpo para empatar perfectamente con el rostro del bebé
      this.skinMaterial.color.set(sampled.bodySkinHex);

      // 2. Pintar base completa de la cabeza con el tono de piel cálido del bebé
      ctx.fillStyle = sampled.headBlendHex;
      ctx.fillRect(0, 0, texW, texH);

      // Sombreado sutil hacia la nuca y parte superior (cabello oscuro en la parte trasera/superior)
      const hairBgGrad = ctx.createLinearGradient(0, 0, 0, texH);
      hairBgGrad.addColorStop(0.0, '#1a1412');
      hairBgGrad.addColorStop(0.24, '#241b17');
      hairBgGrad.addColorStop(0.36, sampled.headBlendHex);
      hairBgGrad.addColorStop(1.0, sampled.headBlendHex);
      ctx.fillStyle = hairBgGrad;
      ctx.fillRect(0, 0, texW, texH);

      // En los costados/nuca mantener cabello hasta la altura media de la cabeza
      const sideHairGrad = ctx.createRadialGradient(texW * 0.5, texH * 0.58, texW * 0.14, texW * 0.5, texH * 0.52, texW * 0.32);
      sideHairGrad.addColorStop(0, 'rgba(0,0,0,0)');
      sideHairGrad.addColorStop(0.75, 'rgba(26, 20, 18, 0.35)');
      sideHairGrad.addColorStop(1, 'rgba(26, 20, 18, 0.92)');
      ctx.fillStyle = sideHairGrad;
      ctx.fillRect(0, 0, texW, texH * 0.62);

      // 3. Crear máscara ovalada difuminada con la foto del rostro en un canvas temporal
      const faceCanvas = document.createElement('canvas');
      const faceW = 360;
      const faceH = 320;
      faceCanvas.width = faceW;
      faceCanvas.height = faceH;
      const fCtx = faceCanvas.getContext('2d')!;

      // Recorte cuadrado centrado de la foto del rostro con ligera compensación de brillo
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      fCtx.save();
      fCtx.filter = 'brightness(1.12) saturate(0.95)';
      fCtx.drawImage(img, sx, sy, minSide, minSide, 0, 0, faceW, faceH);
      fCtx.restore();

      // Máscara radial suave para que bordes, cuello/ropa de la foto desaparezcan sin costuras
      fCtx.globalCompositeOperation = 'destination-in';
      const maskGrad = fCtx.createRadialGradient(
        faceW * 0.5, faceH * 0.47, faceW * 0.21,
        faceW * 0.5, faceH * 0.49, faceW * 0.48
      );
      maskGrad.addColorStop(0.0, 'rgba(0,0,0,1)');
      maskGrad.addColorStop(0.58, 'rgba(0,0,0,0.96)');
      maskGrad.addColorStop(0.82, 'rgba(0,0,0,0.45)');
      maskGrad.addColorStop(1.0, 'rgba(0,0,0,0)');
      fCtx.fillStyle = maskGrad;
      fCtx.fillRect(0, 0, faceW, faceH);

      // 4. Proyectar la cara al centro frontal de la esfera (u = 0.5)
      ctx.drawImage(
        faceCanvas,
        texW * 0.5 - faceW * 0.5,
        texH * 0.53 - faceH * 0.5,
        faceW,
        faceH
      );

      if (this.activeFaceTexture) {
        this.activeFaceTexture.dispose();
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;

      this.activeFaceTexture = texture;
      this.headMaterial.map = texture;
      this.headMaterial.needsUpdate = true;
    };
    img.src = photoUrl;
  }

  private sampleSkinColorFromCanvas(ctx: CanvasRenderingContext2D): { headBlendHex: string; bodySkinHex: string } {
    try {
      // Muestrear la zona central-inferior (mejillas / puente de la nariz)
      const imgData = ctx.getImageData(18, 22, 28, 24).data;
      const samples: Array<{ r: number; g: number; b: number; lum: number }> = [];
      for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i];
        const g = imgData[i + 1];
        const b = imgData[i + 2];
        // Filtrar píxeles de cabello oscuro o fondo oscuro
        if (r > 125 && g > 85 && b > 65 && r > g && g >= b - 8) {
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          samples.push({ r, g, b, lum });
        }
      }
      if (samples.length > 10) {
        samples.sort((a, b) => a.lum - b.lum);
        // Usar el percentil 65 (piel iluminada limpia, sin sombras oscuras)
        const target = samples[Math.floor(samples.length * 0.65)];
        const headR = Math.min(245, Math.round(target.r * 1.06));
        const headG = Math.min(220, Math.round(target.g * 1.05));
        const headB = Math.min(200, Math.round(target.b * 1.05));

        const bodyR = Math.min(248, Math.round(headR * 1.03));
        const bodyG = Math.min(225, Math.round(headG * 1.03));
        const bodyB = Math.min(205, Math.round(headB * 1.03));

        const toHex = (r: number, g: number, b: number) =>
          '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');

        return {
          headBlendHex: toHex(headR, headG, headB),
          bodySkinHex: toHex(bodyR, bodyG, bodyB)
        };
      }
    } catch {
      // Fallback
    }
    return { headBlendHex: '#cf957b', bodySkinHex: '#d79e84' };
  }

  private buildRealBaby() {
    // 1. Pedestal de estudio y sombra suave de contacto
    const pedestalGeo = new THREE.CylinderGeometry(1.15, 1.22, 0.035, 64);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0xf4ece4,
      roughness: 0.85,
      metalness: 0.02
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.62;
    pedestal.receiveShadow = true;
    this.babyRoot.add(pedestal);

    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.75, 1.75),
      new THREE.MeshBasicMaterial({
        map: createContactShadowTexture(),
        transparent: true,
        depthWrite: false
      })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -0.598;
    this.babyRoot.add(contactShadow);

    // 2. Cabeza de Bebé Esculpida (proporción realista ~8-10 meses)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.14, 0.02);

    // phiStart = -Math.PI/2 sitúa u = 0.5 directamente en el frente +Z
    const headGeo = new THREE.SphereGeometry(0.355, 64, 48, -Math.PI / 2, Math.PI * 2);
    const pos = headGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // Mejillas tiernas y redondas de bebé
      if (v.z > 0.04 && v.y < 0.06 && v.y > -0.26) {
        const cheekWeight = Math.exp(-Math.pow((v.y + 0.09) / 0.14, 2)) * Math.min(1, Math.abs(v.x) / 0.18);
        v.x *= 1 + 0.08 * cheekWeight;
        v.z += 0.022 * cheekWeight;
      }
      // Ligero volumen posterior craneal realista
      if (v.z < 0 && v.y > -0.1) {
        v.z *= 1.08;
      }
      // Suave relieve de la nariz en el centro frontal
      if (v.z > 0.28 && Math.abs(v.x) < 0.06 && v.y > -0.12 && v.y < 0.02) {
        const noseFactor = Math.cos((v.x / 0.06) * (Math.PI / 2)) * Math.cos(((v.y + 0.05) / 0.07) * (Math.PI / 2));
        if (noseFactor > 0) v.z += 0.024 * noseFactor;
      }
      // Mandíbula y barbilla suave de bebé
      if (v.y < -0.2) {
        v.y *= 0.94;
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    headGeo.computeVertexNormals();

    const headMesh = new THREE.Mesh(headGeo, this.headMaterial);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    this.headGroup.add(headMesh);

    // Orejitas suaves laterales
    this.buildBabyEar(true);
    this.buildBabyEar(false);

    // Cabello oscuro rizado natural en 3D (coronilla, sienes, nuca y flequillo suave)
    this.buildBabyCurlyHair();

    this.babyRoot.add(this.headGroup);

    // 3. Cuello suave y gordito
    const neckPoints = [
      new THREE.Vector2(0.145, 0.0),
      new THREE.Vector2(0.128, 0.06),
      new THREE.Vector2(0.122, 0.12),
      new THREE.Vector2(0.14, 0.17)
    ];
    const neckGeo = new THREE.LatheGeometry(neckPoints, 32);
    const neckMesh = new THREE.Mesh(neckGeo, this.skinMaterial);
    neckMesh.position.set(0, 0.72, 0);
    neckMesh.castShadow = true;
    this.babyRoot.add(neckMesh);

    // 4. Torso anatómico continuo de bebé (con barriguita redonda y hombros suaves)
    const torsoPoints = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.18, 0.04),
      new THREE.Vector2(0.275, 0.12), // Pelvis
      new THREE.Vector2(0.295, 0.24), // Pancita baja
      new THREE.Vector2(0.29, 0.36),  // Pancita media
      new THREE.Vector2(0.278, 0.48), // Pecho
      new THREE.Vector2(0.265, 0.58), // Hombros altos
      new THREE.Vector2(0.155, 0.65), // Base del cuello
      new THREE.Vector2(0.01, 0.66)
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoPoints, 48);
    // Dar forma ovalada natural (más ancho que profundo) + barriguita suave hacia adelante
    const tPos = torsoGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
      const tx = tPos.getX(i);
      const ty = tPos.getY(i);
      let tz = tPos.getZ(i);
      const bellyBulge = Math.exp(-Math.pow((ty - 0.26) / 0.14, 2));
      if (tz > 0) tz += 0.032 * bellyBulge;
      tPos.setXYZ(i, tx * 1.07, ty, tz * 0.88);
    }
    torsoGeo.computeVertexNormals();

    const torsoMesh = new THREE.Mesh(torsoGeo, this.skinMaterial);
    torsoMesh.position.set(0, 0.14, 0);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.babyRoot.add(torsoMesh);

    // 5. Pañal realista suave de algodón (visible cuando no lleva pantalones)
    this.buildBabyDiaper();

    // 6. Bracitos gorditos con pliegue de muñeca y manitas con dedos
    this.buildRealBabyArm(true);
    this.buildRealBabyArm(false);

    // 7. Piernitas gorditas de bebé con muslos, pantorrillas y piecitos con dedos
    this.buildRealBabyLeg(true);
    this.buildRealBabyLeg(false);
  }

  private buildBabyEar(isLeft: boolean) {
    const sign = isLeft ? 1 : -1;
    const earGroup = new THREE.Group();
    earGroup.position.set(sign * 0.34, -0.02, -0.02);
    earGroup.rotation.y = sign * 0.2;
    earGroup.rotation.z = sign * -0.1;

    const outerEar = new THREE.Mesh(new THREE.SphereGeometry(0.068, 20, 20), this.skinMaterial);
    outerEar.scale.set(0.42, 1.05, 0.78);
    outerEar.castShadow = true;
    earGroup.add(outerEar);

    this.headGroup.add(earGroup);
  }

  private buildBabyCurlyHair() {
    const hairGroup = new THREE.Group();

    // Casquete base de cabello oscuro rizado que cubre la parte superior y trasera
    const capGeo = new THREE.SphereGeometry(0.365, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.56);
    const capMesh = new THREE.Mesh(capGeo, this.hairMaterial);
    capMesh.rotation.x = -0.34;
    capMesh.position.set(0, 0.015, -0.02);
    capMesh.castShadow = true;
    hairGroup.add(capMesh);

    // Cobertura trasera hasta la nuca
    const napeGeo = new THREE.SphereGeometry(0.358, 40, 28, Math.PI * 0.68, Math.PI * 1.64, Math.PI * 0.32, Math.PI * 0.44);
    const napeMesh = new THREE.Mesh(napeGeo, this.hairMaterial);
    napeMesh.rotation.y = Math.PI * 0.5;
    hairGroup.add(napeMesh);

    // Rizos suaves distribuidos orgánicamente (como el pelito rizado de las fotos)
    const curlGeo = new THREE.SphereGeometry(0.068, 16, 16);
    const curlCoords: Array<[number, number, number, number]> = [
      // Parte superior / coronilla
      [0, 0.35, -0.02, 1.2], [-0.12, 0.33, 0.04, 1.15], [0.12, 0.33, 0.04, 1.15],
      [-0.22, 0.27, 0.02, 1.05], [0.22, 0.27, 0.02, 1.05],
      [0, 0.32, 0.12, 1.1], [-0.14, 0.29, 0.15, 1.0], [0.14, 0.29, 0.15, 1.0],
      // Flequillo suave frontal (enmarcando la frente sin tapar los ojos)
      [-0.08, 0.24, 0.24, 0.82], [0.06, 0.25, 0.24, 0.85], [0.18, 0.21, 0.21, 0.8], [-0.19, 0.21, 0.20, 0.8],
      // Laterales y sienes
      [-0.31, 0.14, 0.08, 0.9], [0.31, 0.14, 0.08, 0.9],
      [-0.33, 0.11, -0.08, 0.95], [0.33, 0.11, -0.08, 0.95],
      [-0.28, 0.02, -0.18, 0.9], [0.28, 0.02, -0.18, 0.9],
      // Parte trasera y nuca
      [0, 0.26, -0.22, 1.15], [-0.14, 0.22, -0.25, 1.1], [0.14, 0.22, -0.25, 1.1],
      [0, 0.11, -0.32, 1.1], [-0.16, 0.08, -0.30, 1.05], [0.16, 0.08, -0.30, 1.05],
      [0, -0.04, -0.34, 1.0], [-0.15, -0.05, -0.31, 0.95], [0.15, -0.05, -0.31, 0.95],
      [-0.07, -0.15, -0.29, 0.88], [0.08, -0.15, -0.29, 0.88]
    ];

    curlCoords.forEach(([x, y, z, s], idx) => {
      const curl = new THREE.Mesh(curlGeo, this.hairMaterial);
      curl.position.set(x, y, z);
      const sx = s * (0.95 + (idx % 3) * 0.12);
      const sy = s * (0.78 + (idx % 2) * 0.15);
      const sz = s * (0.95 + ((idx + 1) % 3) * 0.1);
      curl.scale.set(sx, sy, sz);
      curl.castShadow = true;
      hairGroup.add(curl);
    });

    this.headGroup.add(hairGroup);
  }

  private buildBabyDiaper() {
    this.diaperGroup = new THREE.Group();

    const diaperPoints = [
      new THREE.Vector2(0.02, 0.0),
      new THREE.Vector2(0.18, 0.03),
      new THREE.Vector2(0.295, 0.11),
      new THREE.Vector2(0.315, 0.22),
      new THREE.Vector2(0.302, 0.30),
      new THREE.Vector2(0.01, 0.30)
    ];
    const diaperGeo = new THREE.LatheGeometry(diaperPoints, 40);
    const dPos = diaperGeo.attributes.position;
    for (let i = 0; i < dPos.count; i++) {
      dPos.setX(i, dPos.getX(i) * 1.08);
      dPos.setZ(i, dPos.getZ(i) * 0.91);
    }
    diaperGeo.computeVertexNormals();

    const diaperMesh = new THREE.Mesh(diaperGeo, this.diaperMaterial);
    diaperMesh.position.y = 0.135;
    diaperMesh.castShadow = true;
    diaperMesh.receiveShadow = true;
    this.diaperGroup.add(diaperMesh);

    // Pretina elástica suave del pañal
    const bandGeo = new THREE.TorusGeometry(0.302, 0.02, 12, 48);
    const band = new THREE.Mesh(bandGeo, this.diaperMaterial);
    band.rotation.x = Math.PI / 2;
    band.scale.set(1.07, 0.90, 1);
    band.position.y = 0.425;
    this.diaperGroup.add(band);

    this.babyRoot.add(this.diaperGroup);
  }

  private buildRealBabyArm(isLeft: boolean) {
    const sign = isLeft ? 1 : -1;
    const armRoot = new THREE.Group();
    armRoot.position.set(sign * 0.275, 0.72, 0.01);
    armRoot.rotation.z = sign * -0.26;
    armRoot.rotation.x = -0.06;

    // Hombro redondeado continuo
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.092, 24, 24), this.skinMaterial);
    shoulder.castShadow = true;
    armRoot.add(shoulder);

    // Brazo superior gordito
    const upperArmPoints = [
      new THREE.Vector2(0.088, 0.0),
      new THREE.Vector2(0.094, -0.08),
      new THREE.Vector2(0.086, -0.17),
      new THREE.Vector2(0.072, -0.23)
    ];
    const upperArm = new THREE.Mesh(new THREE.LatheGeometry(upperArmPoints, 28), this.skinMaterial);
    upperArm.castShadow = true;
    armRoot.add(upperArm);

    // Antebrazo ligeramente doblado con pliegue de muñeca de bebé
    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, -0.22, 0);
    forearmGroup.rotation.x = -0.18;
    forearmGroup.rotation.z = sign * 0.08;

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.073, 20, 20), this.skinMaterial);
    forearmGroup.add(elbow);

    const forearmPoints = [
      new THREE.Vector2(0.072, 0.0),
      new THREE.Vector2(0.078, -0.07),
      new THREE.Vector2(0.068, -0.15),
      new THREE.Vector2(0.052, -0.20), // Pliegue de la muñeca
      new THREE.Vector2(0.058, -0.22)
    ];
    const forearm = new THREE.Mesh(new THREE.LatheGeometry(forearmPoints, 28), this.skinMaterial);
    forearm.castShadow = true;
    forearmGroup.add(forearm);

    // Manita adorable con palma redondeada + pulgar + 4 deditos
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.24, 0.01);
    handGroup.rotation.z = sign * 0.1;

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.056, 20, 20), this.skinMaterial);
    palm.scale.set(0.85, 1.08, 0.65);
    palm.castShadow = true;
    handGroup.add(palm);

    // Pulgar
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.032, 6, 12), this.skinMaterial);
    thumb.position.set(sign * -0.042, -0.01, 0.025);
    thumb.rotation.z = sign * -0.65;
    thumb.rotation.x = -0.3;
    handGroup.add(thumb);

    // 4 deditos suavemente curvados
    const fingerOffsets = [-0.027, -0.009, 0.009, 0.026];
    const fingerLengths = [0.034, 0.042, 0.040, 0.030];
    fingerOffsets.forEach((fx, idx) => {
      const finger = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.012, fingerLengths[idx], 6, 10),
        this.skinMaterial
      );
      finger.position.set(fx * sign, -0.058, 0.01);
      finger.rotation.x = -0.22;
      handGroup.add(finger);
    });

    forearmGroup.add(handGroup);
    armRoot.add(forearmGroup);
    this.babyRoot.add(armRoot);
  }

  private buildRealBabyLeg(isLeft: boolean) {
    const sign = isLeft ? 1 : -1;
    const legRoot = new THREE.Group();
    legRoot.position.set(sign * 0.145, 0.17, 0.01);
    legRoot.rotation.z = sign * 0.045;

    // Muslo gordito de bebé
    const thighPoints = [
      new THREE.Vector2(0.132, 0.0),
      new THREE.Vector2(0.142, -0.10),
      new THREE.Vector2(0.128, -0.22),
      new THREE.Vector2(0.105, -0.32),
      new THREE.Vector2(0.098, -0.35)
    ];
    const thigh = new THREE.Mesh(new THREE.LatheGeometry(thighPoints, 32), this.skinMaterial);
    thigh.castShadow = true;
    thigh.receiveShadow = true;
    legRoot.add(thigh);

    // Rodilla suave sin costura
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.098, 24, 24), this.skinMaterial);
    knee.position.set(0, -0.35, 0.008);
    legRoot.add(knee);

    // Pantorrilla gordita + tobillo
    const calfPoints = [
      new THREE.Vector2(0.098, 0.0),
      new THREE.Vector2(0.105, -0.10),
      new THREE.Vector2(0.092, -0.22),
      new THREE.Vector2(0.068, -0.31), // Tobillo bebé
      new THREE.Vector2(0.072, -0.34)
    ];
    const calf = new THREE.Mesh(new THREE.LatheGeometry(calfPoints, 32), this.skinMaterial);
    calf.position.set(0, -0.35, 0);
    calf.castShadow = true;
    legRoot.add(calf);

    // Pie suave de bebé con talón, empeine y 5 deditos
    const footGroup = new THREE.Group();
    footGroup.position.set(0, -0.71, 0.04);

    const footBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.11, 10, 20), this.skinMaterial);
    footBody.rotation.x = Math.PI / 2;
    footBody.scale.set(1.05, 1.0, 0.78);
    footBody.castShadow = true;
    footGroup.add(footBody);

    // 5 deditos del pie (se ocultan cuando lleva zapatitos)
    const toesGroup = new THREE.Group();
    for (let t = 0; t < 5; t++) {
      const toeRadius = t === 0 ? 0.022 : 0.017 - t * 0.0015;
      const toe = new THREE.Mesh(new THREE.SphereGeometry(toeRadius, 12, 12), this.skinMaterial);
      const xPos = sign * (0.044 - t * 0.022);
      const zPos = 0.092 - t * 0.005;
      toe.position.set(xPos, -0.02, zPos);
      toe.scale.set(0.95, 0.85, 1.2);
      toesGroup.add(toe);
    }
    footGroup.add(toesGroup);
    this.bareFeetToes.push(toesGroup);

    legRoot.add(footGroup);
    this.babyRoot.add(legRoot);
  }

  private buildTailoredClothing() {
    // --- 1. TOPS (Poleras, Bodys, Suéteres adaptados a la anatomía real del bebé) ---
    this.topLayer = new THREE.Group();

    const topMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.01,
      bumpMap: this.fabricBumpMap,
      bumpScale: 0.035
    });

    const shirtPoints = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.308, 0.02),
      new THREE.Vector2(0.318, 0.16),
      new THREE.Vector2(0.312, 0.30),
      new THREE.Vector2(0.298, 0.42),
      new THREE.Vector2(0.285, 0.51),
      new THREE.Vector2(0.165, 0.57),
      new THREE.Vector2(0.01, 0.58)
    ];
    const shirtGeo = new THREE.LatheGeometry(shirtPoints, 48);
    const sPos = shirtGeo.attributes.position;
    for (let i = 0; i < sPos.count; i++) {
      const sx = sPos.getX(i);
      const sy = sPos.getY(i);
      let sz = sPos.getZ(i);
      const bulge = Math.exp(-Math.pow((sy - 0.18) / 0.14, 2));
      if (sz > 0) sz += 0.032 * bulge;
      sPos.setXYZ(i, sx * 1.075, sy, sz * 0.89);
    }
    shirtGeo.computeVertexNormals();

    this.topTorsoMesh = new THREE.Mesh(shirtGeo, topMat);
    this.topTorsoMesh.position.y = 0.22;
    this.topTorsoMesh.castShadow = true;
    this.topLayer.add(this.topTorsoMesh);

    // Parche frontal para mostrar la foto real de la prenda subida si existe
    const patchGeo = new THREE.CylinderGeometry(0.305, 0.315, 0.38, 32, 1, true, -0.58, 1.16);
    const patchMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.0,
      transparent: true,
      opacity: 0.92
    });
    this.topFrontPatch = new THREE.Mesh(patchGeo, patchMat);
    this.topFrontPatch.position.set(0, 0.50, 0.01);
    this.topFrontPatch.scale.set(1.04, 1, 0.93);
    this.topFrontPatch.visible = false;
    this.topLayer.add(this.topFrontPatch);

    // Cuello ribeteado suave
    this.topCollarMesh = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.022, 14, 40), topMat);
    this.topCollarMesh.rotation.x = Math.PI / 2;
    this.topCollarMesh.position.set(0, 0.785, 0);
    this.topLayer.add(this.topCollarMesh);

    // Dobladillo inferior
    this.topHemMesh = new THREE.Mesh(new THREE.TorusGeometry(0.308, 0.018, 14, 48), topMat);
    this.topHemMesh.rotation.x = Math.PI / 2;
    this.topHemMesh.scale.set(1.07, 0.89, 1);
    this.topHemMesh.position.set(0, 0.23, 0);
    this.topLayer.add(this.topHemMesh);

    // Mangas adaptadas a los brazos reales
    const sleevePoints = [
      new THREE.Vector2(0.105, 0.02),
      new THREE.Vector2(0.112, -0.06),
      new THREE.Vector2(0.104, -0.15),
      new THREE.Vector2(0.095, -0.20)
    ];
    const sleeveGeo = new THREE.LatheGeometry(sleevePoints, 28);
    const cuffGeo = new THREE.TorusGeometry(0.096, 0.014, 12, 28);

    this.topSleeveLeft = new THREE.Mesh(sleeveGeo, topMat);
    this.topSleeveLeft.position.set(0.275, 0.72, 0.01);
    this.topSleeveLeft.rotation.z = -0.26;
    this.topSleeveLeft.rotation.x = -0.06;
    this.topSleeveLeft.castShadow = true;
    this.topLayer.add(this.topSleeveLeft);

    this.topCuffLeft = new THREE.Mesh(cuffGeo, topMat);
    this.topCuffLeft.rotation.x = Math.PI / 2;
    this.topCuffLeft.position.set(0, -0.20, 0);
    this.topSleeveLeft.add(this.topCuffLeft);

    this.topSleeveRight = new THREE.Mesh(sleeveGeo, topMat);
    this.topSleeveRight.position.set(-0.275, 0.72, 0.01);
    this.topSleeveRight.rotation.z = 0.26;
    this.topSleeveRight.rotation.x = -0.06;
    this.topSleeveRight.castShadow = true;
    this.topLayer.add(this.topSleeveRight);

    this.topCuffRight = new THREE.Mesh(cuffGeo, topMat);
    this.topCuffRight.rotation.x = Math.PI / 2;
    this.topCuffRight.position.set(0, -0.20, 0);
    this.topSleeveRight.add(this.topCuffRight);

    this.topLayer.visible = false;
    this.babyRoot.add(this.topLayer);

    // --- 2. BOTTOMS (Pantalones, Joggers, Faldas adaptados al bebé real) ---
    this.bottomLayer = new THREE.Group();

    const bottomMat = new THREE.MeshStandardMaterial({
      color: 0x3d5c7a,
      roughness: 0.88,
      metalness: 0.01,
      bumpMap: this.fabricBumpMap,
      bumpScale: 0.055
    });

    // Pretina elástica
    this.bottomWaistband = new THREE.Mesh(new THREE.TorusGeometry(0.308, 0.025, 14, 48), bottomMat);
    this.bottomWaistband.rotation.x = Math.PI / 2;
    this.bottomWaistband.scale.set(1.08, 0.90, 1);
    this.bottomWaistband.position.y = 0.42;
    this.bottomLayer.add(this.bottomWaistband);

    // Cadera del pantalón
    const pelvisPoints = [
      new THREE.Vector2(0.02, 0.0),
      new THREE.Vector2(0.20, 0.04),
      new THREE.Vector2(0.312, 0.14),
      new THREE.Vector2(0.316, 0.28),
      new THREE.Vector2(0.01, 0.28)
    ];
    const pelvisGeo = new THREE.LatheGeometry(pelvisPoints, 40);
    const pPos = pelvisGeo.attributes.position;
    for (let i = 0; i < pPos.count; i++) {
      pPos.setX(i, pPos.getX(i) * 1.09);
      pPos.setZ(i, pPos.getZ(i) * 0.92);
    }
    pelvisGeo.computeVertexNormals();
    this.bottomPelvisMesh = new THREE.Mesh(pelvisGeo, bottomMat);
    this.bottomPelvisMesh.position.y = 0.14;
    this.bottomPelvisMesh.castShadow = true;
    this.bottomLayer.add(this.bottomPelvisMesh);

    // Piernas de pantalón envolviendo las piernitas del bebé
    const pantLegPoints = [
      new THREE.Vector2(0.15, 0.0),
      new THREE.Vector2(0.155, -0.15),
      new THREE.Vector2(0.135, -0.32),
      new THREE.Vector2(0.125, -0.48),
      new THREE.Vector2(0.10, -0.64)
    ];
    const pantLegGeo = new THREE.LatheGeometry(pantLegPoints, 32);
    const pantCuffGeo = new THREE.TorusGeometry(0.098, 0.018, 12, 28);

    this.bottomLegLeft = new THREE.Mesh(pantLegGeo, bottomMat);
    this.bottomLegLeft.position.set(0.145, 0.17, 0.01);
    this.bottomLegLeft.rotation.z = 0.045;
    this.bottomLegLeft.castShadow = true;
    this.bottomLayer.add(this.bottomLegLeft);

    this.bottomCuffLeft = new THREE.Mesh(pantCuffGeo, bottomMat);
    this.bottomCuffLeft.rotation.x = Math.PI / 2;
    this.bottomCuffLeft.position.y = -0.64;
    this.bottomLegLeft.add(this.bottomCuffLeft);

    this.bottomLegRight = new THREE.Mesh(pantLegGeo, bottomMat);
    this.bottomLegRight.position.set(-0.145, 0.17, 0.01);
    this.bottomLegRight.rotation.z = -0.045;
    this.bottomLegRight.castShadow = true;
    this.bottomLayer.add(this.bottomLegRight);

    this.bottomCuffRight = new THREE.Mesh(pantCuffGeo, bottomMat);
    this.bottomCuffRight.rotation.x = Math.PI / 2;
    this.bottomCuffRight.position.y = -0.64;
    this.bottomLegRight.add(this.bottomCuffRight);

    // Falda opcional (para subType === 'skirt')
    const skirtGeo = new THREE.CylinderGeometry(0.32, 0.44, 0.36, 40, 1, false);
    this.bottomSkirtMesh = new THREE.Mesh(skirtGeo, bottomMat);
    this.bottomSkirtMesh.position.y = 0.24;
    this.bottomSkirtMesh.scale.set(1.06, 1, 0.92);
    this.bottomSkirtMesh.visible = false;
    this.bottomLayer.add(this.bottomSkirtMesh);

    this.bottomLayer.visible = false;
    this.babyRoot.add(this.bottomLayer);

    // --- 3. CALZADO (Zapatitos redondeados de bebé con suela blanca y correa) ---
    this.shoesLayer = new THREE.Group();
    const shoeUpperMat = new THREE.MeshStandardMaterial({ color: 0xcac5bf, roughness: 0.65, metalness: 0.05 });
    const shoeSoleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.02 });
    const shoeStrapMat = new THREE.MeshStandardMaterial({ color: 0xf4eee8, roughness: 0.7 });

    const createBabyShoe = (sign: number) => {
      const g = new THREE.Group();
      g.position.set(sign * 0.17, -0.535, 0.045);
      g.rotation.z = sign * 0.025;

      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.105, 10, 20), shoeUpperMat);
      upper.rotation.x = Math.PI / 2;
      upper.scale.set(1.08, 1.02, 0.85);
      upper.castShadow = true;
      g.add(upper);

      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.078, 16, 16), shoeUpperMat);
      toe.position.set(0, -0.005, 0.055);
      toe.scale.set(1.06, 0.78, 1.0);
      g.add(toe);

      const sole = new THREE.Mesh(new THREE.CapsuleGeometry(0.079, 0.115, 8, 20), shoeSoleMat);
      sole.rotation.x = Math.PI / 2;
      sole.position.set(0, -0.048, 0.01);
      sole.scale.set(1.08, 1.05, 0.34);
      sole.castShadow = true;
      g.add(sole);

      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.073, 0.012, 8, 24, Math.PI), shoeStrapMat);
      strap.position.set(0, 0.01, 0.015);
      g.add(strap);

      return { g, upper, toe, sole, strap };
    };

    const leftShoe = createBabyShoe(1);
    const rightShoe = createBabyShoe(-1);
    this.shoeUpperLeft = leftShoe.upper;
    this.shoeToeLeft = leftShoe.toe;
    this.shoeSoleLeft = leftShoe.sole;
    this.shoeStrapLeft = leftShoe.strap;
    this.shoeUpperRight = rightShoe.upper;
    this.shoeToeRight = rightShoe.toe;
    this.shoeSoleRight = rightShoe.sole;
    this.shoeStrapRight = rightShoe.strap;

    this.shoesLayer.add(leftShoe.g, rightShoe.g);
    this.shoesLayer.visible = false;
    this.babyRoot.add(this.shoesLayer);

    // --- 4. ACCESORIOS (Gorrito Beanie y Babero) ---
    this.accessoryLayer = new THREE.Group();

    // Gorro Beanie
    this.hatGroup = new THREE.Group();
    const hatMat = new THREE.MeshStandardMaterial({
      color: 0xe8ded1,
      roughness: 0.9,
      bumpMap: this.fabricBumpMap,
      bumpScale: 0.06
    });
    this.hatMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.382, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.50),
      hatMat
    );
    this.hatMesh.position.set(0, 1.18, 0.0);
    this.hatMesh.rotation.x = -0.18;
    this.hatMesh.castShadow = true;
    this.hatGroup.add(this.hatMesh);

    this.hatBrim = new THREE.Mesh(new THREE.TorusGeometry(0.365, 0.036, 14, 48), hatMat);
    this.hatBrim.rotation.x = Math.PI / 2 - 0.18;
    this.hatBrim.position.set(0, 1.21, -0.01);
    this.hatGroup.add(this.hatBrim);

    this.hatPomPom = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 16), hatMat);
    this.hatPomPom.position.set(0, 1.57, -0.07);
    this.hatGroup.add(this.hatPomPom);
    this.hatGroup.visible = false;
    this.accessoryLayer.add(this.hatGroup);

    // Babero
    this.bibGroup = new THREE.Group();
    const bibMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      bumpMap: this.fabricBumpMap,
      bumpScale: 0.03
    });
    const bibTrimMat = new THREE.MeshStandardMaterial({ color: 0xdf7446, roughness: 0.8 });

    this.bibMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.30, 0.25, 32, 1, true, -0.65, 1.3),
      bibMat
    );
    this.bibMesh.position.set(0, 0.64, 0.04);
    this.bibMesh.scale.set(1.0, 1.0, 0.92);
    this.bibGroup.add(this.bibMesh);

    this.bibTrim = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.018, 12, 32), bibTrimMat);
    this.bibTrim.rotation.x = Math.PI / 2;
    this.bibTrim.position.set(0, 0.77, 0.02);
    this.bibGroup.add(this.bibTrim);
    this.bibGroup.visible = false;
    this.accessoryLayer.add(this.bibGroup);

    this.babyRoot.add(this.accessoryLayer);
  }

  private setupInteractions() {
    const el = this.renderer.domElement;

    const onPointerDown = (clientX: number, clientY: number) => {
      this.isDragging = true;
      this.autoRotate = false;
      this.previousPointer = { x: clientX, y: clientY };
    };

    const onPointerMove = (clientX: number, clientY: number) => {
      if (!this.isDragging) return;
      const dx = clientX - this.previousPointer.x;
      const dy = clientY - this.previousPointer.y;
      this.targetRotationY += dx * 0.012;
      this.targetPitchX = Math.max(-0.22, Math.min(0.28, this.targetPitchX + dy * 0.004));
      this.previousPointer = { x: clientX, y: clientY };
    };

    const onPointerUp = () => {
      this.isDragging = false;
    };

    el.addEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onPointerUp);

    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1) {
        onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    window.addEventListener('touchend', onPointerUp);
  }

  public toggleAutoRotate(): boolean {
    this.autoRotate = !this.autoRotate;
    return this.autoRotate;
  }

  public applyTheme(theme: 'studio' | 'nursery' | 'minimal') {
    this.state.backgroundTheme = theme;
    let bgColor = 0xfff8f2;
    if (theme === 'nursery') bgColor = 0xe9f3f9;
    if (theme === 'minimal') bgColor = 0xf5f5f5;

    this.renderer.setClearColor(bgColor, 1);
    this.saveState();
  }

  public updateOutfitMeshes() {
    const { topId, bottomId, shoesId, accessoryId } = this.state.currentOutfit;

    // 1. Actualizar Top
    const topItem = this.state.items.find(i => i.id === topId);
    if (topItem) {
      this.topLayer.visible = true;
      const color = new THREE.Color(topItem.color || '#ffffff');
      const mat = this.topTorsoMesh.material as THREE.MeshStandardMaterial;
      mat.color = color;

      // Si es manga larga (sweater / jacket), alargar la manga
      if (topItem.subType === 'sweater' || topItem.subType === 'jacket') {
        this.topSleeveLeft.scale.set(1.06, 1.55, 1.06);
        this.topSleeveRight.scale.set(1.06, 1.55, 1.06);
      } else {
        this.topSleeveLeft.scale.set(1, 1, 1);
        this.topSleeveRight.scale.set(1, 1, 1);
      }

      // Mostrar textura de la foto real subida en el pecho si existe
      if (topItem.photoUrl) {
        new THREE.TextureLoader().load(topItem.photoUrl, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          if (this.activeClothingTexture) this.activeClothingTexture.dispose();
          this.activeClothingTexture = tex;
          const patchMat = this.topFrontPatch.material as THREE.MeshStandardMaterial;
          patchMat.map = tex;
          patchMat.needsUpdate = true;
          this.topFrontPatch.visible = true;
        });
      } else {
        this.topFrontPatch.visible = false;
      }
    } else {
      this.topLayer.visible = false;
      this.topFrontPatch.visible = false;
    }

    // 2. Actualizar Bottom (oculta el pañal cuando lleva pantalón/falda)
    const botItem = this.state.items.find(i => i.id === bottomId);
    if (botItem) {
      this.bottomLayer.visible = true;
      this.diaperGroup.visible = false;
      const color = new THREE.Color(botItem.color || '#3d5c7a');
      const mat = this.bottomPelvisMesh.material as THREE.MeshStandardMaterial;
      mat.color = color;

      if (botItem.subType === 'skirt') {
        this.bottomSkirtMesh.visible = true;
        this.bottomLegLeft.visible = false;
        this.bottomLegRight.visible = false;
      } else {
        this.bottomSkirtMesh.visible = false;
        this.bottomLegLeft.visible = true;
        this.bottomLegRight.visible = true;
        const shortScale = botItem.subType === 'shorts' ? 0.5 : 1.0;
        this.bottomLegLeft.scale.set(1, shortScale, 1);
        this.bottomLegRight.scale.set(1, shortScale, 1);
      }
    } else {
      this.bottomLayer.visible = false;
      this.diaperGroup.visible = true;
    }

    // 3. Actualizar Calzado (oculta los deditos descalzos cuando lleva zapatos)
    const shoeItem = this.state.items.find(i => i.id === shoesId);
    if (shoeItem) {
      this.shoesLayer.visible = true;
      this.bareFeetToes.forEach(t => (t.visible = false));
      const color = new THREE.Color(shoeItem.color || '#cac5bf');
      (this.shoeUpperLeft.material as THREE.MeshStandardMaterial).color = color;
      (this.shoeToeLeft.material as THREE.MeshStandardMaterial).color = color;
      (this.shoeUpperRight.material as THREE.MeshStandardMaterial).color = color;
      (this.shoeToeRight.material as THREE.MeshStandardMaterial).color = color;
    } else {
      this.shoesLayer.visible = false;
      this.bareFeetToes.forEach(t => (t.visible = true));
    }

    // 4. Actualizar Accesorios (gorro o babero)
    const accItem = this.state.items.find(i => i.id === accessoryId);
    if (accItem) {
      const color = new THREE.Color(accItem.color || '#e8ded1');
      if (accItem.subType === 'bib') {
        this.hatGroup.visible = false;
        this.bibGroup.visible = true;
        (this.bibMesh.material as THREE.MeshStandardMaterial).color = color;
      } else {
        this.bibGroup.visible = false;
        this.hatGroup.visible = true;
        (this.hatMesh.material as THREE.MeshStandardMaterial).color = color;
        (this.hatBrim.material as THREE.MeshStandardMaterial).color = color;
        (this.hatPomPom.material as THREE.MeshStandardMaterial).color = color;
      }
    } else {
      this.hatGroup.visible = false;
      this.bibGroup.visible = false;
    }

    this.saveState();
  }

  public selectClothing(item: ClothingItem) {
    if (item.category === 'tops') {
      this.state.currentOutfit.topId = this.state.currentOutfit.topId === item.id ? null : item.id;
    } else if (item.category === 'bottoms') {
      this.state.currentOutfit.bottomId = this.state.currentOutfit.bottomId === item.id ? null : item.id;
    } else if (item.category === 'shoes') {
      this.state.currentOutfit.shoesId = this.state.currentOutfit.shoesId === item.id ? null : item.id;
    } else if (item.category === 'accessories') {
      this.state.currentOutfit.accessoryId = this.state.currentOutfit.accessoryId === item.id ? null : item.id;
    }
    this.updateOutfitMeshes();
  }

  public clearOutfit() {
    this.state.currentOutfit = { topId: null, bottomId: null, shoesId: null, accessoryId: null };
    this.updateOutfitMeshes();
  }

  public saveCurrentOutfit(name?: string) {
    const outfitName = name?.trim() || `Look ${this.state.savedOutfits.length + 1}`;
    const newOutfit: SavedOutfit = {
      id: `outfit-${Date.now()}`,
      name: outfitName,
      topId: this.state.currentOutfit.topId,
      bottomId: this.state.currentOutfit.bottomId,
      shoesId: this.state.currentOutfit.shoesId,
      accessoryId: this.state.currentOutfit.accessoryId,
      createdAt: new Date().toISOString().split('T')[0]
    };
    this.state.savedOutfits.unshift(newOutfit);
    this.saveState();
    return newOutfit;
  }

  public wearSavedOutfit(outfitId: string) {
    const outfit = this.state.savedOutfits.find(o => o.id === outfitId);
    if (!outfit) return;
    this.state.currentOutfit = {
      topId: outfit.topId,
      bottomId: outfit.bottomId,
      shoesId: outfit.shoesId,
      accessoryId: outfit.accessoryId
    };
    this.updateOutfitMeshes();
  }

  public addCustomClothing(item: Omit<ClothingItem, 'id' | 'isCustom'>): ClothingItem {
    const newItem: ClothingItem = {
      ...item,
      id: `item-${Date.now()}`,
      isCustom: true
    };
    this.state.items.unshift(newItem);
    this.state.activeCategory = newItem.category;
    this.selectClothing(newItem);
    this.saveState();
    return newItem;
  }

  public deleteClothing(itemId: string) {
    this.state.items = this.state.items.filter(i => i.id !== itemId);
    if (this.state.currentOutfit.topId === itemId) this.state.currentOutfit.topId = null;
    if (this.state.currentOutfit.bottomId === itemId) this.state.currentOutfit.bottomId = null;
    if (this.state.currentOutfit.shoesId === itemId) this.state.currentOutfit.shoesId = null;
    if (this.state.currentOutfit.accessoryId === itemId) this.state.currentOutfit.accessoryId = null;
    this.updateOutfitMeshes();
    this.saveState();
  }

  private animate() {
    this.animationFrameId = requestAnimationFrame(this.animate);

    if (this.autoRotate) {
      this.targetRotationY += 0.007;
    }

    this.babyRoot.rotation.y += (this.targetRotationY - this.babyRoot.rotation.y) * 0.1;
    this.babyRoot.rotation.x += (this.targetPitchX - this.babyRoot.rotation.x) * 0.1;

    // Respiración natural suave y micro-inclinación tierna de cabecita
    const t = Date.now() * 0.0018;
    this.headGroup.rotation.z = Math.sin(t * 0.7) * 0.025;
    this.headGroup.position.y = 1.14 + Math.sin(t) * 0.004;

    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize() {
    if (!this.container) return;
    const width = this.container.clientWidth || 360;
    const height = this.container.clientHeight || 440;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public destroy() {
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.onWindowResize);
    if (this.activeFaceTexture) this.activeFaceTexture.dispose();
    if (this.activeClothingTexture) this.activeClothingTexture.dispose();
    this.renderer.dispose();
  }
}
