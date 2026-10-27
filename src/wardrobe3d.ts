import * as THREE from 'three';

// Tipos de datos para el armario 3D
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
}

const STORAGE_KEY = 'bichito-wardrobe-v1';

// CERO DATOS FICTICIOS: Si el usuario no tiene prendas subidas, la app no inventa nada
const DEFAULT_ITEMS: ClothingItem[] = [];
const DEFAULT_SAVED_OUTFITS: SavedOutfit[] = [];

// Generador de textura de tejido realista (algodón/denim)
function createFabricTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 128);

  ctx.strokeStyle = '#929292';
  ctx.lineWidth = 1;
  for (let i = 0; i < 128; i += 4) {
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
  tex.repeat.set(16, 16);
  return tex;
}

// Generador de sombra de contacto suave
function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 115);
  grad.addColorStop(0, 'rgba(35, 25, 20, 0.65)');
  grad.addColorStop(0.35, 'rgba(35, 25, 20, 0.28)');
  grad.addColorStop(0.8, 'rgba(35, 25, 20, 0.08)');
  grad.addColorStop(1, 'rgba(35, 25, 20, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

// Clase Principal del Probador 3D con Three.js
export class BabyStyle3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private mannequinGroup: THREE.Group;

  // Texturas compartidas
  private fabricBumpMap: THREE.CanvasTexture;

  // Mallas anatómicas del maniquí
  private headMesh!: THREE.Mesh;
  private chromeShell!: THREE.Mesh;
  private facePlate!: THREE.Mesh;
  private torsoMesh!: THREE.Mesh;
  private chromeMaterial!: THREE.MeshStandardMaterial;
  private porcelainMaterial!: THREE.MeshStandardMaterial;
  private jointMaterial!: THREE.MeshStandardMaterial;

  // Capas de ropa 3D realistas
  private topLayer!: THREE.Group;
  private topTorsoMesh!: THREE.Mesh;
  private topCollarRing!: THREE.Mesh;
  private topSleeveLeft!: THREE.Mesh;
  private topSleeveRight!: THREE.Mesh;
  private topCuffLeft!: THREE.Mesh;
  private topCuffRight!: THREE.Mesh;
  private topHemRing!: THREE.Mesh;

  private bottomLayer!: THREE.Group;
  private bottomWaistband!: THREE.Mesh;
  private bottomButton!: THREE.Mesh;
  private bottomHipsMesh!: THREE.Mesh;
  private bottomLegLeft!: THREE.Mesh;
  private bottomLegRight!: THREE.Mesh;

  private shoesLayer!: THREE.Group;
  private shoeUpperLeft!: THREE.Mesh;
  private shoeUpperRight!: THREE.Mesh;
  private shoeSoleLeft!: THREE.Mesh;
  private shoeSoleRight!: THREE.Mesh;

  private accessoryLayer!: THREE.Group;
  private hatMesh!: THREE.Mesh;
  private hatPomPom!: THREE.Mesh;

  // Interacción y rotación 360
  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private targetRotationY = 0;
  private autoRotate = false;
  private animationFrameId: number | null = null;

  public state: WardrobeState;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;

    this.fabricBumpMap = createFabricTexture();
    this.state = this.loadState();

    // Setup Three.js
    this.scene = new THREE.Scene();
    const aspect = this.container.clientWidth / (this.container.clientHeight || 450);
    this.camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 50);
    this.camera.position.set(0, 0.85, 3.8);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight || 450);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.mannequinGroup = new THREE.Group();
    this.scene.add(this.mannequinGroup);

    this.setupStudioEnvironment();
    this.setupLighting();
    this.buildHighEndMannequin();
    this.buildRealisticClothingLayers();
    this.setupInteractions();
    this.applyTheme(this.state.backgroundTheme);
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
          items: parsed.items || [],
          currentOutfit: parsed.currentOutfit || { topId: null, bottomId: null, shoesId: null, accessoryId: null },
          savedOutfits: parsed.savedOutfits || [],
          activeCategory: 'tops',
          backgroundTheme: parsed.backgroundTheme || 'studio'
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
      backgroundTheme: 'studio'
    };
  }

  public saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        items: this.state.items,
        currentOutfit: this.state.currentOutfit,
        savedOutfits: this.state.savedOutfits,
        backgroundTheme: this.state.backgroundTheme
      }));
    } catch (e) {
      console.warn('Error saving wardrobe state:', e);
    }
  }

  private setupStudioEnvironment() {
    // Generar mapa de reflejos de estudio suave para que el cromo brille como en la referencia
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0xf5eedd);

    // Softbox 1 (Frontal derecho)
    const softbox1 = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    softbox1.position.set(4, 5, 4);
    softbox1.lookAt(0, 0, 0);
    envScene.add(softbox1);

    // Softbox 2 (Lateral izquierdo suave)
    const softbox2 = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 6),
      new THREE.MeshBasicMaterial({ color: 0xdfefff, side: THREE.DoubleSide })
    );
    softbox2.position.set(-5, 4, 2);
    softbox2.lookAt(0, 0, 0);
    envScene.add(softbox2);

    const renderTarget = pmremGenerator.fromScene(envScene, 0.04);
    this.scene.environment = renderTarget.texture;
    pmremGenerator.dispose();
  }

  private setupLighting() {
    // Luz ambiental suave de relleno
    const ambientLight = new THREE.AmbientLight(0xfff5ea, 1.2);
    this.scene.add(ambientLight);

    // Luz principal de estudio cálida con sombras de alta definición
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(2.8, 4.5, 3.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.radius = 2.5;
    this.scene.add(keyLight);

    // Luz de relleno azulada suave
    const fillLight = new THREE.DirectionalLight(0xd9ebff, 1.1);
    fillLight.position.set(-3.5, 3.0, 1.5);
    this.scene.add(fillLight);

    // Luz trasera de contorno (Rim light) para resaltar la silueta
    const rimLight = new THREE.DirectionalLight(0xffeed9, 1.5);
    rimLight.position.set(0, 4.0, -3.5);
    this.scene.add(rimLight);
  }

  private buildHighEndMannequin() {
    // 1. Materiales de alta fidelidad: Cromo de alto brillo + Porcelana satinada suave
    this.chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xd8dcd9,
      metalness: 0.95,
      roughness: 0.12,
      envMapIntensity: 1.8
    });

    this.porcelainMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f0eb,
      metalness: 0.08,
      roughness: 0.38,
      envMapIntensity: 0.8
    });

    this.jointMaterial = new THREE.MeshStandardMaterial({
      color: 0x9fa4a2,
      metalness: 0.88,
      roughness: 0.22,
      envMapIntensity: 1.4
    });

    // 2. Pedestal y Sombra de Contacto
    const pedestalGeo = new THREE.CylinderGeometry(1.4, 1.48, 0.04, 64);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0xf4eee7,
      roughness: 0.75,
      metalness: 0.05
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -1.02;
    pedestal.receiveShadow = true;
    this.mannequinGroup.add(pedestal);

    // Sombra de contacto suave en el suelo
    const shadowGeo = new THREE.PlaneGeometry(2.4, 2.4);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      depthWrite: false
    });
    const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = -0.99;
    this.mannequinGroup.add(contactShadow);

    // 3. Cabeza Estilizada de Maniquí de Alta Gama (Casco Cromo + Placa Visor)
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.32;

    // Casco exterior cromo pulido
    const outerDomeGeo = new THREE.SphereGeometry(0.36, 48, 48);
    this.chromeShell = new THREE.Mesh(outerDomeGeo, this.chromeMaterial);
    this.chromeShell.castShadow = true;
    headGroup.add(this.chromeShell);

    // Visor frontal / placa de rostro satinada
    const facePlateGeo = new THREE.SphereGeometry(0.345, 36, 36, 0, Math.PI, 0, Math.PI * 0.72);
    this.facePlate = new THREE.Mesh(facePlateGeo, this.porcelainMaterial);
    this.facePlate.rotation.x = Math.PI * 0.12;
    this.facePlate.position.set(0, 0.01, 0.05);
    headGroup.add(this.facePlate);

    // Borde bisel cromo que enmarca la cara
    const visorRimGeo = new THREE.TorusGeometry(0.31, 0.02, 24, 64, Math.PI * 1.05);
    const visorRim = new THREE.Mesh(visorRimGeo, this.chromeMaterial);
    visorRim.rotation.x = Math.PI * 0.62;
    visorRim.position.set(0, 0.02, 0.2);
    headGroup.add(visorRim);

    // Auriculares / conectores laterales de las orejas
    const earGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 32);
    const leftEar = new THREE.Mesh(earGeo, this.chromeMaterial);
    leftEar.rotation.z = Math.PI / 2;
    leftEar.position.set(0.36, 0.01, 0);
    headGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, this.chromeMaterial);
    rightEar.rotation.z = Math.PI / 2;
    rightEar.position.set(-0.36, 0.01, 0);
    headGroup.add(rightEar);

    this.headMesh = this.chromeShell;
    this.mannequinGroup.add(headGroup);

    // 4. Cuello articulado con rótula esférica
    const neckJointGeo = new THREE.SphereGeometry(0.13, 24, 24);
    const neckJoint = new THREE.Mesh(neckJointGeo, this.jointMaterial);
    neckJoint.position.y = 1.0;
    this.mannequinGroup.add(neckJoint);

    // 5. Torso del maniquí con curvas anatómicas
    const torsoGeo = new THREE.CylinderGeometry(0.32, 0.36, 0.68, 36);
    this.torsoMesh = new THREE.Mesh(torsoGeo, this.porcelainMaterial);
    this.torsoMesh.position.y = 0.64;
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.mannequinGroup.add(this.torsoMesh);

    // Clavículas / hombros
    const shoulderBeamGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.72, 24);
    const shoulderBeam = new THREE.Mesh(shoulderBeamGeo, this.chromeMaterial);
    shoulderBeam.rotation.z = Math.PI / 2;
    shoulderBeam.position.y = 0.88;
    this.mannequinGroup.add(shoulderBeam);

    // 6. Brazos de Cromo con Rótulas de Muñeca y Dedos Esculpidos
    this.buildChromeArm(true);
    this.buildChromeArm(false);

    // 7. Caderas / Pelvis articulada
    const pelvisGeo = new THREE.SphereGeometry(0.35, 32, 24);
    const pelvis = new THREE.Mesh(pelvisGeo, this.porcelainMaterial);
    pelvis.scale.set(1.0, 0.7, 0.9);
    pelvis.position.y = 0.22;
    pelvis.castShadow = true;
    this.mannequinGroup.add(pelvis);

    // Rótulas de cadera cromo
    const hipJointGeo = new THREE.SphereGeometry(0.11, 24, 24);
    const leftHipJoint = new THREE.Mesh(hipJointGeo, this.jointMaterial);
    leftHipJoint.position.set(0.18, 0.15, 0);
    this.mannequinGroup.add(leftHipJoint);

    const rightHipJoint = new THREE.Mesh(hipJointGeo, this.jointMaterial);
    rightHipJoint.position.set(-0.18, 0.15, 0);
    this.mannequinGroup.add(rightHipJoint);

    // 8. Piernas y Pies de Maniquí con acabado Cromo
    this.buildChromeLeg(true);
    this.buildChromeLeg(false);
  }

  private buildChromeArm(isLeft: boolean) {
    const sign = isLeft ? 1 : -1;
    const armGroup = new THREE.Group();
    armGroup.position.set(sign * 0.44, 0.88, 0);

    // Rótula de hombro
    const shoulderBallGeo = new THREE.SphereGeometry(0.1, 24, 24);
    const shoulderBall = new THREE.Mesh(shoulderBallGeo, this.jointMaterial);
    armGroup.add(shoulderBall);

    // Brazo superior
    const upperArmGeo = new THREE.CylinderGeometry(0.08, 0.07, 0.32, 24);
    const upperArm = new THREE.Mesh(upperArmGeo, this.chromeMaterial);
    upperArm.position.set(sign * 0.06, -0.16, 0);
    upperArm.rotation.z = sign * -0.25;
    upperArm.castShadow = true;
    armGroup.add(upperArm);

    // Rótula de codo
    const elbowBallGeo = new THREE.SphereGeometry(0.075, 24, 24);
    const elbowBall = new THREE.Mesh(elbowBallGeo, this.jointMaterial);
    elbowBall.position.set(sign * 0.11, -0.32, 0);
    armGroup.add(elbowBall);

    // Antebrazo cónico
    const forearmGeo = new THREE.CylinderGeometry(0.07, 0.055, 0.3, 24);
    const forearm = new THREE.Mesh(forearmGeo, this.chromeMaterial);
    forearm.position.set(sign * 0.13, -0.47, 0.04);
    forearm.rotation.z = sign * -0.15;
    forearm.castShadow = true;
    armGroup.add(forearm);

    // Mano delicada de bebé estilizada
    const palmGeo = new THREE.BoxGeometry(0.06, 0.08, 0.04);
    const palm = new THREE.Mesh(palmGeo, this.chromeMaterial);
    palm.position.set(sign * 0.15, -0.63, 0.05);
    palm.rotation.y = sign * 0.2;
    armGroup.add(palm);

    this.mannequinGroup.add(armGroup);
  }

  private buildChromeLeg(isLeft: boolean) {
    const sign = isLeft ? 1 : -1;
    const legGroup = new THREE.Group();
    legGroup.position.set(sign * 0.18, 0.15, 0);

    // Muslo
    const thighGeo = new THREE.CylinderGeometry(0.12, 0.095, 0.38, 24);
    const thigh = new THREE.Mesh(thighGeo, this.chromeMaterial);
    thigh.position.set(0, -0.2, 0);
    thigh.castShadow = true;
    legGroup.add(thigh);

    // Rodilla esférica
    const kneeGeo = new THREE.SphereGeometry(0.088, 24, 24);
    const knee = new THREE.Mesh(kneeGeo, this.jointMaterial);
    knee.position.set(0, -0.4, 0.01);
    legGroup.add(knee);

    // Pantorrilla
    const calfGeo = new THREE.CylinderGeometry(0.095, 0.07, 0.38, 24);
    const calf = new THREE.Mesh(calfGeo, this.chromeMaterial);
    calf.position.set(0, -0.6, 0);
    calf.castShadow = true;
    legGroup.add(calf);

    // Pie detallado con suela plana descansando en el pedestal
    const footGroup = new THREE.Group();
    footGroup.position.set(0, -0.84, 0.05);

    const footMeshGeo = new THREE.BoxGeometry(0.12, 0.08, 0.24);
    const footMesh = new THREE.Mesh(footMeshGeo, this.chromeMaterial);
    footMesh.castShadow = true;
    footGroup.add(footMesh);

    legGroup.add(footGroup);
    this.mannequinGroup.add(legGroup);
  }

  private buildRealisticClothingLayers() {
    // --- Capa Superior (Tops) con Textura, Cuello Redondo y Dobladillo ---
    this.topLayer = new THREE.Group();

    const topFabricMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0.02,
      bumpMap: this.fabricBumpMap,
      bumpScale: 0.04
    });

    // Cuerpo de la polera con volumen drapeado
    const topTorsoGeo = new THREE.CylinderGeometry(0.355, 0.395, 0.69, 36);
    this.topTorsoMesh = new THREE.Mesh(topTorsoGeo, topFabricMat);
    this.topTorsoMesh.position.y = 0.65;
    this.topTorsoMesh.castShadow = true;
    this.topLayer.add(this.topTorsoMesh);

    // Cuello redondo de canalé (collar rib)
    const collarGeo = new THREE.TorusGeometry(0.24, 0.03, 16, 48);
    this.topCollarRing = new THREE.Mesh(collarGeo, topFabricMat);
    this.topCollarRing.rotation.x = Math.PI / 2;
    this.topCollarRing.position.set(0, 0.99, 0);
    this.topLayer.add(this.topCollarRing);

    // Dobladillo inferior
    const hemGeo = new THREE.TorusGeometry(0.395, 0.025, 16, 48);
    this.topHemRing = new THREE.Mesh(hemGeo, topFabricMat);
    this.topHemRing.rotation.x = Math.PI / 2;
    this.topHemRing.position.set(0, 0.31, 0);
    this.topLayer.add(this.topHemRing);

    // Mangas con dobladillo enrollado
    const sleeveGeo = new THREE.CylinderGeometry(0.11, 0.10, 0.26, 24);
    this.topSleeveLeft = new THREE.Mesh(sleeveGeo, topFabricMat);
    this.topSleeveLeft.position.set(0.44, 0.76, 0);
    this.topSleeveLeft.rotation.z = -0.28;
    this.topSleeveLeft.castShadow = true;
    this.topLayer.add(this.topSleeveLeft);

    const cuffGeo = new THREE.TorusGeometry(0.1, 0.018, 16, 32);
    this.topCuffLeft = new THREE.Mesh(cuffGeo, topFabricMat);
    this.topCuffLeft.position.set(0.48, 0.65, 0);
    this.topCuffLeft.rotation.z = -0.28;
    this.topLayer.add(this.topCuffLeft);

    this.topSleeveRight = new THREE.Mesh(sleeveGeo, topFabricMat);
    this.topSleeveRight.position.set(-0.44, 0.76, 0);
    this.topSleeveRight.rotation.z = 0.28;
    this.topSleeveRight.castShadow = true;
    this.topLayer.add(this.topSleeveRight);

    this.topCuffRight = new THREE.Mesh(cuffGeo, topFabricMat);
    this.topCuffRight.position.set(-0.48, 0.65, 0);
    this.topCuffRight.rotation.z = 0.28;
    this.topLayer.add(this.topCuffRight);

    this.topLayer.visible = false;
    this.mannequinGroup.add(this.topLayer);

    // --- Capa Inferior (Bottoms: Falda Denim / Pantalón con Pretina y Botón) ---
    this.bottomLayer = new THREE.Group();

    const bottomMat = new THREE.MeshStandardMaterial({
      color: 0x3d5c7a,
      roughness: 0.88,
      metalness: 0.02,
      bumpMap: this.fabricBumpMap,
      bumpScale: 0.06
    });

    // Pretina de cintura con costura
    const waistbandGeo = new THREE.CylinderGeometry(0.4, 0.41, 0.09, 36);
    this.bottomWaistband = new THREE.Mesh(waistbandGeo, bottomMat);
    this.bottomWaistband.position.y = 0.33;
    this.bottomLayer.add(this.bottomWaistband);

    // Botón metálico de vaquero/mezclilla
    const buttonGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.015, 16);
    const buttonMat = new THREE.MeshStandardMaterial({ color: 0xc8aa6e, metalness: 0.9, roughness: 0.2 });
    this.bottomButton = new THREE.Mesh(buttonGeo, buttonMat);
    this.bottomButton.rotation.x = Math.PI / 2;
    this.bottomButton.position.set(0, 0.33, 0.41);
    this.bottomLayer.add(this.bottomButton);

    // Falda / Cuerpo del pantalón
    const bottomHipsGeo = new THREE.CylinderGeometry(0.41, 0.46, 0.35, 36);
    this.bottomHipsMesh = new THREE.Mesh(bottomHipsGeo, bottomMat);
    this.bottomHipsMesh.position.y = 0.14;
    this.bottomHipsMesh.castShadow = true;
    this.bottomLayer.add(this.bottomHipsMesh);

    // Piernas de pantalón
    const bottomLegGeo = new THREE.CylinderGeometry(0.14, 0.12, 0.38, 24);
    this.bottomLegLeft = new THREE.Mesh(bottomLegGeo, bottomMat);
    this.bottomLegLeft.position.set(0.18, -0.16, 0);
    this.bottomLegLeft.castShadow = true;
    this.bottomLayer.add(this.bottomLegLeft);

    this.bottomLegRight = new THREE.Mesh(bottomLegGeo, bottomMat);
    this.bottomLegRight.position.set(-0.18, -0.16, 0);
    this.bottomLegRight.castShadow = true;
    this.bottomLayer.add(this.bottomLegRight);

    this.bottomLayer.visible = false;
    this.mannequinGroup.add(this.bottomLayer);

    // --- Capa Calzado (Zapatillas de Diseñador con Suela Blanca y Cordones) ---
    this.shoesLayer = new THREE.Group();

    const shoeUpperMat = new THREE.MeshStandardMaterial({
      color: 0xcac5bf,
      roughness: 0.6,
      metalness: 0.05
    });

    const shoeSoleMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
      metalness: 0.05
    });

    // Pie izquierdo: Empeine + Suela de goma
    this.shoeUpperLeft = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.11, 0.25), shoeUpperMat);
    this.shoeUpperLeft.position.set(0.18, -0.83, 0.05);
    this.shoeUpperLeft.castShadow = true;
    this.shoesLayer.add(this.shoeUpperLeft);

    this.shoeSoleLeft = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.035, 0.27), shoeSoleMat);
    this.shoeSoleLeft.position.set(0.18, -0.89, 0.05);
    this.shoeSoleLeft.castShadow = true;
    this.shoesLayer.add(this.shoeSoleLeft);

    // Pie derecho: Empeine + Suela de goma
    this.shoeUpperRight = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.11, 0.25), shoeUpperMat);
    this.shoeUpperRight.position.set(-0.18, -0.83, 0.05);
    this.shoeUpperRight.castShadow = true;
    this.shoesLayer.add(this.shoeUpperRight);

    this.shoeSoleRight = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.035, 0.27), shoeSoleMat);
    this.shoeSoleRight.position.set(-0.18, -0.89, 0.05);
    this.shoeSoleRight.castShadow = true;
    this.shoesLayer.add(this.shoeSoleRight);

    this.shoesLayer.visible = false;
    this.mannequinGroup.add(this.shoesLayer);

    // --- Capa Accesorio (Gorro Beanie con pompón) ---
    this.accessoryLayer = new THREE.Group();
    const hatMat = new THREE.MeshStandardMaterial({
      color: 0xe8ded1,
      roughness: 0.9,
      metalness: 0.02,
      bumpMap: this.fabricBumpMap,
      bumpScale: 0.08
    });

    const hatGeo = new THREE.SphereGeometry(0.38, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.52);
    this.hatMesh = new THREE.Mesh(hatGeo, hatMat);
    this.hatMesh.position.y = 1.42;
    this.accessoryLayer.add(this.hatMesh);

    const pomPomGeo = new THREE.SphereGeometry(0.08, 16, 16);
    this.hatPomPom = new THREE.Mesh(pomPomGeo, hatMat);
    this.hatPomPom.position.set(0, 1.82, 0);
    this.accessoryLayer.add(this.hatPomPom);

    this.accessoryLayer.visible = false;
    this.mannequinGroup.add(this.accessoryLayer);
  }

  private setupInteractions() {
    const el = this.renderer.domElement;

    const onPointerDown = (clientX: number, clientY: number) => {
      this.isDragging = true;
      this.autoRotate = false;
      this.previousMousePosition = { x: clientX, y: clientY };
    };

    const onPointerMove = (clientX: number, _clientY: number) => {
      if (!this.isDragging) return;
      const deltaX = clientX - this.previousMousePosition.x;
      this.targetRotationY += deltaX * 0.012;
      this.previousMousePosition = { x: clientX, y: _clientY };
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

    // Actualizar Top
    const topItem = this.state.items.find(i => i.id === topId);
    if (topItem) {
      this.topLayer.visible = true;
      const color = new THREE.Color(topItem.color || '#ffffff');
      const mat = this.topTorsoMesh.material as THREE.MeshStandardMaterial;
      mat.color = color;
      (this.topCollarRing.material as THREE.MeshStandardMaterial).color = color;
      (this.topHemRing.material as THREE.MeshStandardMaterial).color = color;
      (this.topSleeveLeft.material as THREE.MeshStandardMaterial).color = color;
      (this.topSleeveRight.material as THREE.MeshStandardMaterial).color = color;
      (this.topCuffLeft.material as THREE.MeshStandardMaterial).color = color;
      (this.topCuffRight.material as THREE.MeshStandardMaterial).color = color;

      if (topItem.subType === 'sweater' || topItem.subType === 'jacket') {
        this.topSleeveLeft.scale.set(1.18, 1.4, 1.18);
        this.topSleeveRight.scale.set(1.18, 1.4, 1.18);
      } else {
        this.topSleeveLeft.scale.set(1.0, 1.0, 1.0);
        this.topSleeveRight.scale.set(1.0, 1.0, 1.0);
      }
    } else {
      this.topLayer.visible = false;
    }

    // Actualizar Bottom
    const botItem = this.state.items.find(i => i.id === bottomId);
    if (botItem) {
      this.bottomLayer.visible = true;
      const color = new THREE.Color(botItem.color || '#3d5c7a');
      (this.bottomWaistband.material as THREE.MeshStandardMaterial).color = color;
      (this.bottomHipsMesh.material as THREE.MeshStandardMaterial).color = color;
      (this.bottomLegLeft.material as THREE.MeshStandardMaterial).color = color;
      (this.bottomLegRight.material as THREE.MeshStandardMaterial).color = color;

      if (botItem.subType === 'skirt') {
        this.bottomHipsMesh.scale.set(1.18, 1.25, 1.18);
        this.bottomLegLeft.visible = false;
        this.bottomLegRight.visible = false;
      } else {
        this.bottomHipsMesh.scale.set(1.0, 1.0, 1.0);
        this.bottomLegLeft.visible = true;
        this.bottomLegRight.visible = true;
      }
    } else {
      this.bottomLayer.visible = false;
    }

    // Actualizar Calzado
    const shoeItem = this.state.items.find(i => i.id === shoesId);
    if (shoeItem) {
      this.shoesLayer.visible = true;
      const color = new THREE.Color(shoeItem.color || '#cac5bf');
      (this.shoeUpperLeft.material as THREE.MeshStandardMaterial).color = color;
      (this.shoeUpperRight.material as THREE.MeshStandardMaterial).color = color;
    } else {
      this.shoesLayer.visible = false;
    }

    // Actualizar Accesorio
    const accItem = this.state.items.find(i => i.id === accessoryId);
    if (accItem && accItem.subType === 'hat') {
      this.accessoryLayer.visible = true;
      const color = new THREE.Color(accItem.color || '#e8ded1');
      (this.hatMesh.material as THREE.MeshStandardMaterial).color = color;
      (this.hatPomPom.material as THREE.MeshStandardMaterial).color = color;
    } else {
      this.accessoryLayer.visible = false;
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

    // Interpolación suave (damping)
    this.mannequinGroup.rotation.y += (this.targetRotationY - this.mannequinGroup.rotation.y) * 0.1;

    // Sutil respiración realista
    const time = Date.now() * 0.0016;
    this.mannequinGroup.position.y = Math.sin(time) * 0.006;

    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight || 450;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public destroy() {
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.onWindowResize);
    this.renderer.dispose();
  }
}
