import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  EYE_PRESETS,
  EyePresetKey,
  HAIR_PRESETS,
  HairPresetKey,
  SKIN_PRESETS,
  SkinPresetKey,
  createBabyEyeTexture,
  createBodySkinTexture,
  createContactShadowTexture,
  createFabricTexture,
  createHairStrandTexture,
  createHeadRoughnessTexture,
  createQuiltedDiaperTexture,
  createRibbedKnitBumpTexture,
  createSculptedHeadSkinTexture,
  createSkinBumpTexture,
  createTaperedHairLockGeometry,
} from './babyAssets';

export type ClothingCategory = 'tops' | 'bottoms' | 'shoes' | 'accessories';
export type FaceMode = 'sculpted3d' | 'photo';

export interface ClothingItem {
  id: string;
  category: ClothingCategory;
  name: string;
  color: string;
  secondaryColor?: string;
  subType: string;
  photoUrl?: string;
  tryOnUrl?: string;
  isCustom?: boolean;
}

export interface SavedOutfit {
  id: string;
  name: string;
  topId: string | null;
  bottomId: string | null;
  shoesId: string | null;
  accessoryId: string | null;
  tryOnUrl?: string;
  createdAt: string;
}

export interface WardrobeState {
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
  faceMode: FaceMode;
  babyFaceUrl: string;
  skinPreset: SkinPresetKey;
  eyePreset: EyePresetKey;
  hairPreset: HairPresetKey;
  showPacifier: boolean;
}

const STORAGE_KEY = 'bichito-wardrobe-v1';
const DEFAULT_BABY_FACE_URL = '/baby-face.jpg';

const isSoftwareWebGL = (() => {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
})();

export class BabyStyle3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock = new THREE.Clock();

  private babyRoot: THREE.Group;
  private torsoPivot!: THREE.Group;
  private headGroup!: THREE.Group;
  private sculptedFaceGroup!: THREE.Group;
  private hairGroup!: THREE.Group;
  private pacifierGroup!: THREE.Group;
  private upperEyelids: THREE.Mesh[] = [];
  private eyeLookGroups: THREE.Group[] = [];

  private studioBackdropMat!: THREE.MeshStandardMaterial;
  private studioFloorMat!: THREE.MeshStandardMaterial;

  // Texturas compartidas
  private fabricBumpMap: THREE.CanvasTexture;
  private ribbedBumpMap: THREE.CanvasTexture;
  private skinBumpMap: THREE.CanvasTexture;
  private headRoughnessMap: THREE.CanvasTexture;

  // Materiales PBR realistas
  private skinMaterial!: THREE.MeshPhysicalMaterial;
  private headSculptedMaterial!: THREE.MeshPhysicalMaterial;
  private headPhotoMaterial!: THREE.MeshPhysicalMaterial;
  private headMesh!: THREE.Mesh;
  private eyeMaterial!: THREE.MeshPhysicalMaterial;
  private hairMaterial!: THREE.MeshPhysicalMaterial;
  private browMaterial!: THREE.MeshStandardMaterial;
  private diaperMaterial!: THREE.MeshPhysicalMaterial;

  // Grupos de cuerpo & ropa
  private diaperGroup!: THREE.Group;
  private bareFeetToes: THREE.Object3D[] = [];

  private topLayer!: THREE.Group;
  private topTorsoMesh!: THREE.Mesh;
  private topCollarMesh!: THREE.Mesh;
  private topHemMesh!: THREE.Mesh;
  private topPlacketGroup!: THREE.Group;
  private topUpperSleeveL!: THREE.Mesh;
  private topUpperSleeveR!: THREE.Mesh;
  private topForearmSleeveL!: THREE.Group;
  private topForearmSleeveR!: THREE.Group;
  private topFrontPatch!: THREE.Mesh;

  private bottomLayer!: THREE.Group;
  private bottomWaistband!: THREE.Mesh;
  private bottomPelvisMesh!: THREE.Mesh;
  private bottomLegLeft!: THREE.Group;
  private bottomLegRight!: THREE.Group;
  private bottomLegUpperLeft!: THREE.Mesh;
  private bottomLegLowerLeft!: THREE.Mesh;
  private bottomCuffLeft!: THREE.Mesh;
  private bottomLegUpperRight!: THREE.Mesh;
  private bottomLegLowerRight!: THREE.Mesh;
  private bottomCuffRight!: THREE.Mesh;
  private bottomSkirtMesh!: THREE.Mesh;

  private shoesLayer!: THREE.Group;
  private shoeUpperLeft!: THREE.Mesh;
  private shoeUpperRight!: THREE.Mesh;
  private shoeToeLeft!: THREE.Mesh;
  private shoeToeRight!: THREE.Mesh;

  private accessoryLayer!: THREE.Group;
  private hatGroup!: THREE.Group;
  private hatMesh!: THREE.Mesh;
  private hatBrim!: THREE.Mesh;
  private hatPomPom!: THREE.Mesh;
  private bibGroup!: THREE.Group;
  private bibMesh!: THREE.Mesh;

  // Rotación & animación
  private isDragging = false;
  private previousPointer = { x: 0, y: 0 };
  private targetRotationY = 0;
  private targetPitchX = 0.03;
  private autoRotate = false;
  private animationFrameId = 0;
  private isDestroyed = false;

  private nextBlinkAt = 2.4;
  private blinkTimer = -1;

  // Texturas dinámicas para disposición limpia
  private activeHeadTexture: THREE.Texture | null = null;
  private activeBodyTexture: THREE.Texture | null = null;
  private activeEyeTexture: THREE.Texture | null = null;
  private activeHairTextures: { map: THREE.Texture; bump: THREE.Texture } | null = null;
  private activePhotoFaceTexture: THREE.Texture | null = null;
  private activeClothingTexture: THREE.Texture | null = null;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;

  public state: WardrobeState;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;

    this.fabricBumpMap = createFabricTexture();
    this.ribbedBumpMap = createRibbedKnitBumpTexture();
    this.skinBumpMap = createSkinBumpTexture();
    this.headRoughnessMap = createHeadRoughnessTexture();
    this.state = this.loadState();

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xfff6ee, 0.045);

    const width = this.container.clientWidth || 360;
    const height = this.container.clientHeight || 440;
    this.camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 40);
    this.camera.position.set(0, 0.56, 3.62);
    this.camera.lookAt(0, 0.44, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareWebGL,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(isSoftwareWebGL ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !isSoftwareWebGL;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.babyRoot = new THREE.Group();
    this.scene.add(this.babyRoot);

    this.setupStudioEnvironment();
    this.setupLighting();
    this.setupStudioBackdrop();
    this.initMaterials();
    this.buildRealBaby();
    this.buildTailoredClothing();
    this.setupInteractions();

    this.applyTheme(this.state.backgroundTheme);
    this.refreshAppearance();
    this.updateOutfitMeshes();

    this.onWindowResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.onWindowResize);

    if (!isSoftwareWebGL) {
      this.renderer.compile(this.scene, this.camera);
    }

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
          faceMode: parsed.faceMode || 'photo',
          babyFaceUrl: parsed.babyFaceUrl || DEFAULT_BABY_FACE_URL,
          skinPreset: parsed.skinPreset && SKIN_PRESETS[parsed.skinPreset as SkinPresetKey] ? parsed.skinPreset : 'warm',
          eyePreset: parsed.eyePreset && EYE_PRESETS[parsed.eyePreset as EyePresetKey] ? parsed.eyePreset : 'brown',
          hairPreset: parsed.hairPreset && HAIR_PRESETS[parsed.hairPreset as HairPresetKey] ? parsed.hairPreset : 'dark-curls',
          showPacifier: typeof parsed.showPacifier === 'boolean' ? parsed.showPacifier : false,
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
      faceMode: 'photo',
      babyFaceUrl: DEFAULT_BABY_FACE_URL,
      skinPreset: 'warm',
      eyePreset: 'brown',
      hairPreset: 'dark-curls',
      showPacifier: false,
    };
  }

  public saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          items: this.state.items,
          currentOutfit: this.state.currentOutfit,
          savedOutfits: this.state.savedOutfits,
          backgroundTheme: this.state.backgroundTheme,
          faceMode: this.state.faceMode,
          babyFaceUrl: this.state.babyFaceUrl,
          skinPreset: this.state.skinPreset,
          eyePreset: this.state.eyePreset,
          hairPreset: this.state.hairPreset,
          showPacifier: this.state.showPacifier,
        })
      );
    } catch (e) {
      console.warn('Error saving wardrobe state:', e);
    }
  }

  private setupStudioEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();
  }

  private setupLighting() {
    // Luz hemisférica cálida de guardería/estudio
    const hemiLight = new THREE.HemisphereLight(0xfffaf3, 0xe8d0bf, 1.15);
    this.scene.add(hemiLight);

    // Key Light principal cálida con sombras suaves enfocadas al bebé
    const keyLight = new THREE.DirectionalLight(0xfff6eb, 1.85);
    keyLight.position.set(2.3, 4.1, 3.8);
    keyLight.castShadow = !isSoftwareWebGL;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 12;
    const d = 1.65;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.018;
    keyLight.shadow.radius = 3.5;
    this.scene.add(keyLight);

    // Fill Light suave desde el lado opuesto (relleno cálido-neutro)
    const fillLight = new THREE.DirectionalLight(0xffeede, 0.88);
    fillLight.position.set(-3.1, 2.0, 2.6);
    this.scene.add(fillLight);

    // Rim / Backlight para halo suave en pelo, orejas y hombros (efecto translucidez)
    const rimLight = new THREE.DirectionalLight(0xffe5c8, 1.05);
    rimLight.position.set(-0.6, 3.2, -3.4);
    this.scene.add(rimLight);

    // Bounce cálido desde el suelo del estudio hacia barbilla y ojos
    const bounceLight = new THREE.DirectionalLight(0xfff0e2, 0.35);
    bounceLight.position.set(0, -2.5, 2.2);
    this.scene.add(bounceLight);
  }

  private setupStudioBackdrop() {
    // Suelo continuo y ciclorama curvo suave de estudio fotográfico
    this.studioFloorMat = new THREE.MeshStandardMaterial({
      color: 0xf7eee5,
      roughness: 0.92,
      metalness: 0.0,
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 64), this.studioFloorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.60;
    floor.receiveShadow = true;
    this.scene.add(floor);

    this.studioBackdropMat = new THREE.MeshStandardMaterial({
      color: 0xfef7f0,
      roughness: 0.96,
      metalness: 0.0,
      side: THREE.BackSide,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(14, 32, 24), this.studioBackdropMat);
    this.scene.add(dome);
  }

  private initMaterials() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.skinBumpMap.anisotropy = maxAniso;
    this.headRoughnessMap.anisotropy = maxAniso;
    this.fabricBumpMap.anisotropy = maxAniso;
    this.ribbedBumpMap.anisotropy = maxAniso;

    const skinPreset = SKIN_PRESETS[this.state.skinPreset];

    this.skinMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.56,
      metalness: 0.0,
      sheen: 0.65,
      sheenRoughness: 0.72,
      sheenColor: new THREE.Color(skinPreset.sheen),
      clearcoat: 0.05,
      clearcoatRoughness: 0.78,
      bumpMap: this.skinBumpMap,
      bumpScale: 0.0028,
      envMapIntensity: 0.42,
    });

    this.headSculptedMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.62,
      roughnessMap: this.headRoughnessMap,
      metalness: 0.0,
      sheen: 0.68,
      sheenRoughness: 0.68,
      sheenColor: new THREE.Color(skinPreset.sheen),
      clearcoat: 0.07,
      clearcoatRoughness: 0.72,
      bumpMap: this.skinBumpMap,
      bumpScale: 0.0022,
      envMapIntensity: 0.44,
    });

    this.headPhotoMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.64,
      metalness: 0.0,
      sheen: 0.35,
      sheenRoughness: 0.72,
      sheenColor: new THREE.Color(skinPreset.sheen),
      envMapIntensity: 0.36,
    });

    this.eyeMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.14,
      metalness: 0.0,
      clearcoat: 0.85,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.15,
    });

    this.hairMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.44,
      metalness: 0.02,
      sheen: 0.52,
      sheenRoughness: 0.45,
      sheenColor: new THREE.Color('#5c473c'),
      bumpScale: 0.012,
      envMapIntensity: 0.65,
    });

    this.browMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(HAIR_PRESETS[this.state.hairPreset].brow),
      roughness: 0.68,
      metalness: 0.0,
    });

    const diaperTex = createQuiltedDiaperTexture();
    diaperTex.anisotropy = maxAniso;
    this.diaperMaterial = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      map: diaperTex,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.85,
      sheenRoughness: 0.82,
      sheenColor: new THREE.Color('#ffffff'),
      bumpMap: this.fabricBumpMap,
      bumpScale: 0.024,
    });
  }

  private buildRealBaby() {
    // 1. Sombra de contacto suave bajo los pies del bebé (sin disco rígido artificial)
    const contactShadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.45, 1.45),
      new THREE.MeshBasicMaterial({
        map: createContactShadowTexture(),
        transparent: true,
        depthWrite: false,
      })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -0.596;
    this.babyRoot.add(contactShadow);

    this.torsoPivot = new THREE.Group();
    this.babyRoot.add(this.torsoPivot);

    // 2. Cabeza de Bebé Esculpida en 3D (anatomía real: cuencas oculares, mejillas regordetas, naricita, labios y mentón)
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 1.13, 0.025);

    const headGeo = new THREE.SphereGeometry(0.365, 96, 72, -Math.PI / 2, Math.PI * 2);
    const pos = headGeo.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);

      // Frente amplia y tierna de bebé
      if (v.z > 0.08 && v.y > 0.04 && v.y < 0.28) {
        const foreW = Math.exp(-Math.pow(v.x / 0.22, 2)) * Math.exp(-Math.pow((v.y - 0.14) / 0.11, 2));
        v.z += 0.016 * foreW;
      }

      // Cuencas oculares sutiles para alojar ojos 3D reales
      if (v.z > 0.18 && v.y > -0.06 && v.y < 0.10) {
        const leftDist = Math.hypot((v.x - 0.132) / 0.075, (v.y - 0.016) / 0.055);
        const rightDist = Math.hypot((v.x + 0.132) / 0.075, (v.y - 0.016) / 0.055);
        const socket = Math.exp(-Math.pow(leftDist, 2)) + Math.exp(-Math.pow(rightDist, 2));
        v.z -= 0.026 * Math.min(1, socket);
      }

      // Mejillas bien redonditas y llenas (silueta real de tu hijo en las fotos)
      if (v.z > 0.02 && v.y < 0.04 && v.y > -0.26) {
        const cheekL = Math.exp(-Math.pow((v.x - 0.182) / 0.125, 2)) * Math.exp(-Math.pow((v.y + 0.092) / 0.105, 2));
        const cheekR = Math.exp(-Math.pow((v.x + 0.182) / 0.125, 2)) * Math.exp(-Math.pow((v.y + 0.092) / 0.105, 2));
        const cheek = cheekL + cheekR;
        v.x += Math.sign(v.x) * 0.038 * cheek;
        v.z += 0.036 * cheek;
      }

      // Naricita redondeada de botón + puente nasal suave
      if (v.z > 0.24 && Math.abs(v.x) < 0.082 && v.y > -0.10 && v.y < 0.04) {
        const bridge = Math.exp(-Math.pow(v.x / 0.038, 2)) * Math.exp(-Math.pow((v.y - 0.005) / 0.04, 2));
        const tip = Math.exp(-Math.pow(v.x / 0.052, 2)) * Math.exp(-Math.pow((v.y + 0.054) / 0.034, 2));
        const wingL = Math.exp(-Math.pow((v.x - 0.038) / 0.024, 2)) * Math.exp(-Math.pow((v.y + 0.064) / 0.022, 2));
        const wingR = Math.exp(-Math.pow((v.x + 0.038) / 0.024, 2)) * Math.exp(-Math.pow((v.y + 0.064) / 0.022, 2));
        v.z += 0.015 * bridge + 0.036 * tip + 0.018 * (wingL + wingR);
      }

      // Labios sonrientes suaves con comisuras ligeramente elevadas
      if (v.z > 0.24 && Math.abs(v.x) < 0.095 && v.y > -0.19 && v.y < -0.085) {
        const smileLift = (v.x * v.x) * 1.4;
        const vy = v.y - smileLift;
        const upperLip = Math.exp(-Math.pow(v.x / 0.058, 2)) * Math.exp(-Math.pow((vy + 0.125) / 0.016, 2));
        const seam = Math.exp(-Math.pow(v.x / 0.062, 2)) * Math.exp(-Math.pow((vy + 0.141) / 0.009, 2));
        const lowerLip = Math.exp(-Math.pow(v.x / 0.052, 2)) * Math.exp(-Math.pow((vy + 0.158) / 0.018, 2));
        v.z += 0.016 * upperLip - 0.011 * seam + 0.015 * lowerLip;
      }

      // Barbilla redonda suave y papada tierna de bebé
      if (v.y < -0.16) {
        const chin = Math.exp(-Math.pow(v.x / 0.115, 2)) * Math.exp(-Math.pow((v.y + 0.222) / 0.062, 2));
        if (v.z > 0.10) v.z += 0.018 * chin;
        v.y *= 0.93;
      }

      // Volumen posterior craneal anatómico
      if (v.z < 0 && v.y > -0.14) {
        v.z *= 1.08;
      }

      pos.setXYZ(i, v.x, v.y, v.z);
    }
    headGeo.computeVertexNormals();

    this.headMesh = new THREE.Mesh(headGeo, this.headSculptedMaterial);
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;
    this.headGroup.add(this.headMesh);

    // Orejitas esculpidas con hélice y concavidad
    this.buildSculptedEar(true);
    this.buildSculptedEar(false);

    // Rasgos faciales 3D (ojos con córnea y destellos, párpados animados, pestañas, cejas, chupete opcional)
    this.sculptedFaceGroup = new THREE.Group();
    this.buildSculpted3DEyesAndBrows();
    this.buildPacifier();
    this.headGroup.add(this.sculptedFaceGroup);

    // Cabello sedoso 3D con mechas afiladas
    this.hairGroup = new THREE.Group();
    this.headGroup.add(this.hairGroup);

    this.torsoPivot.add(this.headGroup);

    // 3. Cuello suave y gordito con transición orgánica
    const neckPoints = [
      new THREE.Vector2(0.152, 0.0),
      new THREE.Vector2(0.132, 0.05),
      new THREE.Vector2(0.126, 0.11),
      new THREE.Vector2(0.142, 0.16),
    ];
    const neckGeo = new THREE.LatheGeometry(neckPoints, 36);
    const neckMesh = new THREE.Mesh(neckGeo, this.skinMaterial);
    neckMesh.position.set(0, 0.72, 0.01);
    neckMesh.castShadow = true;
    this.torsoPivot.add(neckMesh);

    // 4. Torso anatómico continuo con pancita tierna y hombros redondeados
    const torsoPoints = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.19, 0.04),
      new THREE.Vector2(0.285, 0.12),
      new THREE.Vector2(0.305, 0.24),
      new THREE.Vector2(0.296, 0.36),
      new THREE.Vector2(0.278, 0.48),
      new THREE.Vector2(0.264, 0.58),
      new THREE.Vector2(0.158, 0.65),
      new THREE.Vector2(0.01, 0.66),
    ];
    const torsoGeo = new THREE.LatheGeometry(torsoPoints, 48);
    const tPos = torsoGeo.attributes.position;
    for (let i = 0; i < tPos.count; i++) {
      const tx = tPos.getX(i);
      const ty = tPos.getY(i);
      let tz = tPos.getZ(i);
      const bellyBulge = Math.exp(-Math.pow((ty - 0.25) / 0.14, 2));
      if (tz > 0) tz += 0.036 * bellyBulge;
      // Sutil hoyuelo del ombligo
      if (tz > 0.22 && Math.abs(tx) < 0.025 && Math.abs(ty - 0.22) < 0.022) {
        const navel = Math.exp(-Math.pow(tx / 0.014, 2)) * Math.exp(-Math.pow((ty - 0.22) / 0.014, 2));
        tz -= 0.012 * navel;
      }
      tPos.setXYZ(i, tx * 1.07, ty, tz * 0.88);
    }
    torsoGeo.computeVertexNormals();

    const torsoMesh = new THREE.Mesh(torsoGeo, this.skinMaterial);
    torsoMesh.position.set(0, 0.14, 0);
    torsoMesh.castShadow = true;
    torsoMesh.receiveShadow = true;
    this.torsoPivot.add(torsoMesh);

    // 5. Pañal acolchado realista de algodón
    this.buildBabyDiaper();

    // 6. Bracitos relajados en pose natural (codos doblados hacia adelante y deditos suavemente curvados)
    this.buildRealBabyArm(true);
    this.buildRealBabyArm(false);

    // 7. Piernitas gorditas con ligera postura natural de bebé + pies y 5 deditos esculpidos
    this.buildRealBabyLeg(true);
    this.buildRealBabyLeg(false);
  }

  private buildSculptedEar(isLeft: boolean) {
    const sign = isLeft ? 1 : -1;
    const earGroup = new THREE.Group();
    earGroup.position.set(sign * 0.348, -0.025, -0.015);
    earGroup.rotation.y = sign * 0.28;
    earGroup.rotation.z = sign * -0.10;

    // Lóbulo y pabellón exterior
    const outerEar = new THREE.Mesh(new THREE.SphereGeometry(0.072, 24, 20), this.skinMaterial);
    outerEar.scale.set(0.38, 1.08, 0.78);
    outerEar.castShadow = true;
    earGroup.add(outerEar);

    // Hélice curvada exterior
    const helix = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.015, 10, 20, Math.PI * 1.35), this.skinMaterial);
    helix.rotation.y = sign * (Math.PI / 2);
    helix.rotation.z = 0.45;
    helix.position.set(sign * 0.008, 0.008, -0.004);
    earGroup.add(helix);

    // Concavidad interior con tono cálido rosado (efecto translucidez)
    const conchaMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#c8826e'),
      roughness: 0.72,
    });
    const concha = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 16), conchaMat);
    concha.scale.set(0.28, 0.85, 0.65);
    concha.position.set(sign * 0.015, -0.004, 0.006);
    earGroup.add(concha);

    this.headGroup.add(earGroup);
  }

  private buildSculpted3DEyesAndBrows() {
    this.upperEyelids = [];
    this.eyeLookGroups = [];

    const corneaMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.02,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      envMapIntensity: 1.85,
    });

    const catchlightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lashMat = new THREE.MeshStandardMaterial({ color: 0x16100e, roughness: 0.55 });

    [-1, 1].forEach((side) => {
      const eyeSocket = new THREE.Group();
      eyeSocket.position.set(side * 0.130, 0.017, 0.282);
      eyeSocket.rotation.y = side * 0.16;
      eyeSocket.rotation.x = -0.03;

      // Grupo móvil del globo ocular (mirada sutil)
      const lookGroup = new THREE.Group();

      // Globo ocular con textura polar (polo norte apuntando +Z)
      const eyeballGeo = new THREE.SphereGeometry(0.065, 48, 36);
      const eyeball = new THREE.Mesh(eyeballGeo, this.eyeMaterial);
      eyeball.rotation.x = Math.PI / 2;
      lookGroup.add(eyeball);

      // Córnea cristalina brillante
      const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.0672, 36, 24), corneaMat);
      lookGroup.add(cornea);

      // Dos destellos vivos de estudio en los ojos (estilo Pixar)
      const glint1 = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 10), catchlightMat);
      glint1.position.set(-0.018, 0.021, 0.064);
      glint1.scale.set(1.15, 0.9, 0.4);
      lookGroup.add(glint1);

      const glint2 = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 8, 8), catchlightMat);
      glint2.position.set(0.016, -0.014, 0.065);
      glint2.scale.set(1, 1, 0.4);
      lookGroup.add(glint2);

      eyeSocket.add(lookGroup);
      this.eyeLookGroups.push(lookGroup);

      // Párpado superior animado (hemisferio superior exacto con borde en y=0, z=+0.070)
      const upperLidGeo = new THREE.SphereGeometry(0.0695, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.50);
      const upperLid = new THREE.Mesh(upperLidGeo, this.skinMaterial);
      upperLid.rotation.x = -0.78;
      upperLid.castShadow = true;

      // Línea suave de pestañas superiores siguiendo exactamente el borde del párpado
      const lashCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.056, -0.002, 0.042),
        new THREE.Vector3(-0.028, 0.001, 0.064),
        new THREE.Vector3(0.0, 0.002, 0.0705),
        new THREE.Vector3(0.028, 0.001, 0.064),
        new THREE.Vector3(0.056, -0.002, 0.042),
      ]);
      const lashGeo = createTaperedHairLockGeometry(lashCurve, 18, 6, 0.0038, 0.65);
      const lashMesh = new THREE.Mesh(lashGeo, lashMat);
      upperLid.add(lashMesh);

      eyeSocket.add(upperLid);
      this.upperEyelids.push(upperLid);

      // Párpado inferior suave acunando la base del iris
      const lowerLidGeo = new THREE.SphereGeometry(0.0688, 28, 14, 0, Math.PI * 2, Math.PI * 0.56, Math.PI * 0.42);
      const lowerLid = new THREE.Mesh(lowerLidGeo, this.skinMaterial);
      lowerLid.rotation.x = 0.26;
      eyeSocket.add(lowerLid);

      this.sculptedFaceGroup.add(eyeSocket);

      // Ceja suave y tierna ligeramente arqueada
      const browCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.078, 0.106, 0.328),
        new THREE.Vector3(side * 0.122, 0.119, 0.318),
        new THREE.Vector3(side * 0.168, 0.114, 0.292),
        new THREE.Vector3(side * 0.200, 0.098, 0.264),
      ]);
      const browGeo = createTaperedHairLockGeometry(browCurve, 16, 6, 0.0085, 0.45);
      const brow = new THREE.Mesh(browGeo, this.browMaterial);
      this.sculptedFaceGroup.add(brow);
    });
  }

  private buildPacifier() {
    this.pacifierGroup = new THREE.Group();
    this.pacifierGroup.position.set(0, -0.145, 0.348);
    this.pacifierGroup.rotation.x = 0.14;

    const shieldMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#5da9e9'),
      roughness: 0.22,
      metalness: 0.02,
      clearcoat: 0.75,
      clearcoatRoughness: 0.15,
    });

    const knobMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f0c888'),
      roughness: 0.28,
      metalness: 0.04,
      clearcoat: 0.6,
    });

    // Escudo tipo mariposa suave
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(0, -0.026);
    shieldShape.bezierCurveTo(0.045, -0.045, 0.088, -0.015, 0.082, 0.018);
    shieldShape.bezierCurveTo(0.076, 0.048, 0.036, 0.046, 0.016, 0.024);
    shieldShape.bezierCurveTo(0.006, 0.016, -0.006, 0.016, -0.016, 0.024);
    shieldShape.bezierCurveTo(-0.036, 0.046, -0.076, 0.048, -0.082, 0.018);
    shieldShape.bezierCurveTo(-0.088, -0.015, -0.045, -0.045, 0, -0.026);

    const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.004,
      bevelSegments: 4,
    });
    shieldGeo.center();
    const sPos = shieldGeo.attributes.position;
    for (let i = 0; i < sPos.count; i++) {
      const sx = sPos.getX(i);
      const sz = sPos.getZ(i);
      // Curvatura envolvente alrededor de los labios
      sPos.setZ(i, sz - (sx * sx) * 2.1);
    }
    shieldGeo.computeVertexNormals();

    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.castShadow = true;
    this.pacifierGroup.add(shield);

    // Botón central y aro del chupete
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.031, 0.022, 24), knobMat);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = 0.012;
    cap.castShadow = true;
    this.pacifierGroup.add(cap);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.0065, 12, 28), shieldMat);
    ring.position.set(0, -0.026, 0.028);
    ring.rotation.x = 0.55;
    ring.castShadow = true;
    this.pacifierGroup.add(ring);

    this.sculptedFaceGroup.add(this.pacifierGroup);
  }

  private rebuildBabyHair() {
    // Limpiar mechas anteriores liberando geometrías
    while (this.hairGroup.children.length > 0) {
      const child = this.hairGroup.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      this.hairGroup.remove(child);
    }

    const preset = HAIR_PRESETS[this.state.hairPreset];
    if (this.activeHairTextures) {
      this.activeHairTextures.map.dispose();
      this.activeHairTextures.bump.dispose();
    }
    this.activeHairTextures = createHairStrandTexture(preset);
    this.activeHairTextures.map.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.hairMaterial.map = this.activeHairTextures.map;
    this.hairMaterial.bumpMap = this.activeHairTextures.bump;
    this.hairMaterial.sheenColor.set(preset.sheen);
    this.hairMaterial.needsUpdate = true;

    this.browMaterial.color.set(preset.brow);

    // 1. Casquete suave pegado al cráneo (sin borde duro)
    const capGeo = new THREE.SphereGeometry(0.369, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const capMesh = new THREE.Mesh(capGeo, this.hairMaterial);
    capMesh.rotation.x = -0.32;
    capMesh.position.set(0, 0.015, -0.022);
    capMesh.castShadow = true;
    this.hairGroup.add(capMesh);

    const addLock = (pts: Array<[number, number, number]>, radius: number, flatten = 0.45, tubular = 22) => {
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      const geo = createTaperedHairLockGeometry(curve, tubular, 8, radius, flatten);
      const mesh = new THREE.Mesh(geo, this.hairMaterial);
      mesh.castShadow = true;
      this.hairGroup.add(mesh);
    };

    if (preset.style === 'swoop') {
      // Peinado liso suave con flequillo lateral (estilo imagen de referencia)
      addLock([[-0.06, 0.34, 0.04], [-0.14, 0.31, 0.16], [-0.04, 0.25, 0.28], [0.12, 0.21, 0.29], [0.22, 0.19, 0.22]], 0.055, 0.36, 26);
      addLock([[-0.12, 0.32, 0.08], [-0.10, 0.29, 0.21], [0.02, 0.23, 0.30], [0.16, 0.19, 0.26]], 0.048, 0.36, 24);
      addLock([[0.04, 0.35, 0.03], [0.15, 0.31, 0.14], [0.24, 0.23, 0.21], [0.29, 0.14, 0.17]], 0.046, 0.36, 22);
      addLock([[-0.18, 0.29, 0.06], [-0.26, 0.22, 0.15], [-0.31, 0.12, 0.15], [-0.33, 0.04, 0.09]], 0.042, 0.38, 22);
      // Capas posteriores sedosas
      for (let i = -3; i <= 3; i++) {
        const x = i * 0.085;
        addLock([[x * 0.4, 0.36, -0.02], [x * 0.9, 0.29, -0.18], [x, 0.14, -0.32], [x * 0.85, -0.06, -0.35]], 0.056, 0.34, 22);
      }
      return;
    }

    if (preset.style === 'waves') {
      // Ondas suaves castañas con volumen natural
      for (let i = -4; i <= 4; i++) {
        const x = i * 0.072;
        const zFront = 0.25 - Math.abs(i) * 0.025;
        addLock(
          [
            [x * 0.3, 0.36, 0.02],
            [x * 0.85, 0.30, zFront * 0.65],
            [x * 1.15 + (i % 2 === 0 ? 0.03 : -0.03), 0.22, zFront],
            [x * 1.25, 0.14, zFront - 0.04],
          ],
          0.042,
          0.42,
          22
        );
      }
      for (let i = -3; i <= 3; i++) {
        const x = i * 0.09;
        addLock(
          [
            [x * 0.4, 0.35, -0.04],
            [x * 0.95, 0.26, -0.22],
            [x * 1.05 + 0.03, 0.10, -0.34],
            [x * 0.95, -0.08, -0.34],
          ],
          0.052,
          0.42,
          22
        );
      }
      return;
    }

    // Default: 'curls' (Rizos oscuros sedosos en S y espirales suaves, como el bebé del usuario)
    const curlSpecs: Array<{ pts: Array<[number, number, number]>; r: number }> = [
      // Flequillo de rizos suaves enmarcando la frente sin tapar los ojos
      { pts: [[-0.04, 0.34, 0.10], [-0.10, 0.27, 0.24], [-0.04, 0.21, 0.30], [0.02, 0.20, 0.29]], r: 0.038 },
      { pts: [[0.03, 0.34, 0.10], [0.11, 0.27, 0.24], [0.07, 0.20, 0.29], [0.13, 0.18, 0.27]], r: 0.038 },
      { pts: [[-0.14, 0.31, 0.10], [-0.21, 0.23, 0.22], [-0.15, 0.17, 0.27], [-0.20, 0.14, 0.25]], r: 0.036 },
      { pts: [[0.14, 0.31, 0.10], [0.22, 0.23, 0.22], [0.17, 0.17, 0.27], [0.23, 0.14, 0.24]], r: 0.036 },
      // Coronilla con volumen natural rizado
      { pts: [[0.0, 0.36, -0.02], [-0.06, 0.39, 0.06], [0.04, 0.37, 0.15], [-0.02, 0.32, 0.22]], r: 0.044 },
      { pts: [[-0.10, 0.35, 0.0], [-0.18, 0.35, 0.08], [-0.12, 0.30, 0.18], [-0.18, 0.26, 0.23]], r: 0.042 },
      { pts: [[0.10, 0.35, 0.0], [0.18, 0.35, 0.08], [0.13, 0.30, 0.18], [0.19, 0.25, 0.23]], r: 0.042 },
      // Sienes y laterales sobre las orejitas
      { pts: [[-0.22, 0.26, 0.05], [-0.30, 0.19, 0.12], [-0.33, 0.11, 0.08], [-0.35, 0.06, 0.12]], r: 0.036 },
      { pts: [[0.22, 0.26, 0.05], [0.30, 0.19, 0.12], [0.33, 0.11, 0.08], [0.35, 0.06, 0.12]], r: 0.036 },
      { pts: [[-0.26, 0.21, -0.06], [-0.34, 0.14, -0.02], [-0.36, 0.05, -0.06], [-0.34, -0.02, -0.02]], r: 0.038 },
      { pts: [[0.26, 0.21, -0.06], [0.34, 0.14, -0.02], [0.36, 0.05, -0.06], [0.34, -0.02, -0.02]], r: 0.038 },
      // Parte trasera y nuca con rizos escalonados
      { pts: [[0.0, 0.34, -0.10], [-0.06, 0.27, -0.26], [0.05, 0.16, -0.35], [-0.03, 0.05, -0.38]], r: 0.048 },
      { pts: [[-0.12, 0.31, -0.10], [-0.20, 0.23, -0.25], [-0.13, 0.11, -0.34], [-0.19, 0.0, -0.35]], r: 0.046 },
      { pts: [[0.12, 0.31, -0.10], [0.20, 0.23, -0.25], [0.13, 0.11, -0.34], [0.19, 0.0, -0.35]], r: 0.046 },
      { pts: [[-0.22, 0.22, -0.14], [-0.30, 0.12, -0.24], [-0.24, 0.01, -0.31], [-0.27, -0.08, -0.29]], r: 0.042 },
      { pts: [[0.22, 0.22, -0.14], [0.30, 0.12, -0.24], [0.24, 0.01, -0.31], [0.27, -0.08, -0.29]], r: 0.042 },
      // Rizos bajos en la nuca
      { pts: [[-0.08, 0.06, -0.35], [-0.13, -0.05, -0.37], [-0.07, -0.14, -0.34]], r: 0.036 },
      { pts: [[0.08, 0.06, -0.35], [0.13, -0.05, -0.37], [0.07, -0.14, -0.34]], r: 0.036 },
      { pts: [[0.0, 0.04, -0.36], [0.03, -0.07, -0.37], [-0.02, -0.16, -0.33]], r: 0.036 },
    ];

    curlSpecs.forEach(({ pts, r }) => addLock(pts, r, 0.48, 22));
  }

  private buildBabyDiaper() {
    this.diaperGroup = new THREE.Group();

    const diaperPoints = [
      new THREE.Vector2(0.02, 0.0),
      new THREE.Vector2(0.185, 0.035),
      new THREE.Vector2(0.302, 0.11),
      new THREE.Vector2(0.322, 0.22),
      new THREE.Vector2(0.308, 0.30),
      new THREE.Vector2(0.01, 0.30),
    ];
    const diaperGeo = new THREE.LatheGeometry(diaperPoints, 44);
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

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xe6d6c3,
      roughness: 0.85,
      bumpMap: this.ribbedBumpMap,
      bumpScale: 0.02,
    });

    const bandGeo = new THREE.TorusGeometry(0.308, 0.022, 12, 48);
    const band = new THREE.Mesh(bandGeo, trimMat);
    band.rotation.x = Math.PI / 2;
    band.scale.set(1.07, 0.90, 1);
    band.position.y = 0.425;
    this.diaperGroup.add(band);

    this.torsoPivot.add(this.diaperGroup);
  }

  private buildRealBabyArm(isLeft: boolean) {
    const sign = isLeft ? 1 : -1;
    const armRoot = new THREE.Group();
    armRoot.position.set(sign * 0.275, 0.71, 0.015);
    armRoot.rotation.z = sign * -0.24;
    armRoot.rotation.x = -0.14;

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.094, 24, 24), this.skinMaterial);
    shoulder.castShadow = true;
    armRoot.add(shoulder);

    // Brazo superior gordito
    const upperArmPoints = [
      new THREE.Vector2(0.090, 0.0),
      new THREE.Vector2(0.096, -0.075),
      new THREE.Vector2(0.088, -0.165),
      new THREE.Vector2(0.074, -0.225),
    ];
    const upperArm = new THREE.Mesh(new THREE.LatheGeometry(upperArmPoints, 28), this.skinMaterial);
    upperArm.castShadow = true;
    armRoot.add(upperArm);

    // Antebrazo doblado naturalmente hacia el frente (pose orgánica de bebé)
    const forearmGroup = new THREE.Group();
    forearmGroup.position.set(0, -0.215, 0);
    forearmGroup.rotation.x = -0.52;
    forearmGroup.rotation.z = sign * 0.14;

    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.074, 20, 20), this.skinMaterial);
    forearmGroup.add(elbow);

    const forearmPoints = [
      new THREE.Vector2(0.073, 0.0),
      new THREE.Vector2(0.082, -0.065),
      new THREE.Vector2(0.070, -0.145),
      new THREE.Vector2(0.050, -0.195), // Pliegue gordito de muñeca
      new THREE.Vector2(0.058, -0.215),
    ];
    const forearm = new THREE.Mesh(new THREE.LatheGeometry(forearmPoints, 28), this.skinMaterial);
    forearm.castShadow = true;
    forearmGroup.add(forearm);

    // Manita natural con dedos suavemente curvados en 2 falanges
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.235, 0.012);
    handGroup.rotation.z = sign * 0.08;
    handGroup.rotation.y = sign * -0.25;

    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.056, 22, 20), this.skinMaterial);
    palm.scale.set(0.86, 1.05, 0.62);
    palm.castShadow = true;
    handGroup.add(palm);

    // Pulgar articulado suavemente
    const thumbPivot = new THREE.Group();
    thumbPivot.position.set(sign * -0.040, -0.010, 0.024);
    thumbPivot.rotation.z = sign * -0.55;
    thumbPivot.rotation.x = -0.42;
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.0155, 0.032, 6, 12), this.skinMaterial);
    thumb.position.y = -0.016;
    thumbPivot.add(thumb);
    handGroup.add(thumbPivot);

    // 4 deditos con doble falange ligeramente flexionada hacia la palma
    const fingerOffsets = [-0.026, -0.0085, 0.009, 0.025];
    const fingerLengths = [0.028, 0.034, 0.032, 0.024];
    fingerOffsets.forEach((fx, idx) => {
      const fBase = new THREE.Group();
      fBase.position.set(fx * sign, -0.044, 0.008);
      fBase.rotation.x = -0.45 - idx * 0.04;

      const p1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, fingerLengths[idx] * 0.6, 6, 10), this.skinMaterial);
      p1.position.y = -fingerLengths[idx] * 0.35;
      fBase.add(p1);

      const fTip = new THREE.Group();
      fTip.position.y = -fingerLengths[idx] * 0.65;
      fTip.rotation.x = -0.55;
      const p2 = new THREE.Mesh(new THREE.CapsuleGeometry(0.0108, fingerLengths[idx] * 0.5, 6, 10), this.skinMaterial);
      p2.position.y = -fingerLengths[idx] * 0.28;
      fTip.add(p2);

      fBase.add(fTip);
      handGroup.add(fBase);
    });

    forearmGroup.add(handGroup);
    armRoot.add(forearmGroup);
    this.torsoPivot.add(armRoot);
  }

  private buildRealBabyLeg(isLeft: boolean) {
    const sign = isLeft ? 1 : -1;
    const legRoot = new THREE.Group();
    legRoot.position.set(sign * 0.146, 0.17, 0.01);
    legRoot.rotation.z = sign * 0.05;
    legRoot.rotation.y = sign * 0.12; // Pies naturalmente abiertos ~7°

    // Muslo gordito ligeramente inclinado hacia adelante
    const thighGroup = new THREE.Group();
    thighGroup.rotation.x = -0.08;

    const thighPoints = [
      new THREE.Vector2(0.135, 0.0),
      new THREE.Vector2(0.144, -0.10),
      new THREE.Vector2(0.128, -0.22),
      new THREE.Vector2(0.104, -0.32),
      new THREE.Vector2(0.098, -0.35),
    ];
    const thigh = new THREE.Mesh(new THREE.LatheGeometry(thighPoints, 32), this.skinMaterial);
    thigh.castShadow = true;
    thigh.receiveShadow = true;
    thighGroup.add(thigh);

    // Rodilla suave + pantorrilla ligeramente flexionada atrás para equilibrio natural
    const calfGroup = new THREE.Group();
    calfGroup.position.set(0, -0.345, 0.005);
    calfGroup.rotation.x = 0.09;

    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.098, 24, 24), this.skinMaterial);
    calfGroup.add(knee);

    const calfPoints = [
      new THREE.Vector2(0.098, 0.0),
      new THREE.Vector2(0.106, -0.10),
      new THREE.Vector2(0.092, -0.22),
      new THREE.Vector2(0.066, -0.31), // Pliegue de tobillo
      new THREE.Vector2(0.072, -0.34),
    ];
    const calf = new THREE.Mesh(new THREE.LatheGeometry(calfPoints, 32), this.skinMaterial);
    calf.castShadow = true;
    calfGroup.add(calf);

    // Pie suave de bebé apoyado en el suelo + 5 deditos esculpidos
    const footGroup = new THREE.Group();
    footGroup.position.set(0, -0.365, 0.042);
    footGroup.rotation.x = -0.01;

    const footBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.066, 0.11, 10, 20), this.skinMaterial);
    footBody.rotation.x = Math.PI / 2;
    footBody.scale.set(1.06, 1.0, 0.76);
    footBody.castShadow = true;
    footBody.receiveShadow = true;
    footGroup.add(footBody);

    const toesGroup = new THREE.Group();
    for (let t = 0; t < 5; t++) {
      const toeRadius = t === 0 ? 0.023 : 0.0175 - t * 0.0015;
      const toe = new THREE.Mesh(new THREE.SphereGeometry(toeRadius, 14, 14), this.skinMaterial);
      const xPos = sign * (-0.042 + t * 0.021); // Pulgar hacia el interior del pie
      const zPos = 0.096 - t * 0.006;
      toe.position.set(xPos, -0.018, zPos);
      toe.scale.set(0.95, 0.84, 1.22);
      toe.castShadow = true;
      toesGroup.add(toe);
    }
    footGroup.add(toesGroup);
    this.bareFeetToes.push(toesGroup);

    calfGroup.add(footGroup);
    thighGroup.add(calfGroup);
    legRoot.add(thighGroup);
    this.torsoPivot.add(legRoot);
  }

  private buildTailoredClothing() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.fabricBumpMap.anisotropy = maxAniso;

    // --- 1. TOPS (Con pliegues suaves de tela, puños acanalados y tapeta de botones) ---
    this.topLayer = new THREE.Group();

    const topMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.0,
      sheen: 0.85,
      sheenRoughness: 0.8,
      sheenColor: new THREE.Color('#ffffff'),
      bumpMap: this.fabricBumpMap,
      bumpScale: 0.032,
    });

    const trimMat = new THREE.MeshPhysicalMaterial({
      color: 0xf4ece4,
      roughness: 0.88,
      sheen: 0.75,
      sheenRoughness: 0.82,
      bumpMap: this.ribbedBumpMap,
      bumpScale: 0.045,
    });

    const shirtPoints = [
      new THREE.Vector2(0.01, 0.0),
      new THREE.Vector2(0.312, 0.02),
      new THREE.Vector2(0.324, 0.16),
      new THREE.Vector2(0.315, 0.30),
      new THREE.Vector2(0.302, 0.42),
      new THREE.Vector2(0.286, 0.51),
      new THREE.Vector2(0.168, 0.57),
      new THREE.Vector2(0.01, 0.58),
    ];
    const shirtGeo = new THREE.LatheGeometry(shirtPoints, 56);
    const sPos = shirtGeo.attributes.position;
    for (let i = 0; i < sPos.count; i++) {
      const sx = sPos.getX(i);
      const sy = sPos.getY(i);
      let sz = sPos.getZ(i);
      const angle = Math.atan2(sz, sx);
      const bulge = Math.exp(-Math.pow((sy - 0.18) / 0.14, 2));
      // Pliegues naturales suaves de algodón en cintura y laterales
      const fold = 0.005 * Math.sin(sy * 38 + angle * 3) * (1 - Math.abs(sy - 0.3) * 1.4);
      if (sz > 0) sz += 0.035 * bulge;
      sPos.setXYZ(i, sx * 1.078 + Math.cos(angle) * fold, sy, sz * 0.895 + Math.sin(angle) * fold);
    }
    shirtGeo.computeVertexNormals();

    this.topTorsoMesh = new THREE.Mesh(shirtGeo, topMat);
    this.topTorsoMesh.position.y = 0.22;
    this.topTorsoMesh.castShadow = true;
    this.topTorsoMesh.receiveShadow = true;
    this.topLayer.add(this.topTorsoMesh);

    // Parche frontal para mostrar la foto real de la prenda subida
    const patchGeo = new THREE.CylinderGeometry(0.308, 0.320, 0.38, 36, 1, true, -0.58, 1.16);
    const patchMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.65,
      transparent: true,
      opacity: 0.94,
    });
    this.topFrontPatch = new THREE.Mesh(patchGeo, patchMat);
    this.topFrontPatch.position.set(0, 0.50, 0.012);
    this.topFrontPatch.scale.set(1.045, 1, 0.935);
    this.topFrontPatch.visible = false;
    this.topLayer.add(this.topFrontPatch);

    // Cuello y dobladillo en punto acanalado
    this.topCollarMesh = new THREE.Mesh(new THREE.TorusGeometry(0.168, 0.023, 14, 42), trimMat);
    this.topCollarMesh.rotation.x = Math.PI / 2;
    this.topCollarMesh.position.set(0, 0.785, 0.005);
    this.topLayer.add(this.topCollarMesh);

    this.topHemMesh = new THREE.Mesh(new THREE.TorusGeometry(0.312, 0.019, 14, 48), trimMat);
    this.topHemMesh.rotation.x = Math.PI / 2;
    this.topHemMesh.scale.set(1.07, 0.89, 1);
    this.topHemMesh.position.set(0, 0.23, 0);
    this.topLayer.add(this.topHemMesh);

    // Tapeta frontal con botoncitos de madera/nácar
    this.topPlacketGroup = new THREE.Group();
    const buttonMat = new THREE.MeshStandardMaterial({ color: 0xe7d2b5, roughness: 0.45, metalness: 0.08 });
    [0.69, 0.57, 0.45, 0.33].forEach((by) => {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.008, 16), buttonMat);
      btn.rotation.x = Math.PI / 2;
      const zCurve = by > 0.6 ? 0.265 : 0.285;
      btn.position.set(0, by, zCurve);
      this.topPlacketGroup.add(btn);
    });
    this.topLayer.add(this.topPlacketGroup);

    // Mangas articuladas siguiendo la postura natural del brazo del bebé
    const upperSleevePoints = [
      new THREE.Vector2(0.105, 0.02),
      new THREE.Vector2(0.114, -0.07),
      new THREE.Vector2(0.106, -0.15),
      new THREE.Vector2(0.095, -0.21),
    ];
    const upperSleeveGeo = new THREE.LatheGeometry(upperSleevePoints, 28);
    const forearmSleevePoints = [
      new THREE.Vector2(0.090, 0.01),
      new THREE.Vector2(0.096, -0.07),
      new THREE.Vector2(0.086, -0.14),
      new THREE.Vector2(0.072, -0.19),
    ];
    const forearmSleeveGeo = new THREE.LatheGeometry(forearmSleevePoints, 28);
    const cuffGeo = new THREE.TorusGeometry(0.073, 0.015, 12, 28);

    const buildArmSleeve = (sign: number) => {
      const upper = new THREE.Mesh(upperSleeveGeo, topMat);
      upper.position.set(sign * 0.275, 0.71, 0.015);
      upper.rotation.z = sign * -0.24;
      upper.rotation.x = -0.14;
      upper.castShadow = true;

      const lowerGroup = new THREE.Group();
      lowerGroup.position.set(0, -0.215, 0);
      lowerGroup.rotation.x = -0.52;
      lowerGroup.rotation.z = sign * 0.14;

      const lower = new THREE.Mesh(forearmSleeveGeo, topMat);
      lower.castShadow = true;
      lowerGroup.add(lower);

      const cuff = new THREE.Mesh(cuffGeo, trimMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.19;
      lowerGroup.add(cuff);

      upper.add(lowerGroup);
      this.topLayer.add(upper);
      return { upper, lowerGroup };
    };

    const leftArmSleeve = buildArmSleeve(1);
    const rightArmSleeve = buildArmSleeve(-1);
    this.topUpperSleeveL = leftArmSleeve.upper;
    this.topForearmSleeveL = leftArmSleeve.lowerGroup;
    this.topUpperSleeveR = rightArmSleeve.upper;
    this.topForearmSleeveR = rightArmSleeve.lowerGroup;

    this.topLayer.visible = false;
    this.torsoPivot.add(this.topLayer);

    // --- 2. BOTTOMS (Pantalones, Shorts, Faldas con pliegues y puños) ---
    this.bottomLayer = new THREE.Group();

    const bottomMat = new THREE.MeshPhysicalMaterial({
      color: 0x3d5c7a,
      roughness: 0.88,
      metalness: 0.0,
      sheen: 0.75,
      sheenRoughness: 0.84,
      bumpMap: this.fabricBumpMap,
      bumpScale: 0.048,
    });

    this.bottomWaistband = new THREE.Mesh(new THREE.TorusGeometry(0.312, 0.026, 14, 48), bottomMat);
    this.bottomWaistband.rotation.x = Math.PI / 2;
    this.bottomWaistband.scale.set(1.08, 0.90, 1);
    this.bottomWaistband.position.y = 0.42;
    this.bottomLayer.add(this.bottomWaistband);

    const pelvisPoints = [
      new THREE.Vector2(0.02, 0.0),
      new THREE.Vector2(0.205, 0.04),
      new THREE.Vector2(0.318, 0.14),
      new THREE.Vector2(0.322, 0.28),
      new THREE.Vector2(0.01, 0.28),
    ];
    const pelvisGeo = new THREE.LatheGeometry(pelvisPoints, 42);
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

    const pantUpperPoints = [
      new THREE.Vector2(0.152, 0.0),
      new THREE.Vector2(0.158, -0.14),
      new THREE.Vector2(0.138, -0.28),
      new THREE.Vector2(0.125, -0.35),
    ];
    const pantUpperGeo = new THREE.LatheGeometry(pantUpperPoints, 32);

    const pantLowerPoints = [
      new THREE.Vector2(0.122, 0.0),
      new THREE.Vector2(0.128, -0.12),
      new THREE.Vector2(0.114, -0.23),
      new THREE.Vector2(0.096, -0.29),
    ];
    const pantLowerGeo = new THREE.LatheGeometry(pantLowerPoints, 32);
    const pantCuffGeo = new THREE.TorusGeometry(0.095, 0.018, 12, 28);

    const buildPantLeg = (sign: number) => {
      const root = new THREE.Group();
      root.position.set(sign * 0.146, 0.17, 0.01);
      root.rotation.z = sign * 0.05;
      root.rotation.y = sign * 0.12;

      const upperWrap = new THREE.Group();
      upperWrap.rotation.x = -0.08;
      const upper = new THREE.Mesh(pantUpperGeo, bottomMat);
      upper.castShadow = true;
      upperWrap.add(upper);

      const lowerWrap = new THREE.Group();
      lowerWrap.position.set(0, -0.345, 0.005);
      lowerWrap.rotation.x = 0.09;
      const lower = new THREE.Mesh(pantLowerGeo, bottomMat);
      lower.castShadow = true;
      lowerWrap.add(lower);

      const cuff = new THREE.Mesh(pantCuffGeo, trimMat);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.29;
      lowerWrap.add(cuff);

      upperWrap.add(lowerWrap);
      root.add(upperWrap);
      this.bottomLayer.add(root);
      return { root, upper, lower, cuff };
    };

    const pL = buildPantLeg(1);
    const pR = buildPantLeg(-1);
    this.bottomLegLeft = pL.root;
    this.bottomLegUpperLeft = pL.upper;
    this.bottomLegLowerLeft = pL.lower;
    this.bottomCuffLeft = pL.cuff;

    this.bottomLegRight = pR.root;
    this.bottomLegUpperRight = pR.upper;
    this.bottomLegLowerRight = pR.lower;
    this.bottomCuffRight = pR.cuff;

    const skirtGeo = new THREE.CylinderGeometry(0.32, 0.45, 0.36, 42, 1, false);
    this.bottomSkirtMesh = new THREE.Mesh(skirtGeo, bottomMat);
    this.bottomSkirtMesh.position.y = 0.24;
    this.bottomSkirtMesh.scale.set(1.06, 1, 0.92);
    this.bottomSkirtMesh.visible = false;
    this.bottomLayer.add(this.bottomSkirtMesh);

    this.bottomLayer.visible = false;
    this.torsoPivot.add(this.bottomLayer);

    // --- 3. CALZADO ---
    this.shoesLayer = new THREE.Group();
    const shoeUpperMat = new THREE.MeshPhysicalMaterial({ color: 0xcac5bf, roughness: 0.62, metalness: 0.02, sheen: 0.4 });
    const shoeSoleMat = new THREE.MeshStandardMaterial({ color: 0xfbf9f6, roughness: 0.55 });
    const shoeStrapMat = new THREE.MeshStandardMaterial({ color: 0xf4eee8, roughness: 0.68 });

    const createBabyShoe = (sign: number) => {
      const g = new THREE.Group();
      g.position.set(sign * 0.184, -0.538, 0.052);
      g.rotation.z = sign * 0.025;
      g.rotation.y = sign * 0.12;

      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.074, 0.105, 10, 20), shoeUpperMat);
      upper.rotation.x = Math.PI / 2;
      upper.scale.set(1.08, 1.02, 0.84);
      upper.castShadow = true;
      g.add(upper);

      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.076, 18, 18), shoeUpperMat);
      toe.position.set(0, -0.005, 0.055);
      toe.scale.set(1.06, 0.78, 1.0);
      g.add(toe);

      const sole = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.115, 8, 20), shoeSoleMat);
      sole.rotation.x = Math.PI / 2;
      sole.position.set(0, -0.048, 0.01);
      sole.scale.set(1.08, 1.05, 0.34);
      sole.castShadow = true;
      g.add(sole);

      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.012, 8, 24, Math.PI), shoeStrapMat);
      strap.position.set(0, 0.01, 0.015);
      g.add(strap);

      return { g, upper, toe };
    };

    const leftShoe = createBabyShoe(1);
    const rightShoe = createBabyShoe(-1);
    this.shoeUpperLeft = leftShoe.upper;
    this.shoeToeLeft = leftShoe.toe;
    this.shoeUpperRight = rightShoe.upper;
    this.shoeToeRight = rightShoe.toe;

    this.shoesLayer.add(leftShoe.g, rightShoe.g);
    this.shoesLayer.visible = false;
    this.torsoPivot.add(this.shoesLayer);

    // --- 4. ACCESORIOS ---
    this.accessoryLayer = new THREE.Group();

    this.hatGroup = new THREE.Group();
    const hatMat = new THREE.MeshPhysicalMaterial({
      color: 0xe8ded1,
      roughness: 0.88,
      sheen: 0.8,
      bumpMap: this.fabricBumpMap,
      bumpScale: 0.05,
    });
    this.hatMesh = new THREE.Mesh(new THREE.SphereGeometry(0.392, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.50), hatMat);
    this.hatMesh.position.set(0, 0.06, -0.02);
    this.hatMesh.rotation.x = -0.22;
    this.hatMesh.castShadow = true;
    this.hatGroup.add(this.hatMesh);

    this.hatBrim = new THREE.Mesh(new THREE.TorusGeometry(0.378, 0.036, 14, 48), hatMat);
    this.hatBrim.rotation.x = Math.PI / 2 - 0.22;
    this.hatBrim.position.set(0, 0.08, -0.02);
    this.hatGroup.add(this.hatBrim);

    this.hatPomPom = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 16), hatMat);
    this.hatPomPom.position.set(0, 0.45, -0.10);
    this.hatGroup.add(this.hatPomPom);
    this.hatGroup.visible = false;
    this.headGroup.add(this.hatGroup);

    this.bibGroup = new THREE.Group();
    const bibMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.85,
      sheen: 0.7,
      bumpMap: this.fabricBumpMap,
      bumpScale: 0.03,
    });
    const bibTrimMat = new THREE.MeshStandardMaterial({ color: 0xdf7446, roughness: 0.8 });

    this.bibMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.305, 0.25, 32, 1, true, -0.65, 1.3), bibMat);
    this.bibMesh.position.set(0, 0.64, 0.045);
    this.bibMesh.scale.set(1.0, 1.0, 0.92);
    this.bibGroup.add(this.bibMesh);

    const bibTrim = new THREE.Mesh(new THREE.TorusGeometry(0.158, 0.018, 12, 32), bibTrimMat);
    bibTrim.rotation.x = Math.PI / 2;
    bibTrim.position.set(0, 0.77, 0.025);
    this.bibGroup.add(bibTrim);

    this.bibGroup.visible = false;
    this.accessoryLayer.add(this.bibGroup);
    this.torsoPivot.add(this.accessoryLayer);
  }

  public refreshAppearance() {
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    const skin = SKIN_PRESETS[this.state.skinPreset];
    const eye = EYE_PRESETS[this.state.eyePreset];
    const hair = HAIR_PRESETS[this.state.hairPreset];

    // 1. Piel del cuerpo y rostro esculpido
    if (this.activeBodyTexture) this.activeBodyTexture.dispose();
    this.activeBodyTexture = createBodySkinTexture(skin);
    this.activeBodyTexture.anisotropy = maxAniso;
    this.skinMaterial.map = this.activeBodyTexture;
    this.skinMaterial.sheenColor.set(skin.sheen);
    this.skinMaterial.needsUpdate = true;

    if (this.activeHeadTexture) this.activeHeadTexture.dispose();
    this.activeHeadTexture = createSculptedHeadSkinTexture(skin, hair);
    this.activeHeadTexture.anisotropy = maxAniso;
    this.headSculptedMaterial.map = this.activeHeadTexture;
    this.headSculptedMaterial.sheenColor.set(skin.sheen);
    this.headSculptedMaterial.needsUpdate = true;

    // 2. Ojos
    if (this.activeEyeTexture) this.activeEyeTexture.dispose();
    this.activeEyeTexture = createBabyEyeTexture(eye);
    this.activeEyeTexture.anisotropy = maxAniso;
    this.eyeMaterial.map = this.activeEyeTexture;
    this.eyeMaterial.needsUpdate = true;

    // 3. Cabello 3D
    this.rebuildBabyHair();

    // 4. Modo 3D esculpido vs Foto proyectada + Chupete
    const isSculpted = this.state.faceMode === 'sculpted3d';
    this.sculptedFaceGroup.visible = isSculpted;
    this.pacifierGroup.visible = isSculpted && this.state.showPacifier;
    this.headMesh.material = isSculpted ? this.headSculptedMaterial : this.headPhotoMaterial;

    if (!isSculpted) {
      this.applyPhotoFaceTexture(this.state.babyFaceUrl || DEFAULT_BABY_FACE_URL);
    }

    this.saveState();
  }

  public setSculptedAppearance(opts: Partial<{
    faceMode: FaceMode;
    skinPreset: SkinPresetKey;
    eyePreset: EyePresetKey;
    hairPreset: HairPresetKey;
    showPacifier: boolean;
  }>) {
    if (opts.faceMode) this.state.faceMode = opts.faceMode;
    if (opts.skinPreset) this.state.skinPreset = opts.skinPreset;
    if (opts.eyePreset) this.state.eyePreset = opts.eyePreset;
    if (opts.hairPreset) this.state.hairPreset = opts.hairPreset;
    if (typeof opts.showPacifier === 'boolean') this.state.showPacifier = opts.showPacifier;
    this.refreshAppearance();
  }

  public loadBabyFacePhoto(photoUrl: string) {
    this.state.faceMode = 'photo';
    this.state.babyFaceUrl = photoUrl;
    this.refreshAppearance();
  }

  private applyPhotoFaceTexture(photoUrl: string) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const texW = 1024;
      const texH = 512;
      const canvas = document.createElement('canvas');
      canvas.width = texW;
      canvas.height = texH;
      const ctx = canvas.getContext('2d')!;

      const skin = SKIN_PRESETS[this.state.skinPreset];
      const hair = HAIR_PRESETS[this.state.hairPreset];
      ctx.fillStyle = skin.base;
      ctx.fillRect(0, 0, texW, texH);

      // Sombreado craneal superior y nuca del mismo color del pelo para integración 360° perfecta
      const scalpGrad = ctx.createLinearGradient(0, 0, 0, texH * 0.44);
      scalpGrad.addColorStop(0, hair.base);
      scalpGrad.addColorStop(0.58, hair.base);
      scalpGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = scalpGrad;
      ctx.fillRect(0, 0, texW, texH * 0.44);

      const faceCanvas = document.createElement('canvas');
      const faceW = 350;
      const faceH = 330;
      faceCanvas.width = faceW;
      faceCanvas.height = faceH;
      const fCtx = faceCanvas.getContext('2d')!;

      // Recortamos la zona facial central (frente, cejas, ojos, mejillas, nariz y sonrisa) evitando los hombros
      const sx = img.width * 0.16;
      const sy = img.height * 0.22;
      const sw = img.width * 0.68;
      const sh = img.height * 0.64;
      fCtx.save();
      fCtx.filter = 'brightness(1.03) contrast(1.03) saturate(1.02)';
      fCtx.drawImage(img, sx, sy, sw, sh, 0, 0, faceW, faceH);
      fCtx.restore();

      fCtx.globalCompositeOperation = 'destination-in';
      const maskGrad = fCtx.createRadialGradient(
        faceW * 0.5, faceH * 0.50, faceW * 0.24,
        faceW * 0.5, faceH * 0.50, faceW * 0.48
      );
      maskGrad.addColorStop(0.0, 'rgba(0,0,0,1)');
      maskGrad.addColorStop(0.66, 'rgba(0,0,0,0.97)');
      maskGrad.addColorStop(0.86, 'rgba(0,0,0,0.45)');
      maskGrad.addColorStop(1.0, 'rgba(0,0,0,0)');
      fCtx.fillStyle = maskGrad;
      fCtx.fillRect(0, 0, faceW, faceH);

      ctx.drawImage(faceCanvas, texW * 0.5 - faceW * 0.5, texH * 0.54 - faceH * 0.5, faceW, faceH);

      if (this.activePhotoFaceTexture) this.activePhotoFaceTexture.dispose();
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.activePhotoFaceTexture = texture;
      this.headPhotoMaterial.map = texture;
      this.headPhotoMaterial.needsUpdate = true;
    };
    img.src = photoUrl;
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
      this.targetPitchX = Math.max(-0.20, Math.min(0.24, this.targetPitchX + dy * 0.004));
      this.previousPointer = { x: clientX, y: clientY };
    };

    const onPointerUp = () => {
      this.isDragging = false;
    };

    el.addEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onPointerUp);

    el.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches.length === 1) {
          onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches.length === 1) {
          onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
      },
      { passive: true }
    );

    window.addEventListener('touchend', onPointerUp);
  }

  public toggleAutoRotate(): boolean {
    this.autoRotate = !this.autoRotate;
    return this.autoRotate;
  }

  public applyTheme(theme: 'studio' | 'nursery' | 'minimal') {
    this.state.backgroundTheme = theme;
    let bgColor = 0xfff6ee;
    let floorColor = 0xf6ece3;
    if (theme === 'nursery') {
      bgColor = 0xebf3f8;
      floorColor = 0xe1ecf4;
    } else if (theme === 'minimal') {
      bgColor = 0xf4f4f4;
      floorColor = 0xebebeb;
    }

    this.renderer.setClearColor(bgColor, 1);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(bgColor);
    }
    this.studioBackdropMat.color.setHex(bgColor);
    this.studioFloorMat.color.setHex(floorColor);
    this.saveState();
  }

  public updateOutfitMeshes() {
    const { topId, bottomId, shoesId, accessoryId } = this.state.currentOutfit;

    // 1. Top
    const topItem = this.state.items.find((i) => i.id === topId);
    if (topItem) {
      this.topLayer.visible = true;
      const color = new THREE.Color(topItem.color || '#ffffff');
      const mat = this.topTorsoMesh.material as THREE.MeshPhysicalMaterial;
      mat.color = color;
      mat.sheenColor = color.clone().lerp(new THREE.Color('#ffffff'), 0.45);

      const trimMat = this.topCollarMesh.material as THREE.MeshPhysicalMaterial;
      trimMat.color = color.clone().lerp(new THREE.Color('#f2e6d8'), 0.35);

      const isLongSleeve = topItem.subType === 'sweater' || topItem.subType === 'jacket';
      this.topForearmSleeveL.visible = isLongSleeve;
      this.topForearmSleeveR.visible = isLongSleeve;
      this.topUpperSleeveL.scale.set(isLongSleeve ? 1.05 : 1, isLongSleeve ? 1 : 0.85, isLongSleeve ? 1.05 : 1);
      this.topUpperSleeveR.scale.set(isLongSleeve ? 1.05 : 1, isLongSleeve ? 1 : 0.85, isLongSleeve ? 1.05 : 1);

      if (topItem.photoUrl) {
        this.topPlacketGroup.visible = false;
        new THREE.TextureLoader().load(topItem.photoUrl, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
          if (this.activeClothingTexture) this.activeClothingTexture.dispose();
          this.activeClothingTexture = tex;
          const patchMat = this.topFrontPatch.material as THREE.MeshPhysicalMaterial;
          patchMat.map = tex;
          patchMat.needsUpdate = true;
          this.topFrontPatch.visible = true;
        });
      } else {
        this.topFrontPatch.visible = false;
        this.topPlacketGroup.visible = true;
      }
    } else {
      this.topLayer.visible = false;
      this.topFrontPatch.visible = false;
    }

    // 2. Bottom
    const botItem = this.state.items.find((i) => i.id === bottomId);
    if (botItem) {
      this.bottomLayer.visible = true;
      this.diaperGroup.visible = false;
      const color = new THREE.Color(botItem.color || '#3d5c7a');
      const mat = this.bottomPelvisMesh.material as THREE.MeshPhysicalMaterial;
      mat.color = color;
      mat.sheenColor = color.clone().lerp(new THREE.Color('#ffffff'), 0.35);

      if (botItem.subType === 'skirt') {
        this.bottomSkirtMesh.visible = true;
        this.bottomLegLeft.visible = false;
        this.bottomLegRight.visible = false;
      } else {
        this.bottomSkirtMesh.visible = false;
        this.bottomLegLeft.visible = true;
        this.bottomLegRight.visible = true;
        const isShorts = botItem.subType === 'shorts';
        this.bottomLegLowerLeft.visible = !isShorts;
        this.bottomLegLowerRight.visible = !isShorts;
        this.bottomCuffLeft.visible = !isShorts;
        this.bottomCuffRight.visible = !isShorts;
        this.bottomLegUpperLeft.scale.set(1, isShorts ? 0.72 : 1, 1);
        this.bottomLegUpperRight.scale.set(1, isShorts ? 0.72 : 1, 1);
      }
    } else {
      this.bottomLayer.visible = false;
      this.diaperGroup.visible = true;
    }

    // 3. Calzado
    const shoeItem = this.state.items.find((i) => i.id === shoesId);
    if (shoeItem) {
      this.shoesLayer.visible = true;
      this.bareFeetToes.forEach((t) => (t.visible = false));
      const color = new THREE.Color(shoeItem.color || '#cac5bf');
      (this.shoeUpperLeft.material as THREE.MeshPhysicalMaterial).color = color;
      (this.shoeToeLeft.material as THREE.MeshPhysicalMaterial).color = color;
      (this.shoeUpperRight.material as THREE.MeshPhysicalMaterial).color = color;
      (this.shoeToeRight.material as THREE.MeshPhysicalMaterial).color = color;
    } else {
      this.shoesLayer.visible = false;
      this.bareFeetToes.forEach((t) => (t.visible = true));
    }

    // 4. Accesorios
    const accItem = this.state.items.find((i) => i.id === accessoryId);
    if (accItem) {
      const color = new THREE.Color(accItem.color || '#e8ded1');
      if (accItem.subType === 'bib') {
        this.hatGroup.visible = false;
        this.bibGroup.visible = true;
        (this.bibMesh.material as THREE.MeshPhysicalMaterial).color = color;
      } else {
        this.bibGroup.visible = false;
        this.hatGroup.visible = true;
        (this.hatMesh.material as THREE.MeshPhysicalMaterial).color = color;
        (this.hatBrim.material as THREE.MeshPhysicalMaterial).color = color;
        (this.hatPomPom.material as THREE.MeshPhysicalMaterial).color = color;
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
      createdAt: new Date().toISOString().split('T')[0],
    };
    this.state.savedOutfits.unshift(newOutfit);
    this.saveState();
    return newOutfit;
  }

  public wearSavedOutfit(outfitId: string) {
    const outfit = this.state.savedOutfits.find((o) => o.id === outfitId);
    if (!outfit) return;
    this.state.currentOutfit = {
      topId: outfit.topId,
      bottomId: outfit.bottomId,
      shoesId: outfit.shoesId,
      accessoryId: outfit.accessoryId,
    };
    this.updateOutfitMeshes();
  }

  public addCustomClothing(item: Omit<ClothingItem, 'id' | 'isCustom'>): ClothingItem {
    const newItem: ClothingItem = {
      ...item,
      id: `item-${Date.now()}`,
      isCustom: true,
    };
    this.state.items.unshift(newItem);
    this.state.activeCategory = newItem.category;
    this.selectClothing(newItem);
    this.saveState();
    return newItem;
  }

  public deleteClothing(itemId: string) {
    this.state.items = this.state.items.filter((i) => i.id !== itemId);
    if (this.state.currentOutfit.topId === itemId) this.state.currentOutfit.topId = null;
    if (this.state.currentOutfit.bottomId === itemId) this.state.currentOutfit.bottomId = null;
    if (this.state.currentOutfit.shoesId === itemId) this.state.currentOutfit.shoesId = null;
    if (this.state.currentOutfit.accessoryId === itemId) this.state.currentOutfit.accessoryId = null;
    this.updateOutfitMeshes();
    this.saveState();
  }

  private animate() {
    if (this.isDestroyed) return;
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;

    if (this.autoRotate) {
      this.targetRotationY += 0.42 * delta;
    }

    const damp = 1 - Math.exp(-8 * delta);
    this.babyRoot.rotation.y += (this.targetRotationY - this.babyRoot.rotation.y) * damp;
    this.babyRoot.rotation.x += (this.targetPitchX - this.babyRoot.rotation.x) * damp;

    // Respiración suave y balanceo orgánico de bebé vivo
    this.torsoPivot.scale.y = 1 + Math.sin(elapsed * 2.1) * 0.005;
    this.torsoPivot.rotation.z = Math.sin(elapsed * 0.9) * 0.012;
    this.headGroup.rotation.z = Math.sin(elapsed * 1.15) * 0.032 + 0.018;
    this.headGroup.rotation.y = Math.sin(elapsed * 0.65) * 0.045;
    this.headGroup.position.y = 1.13 + Math.sin(elapsed * 2.1) * 0.005;

    // Micro-movimiento sutil de mirada
    const lookX = Math.sin(elapsed * 0.55) * 0.045;
    const lookY = Math.cos(elapsed * 0.4) * 0.02;
    this.eyeLookGroups.forEach((g) => {
      g.rotation.y = lookX;
      g.rotation.x = lookY;
    });

    // Parpadeo natural cada 3.2 - 5.2 segundos
    if (elapsed >= this.nextBlinkAt && this.blinkTimer < 0) {
      this.blinkTimer = 0;
    }
    if (this.blinkTimer >= 0) {
      this.blinkTimer += delta;
      const blinkDuration = 0.22;
      const progress = Math.min(1, this.blinkTimer / blinkDuration);
      const closeAmount = Math.sin(progress * Math.PI);
      const lidRot = -0.78 + closeAmount * 1.12;
      this.upperEyelids.forEach((lid) => {
        lid.rotation.x = lidRot;
      });
      if (this.blinkTimer >= blinkDuration) {
        this.blinkTimer = -1;
        this.nextBlinkAt = elapsed + 3.2 + (Math.sin(elapsed * 7.3) + 1) * 1.1;
      }
    }

    this.renderer.render(this.scene, this.camera);

    if (isSoftwareWebGL) {
      this.scheduleAfterDraw();
    } else {
      this.animationFrameId = requestAnimationFrame(this.animate);
    }
  }

  private scheduleAfterDraw() {
    try {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.isDestroyed) return;
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          this.animationFrameId = window.setTimeout(poll, 6);
        } else {
          if (sync) gl.deleteSync(sync);
          this.animationFrameId = window.setTimeout(this.animate, 80);
        }
      };
      this.animationFrameId = window.setTimeout(poll, 6);
    } catch {
      this.animationFrameId = window.setTimeout(this.animate, 80);
    }
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
    this.isDestroyed = true;
    cancelAnimationFrame(this.animationFrameId);
    clearTimeout(this.animationFrameId);
    window.removeEventListener('resize', this.onWindowResize);

    [
      this.fabricBumpMap,
      this.ribbedBumpMap,
      this.skinBumpMap,
      this.headRoughnessMap,
      this.activeHeadTexture,
      this.activeBodyTexture,
      this.activeEyeTexture,
      this.activeHairTextures?.map,
      this.activeHairTextures?.bump,
      this.activePhotoFaceTexture,
      this.activeClothingTexture,
    ].forEach((tex) => tex?.dispose());

    this.envRenderTarget?.dispose();
    this.renderer.dispose();
  }
}
