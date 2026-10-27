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

// Catálogo inicial con prendas inspiradas en la referencia BabyStyle 3D
const DEFAULT_ITEMS: ClothingItem[] = [
  // Tops
  { id: 'top-1', category: 'tops', name: 'Polera Básica Blanca', color: '#ffffff', secondaryColor: '#e0e0e0', subType: 'tshirt' },
  { id: 'top-2', category: 'tops', name: 'Suéter Tejido Avena', color: '#ded3c5', secondaryColor: '#c5b59e', subType: 'sweater' },
  { id: 'top-3', category: 'tops', name: 'Polerón Verde Salvia', color: '#88a698', secondaryColor: '#6d8a7c', subType: 'sweater' },
  { id: 'top-4', category: 'tops', name: 'Body Terracota Bichito', color: '#df7446', secondaryColor: '#fff8f2', subType: 'bodysuit' },
  { id: 'top-5', category: 'tops', name: 'Chaqueta Blazer Crema', color: '#eae3d2', secondaryColor: '#bfae95', subType: 'jacket' },

  // Bottoms
  { id: 'bot-1', category: 'bottoms', name: 'Falda Denim Mezclilla', color: '#3d5c7a', secondaryColor: '#28415c', subType: 'skirt' },
  { id: 'bot-2', category: 'bottoms', name: 'Pantalón Jogger Avena', color: '#cfc4b6', secondaryColor: '#b8ab9a', subType: 'pants' },
  { id: 'bot-3', category: 'bottoms', name: 'Pantalón Mezclilla Azul', color: '#2d4b68', secondaryColor: '#1c3349', subType: 'pants' },
  { id: 'bot-4', category: 'bottoms', name: 'Jogger Verde Salvia', color: '#799688', secondaryColor: '#5e796c', subType: 'pants' },
  { id: 'bot-5', category: 'bottoms', name: 'Pantalón Formal Gris Lino', color: '#9d9893', secondaryColor: '#75706b', subType: 'pants' },

  // Shoes
  { id: 'sho-1', category: 'shoes', name: 'Zapatillas de Lona Gris', color: '#cac5bf', secondaryColor: '#ffffff', subType: 'shoes' },
  { id: 'sho-2', category: 'shoes', name: 'Zapatitos Beige Cuero', color: '#bfae9b', secondaryColor: '#eae4dc', subType: 'shoes' },
  { id: 'sho-3', category: 'shoes', name: 'Botitas Azules Suaves', color: '#4a7299', secondaryColor: '#ffffff', subType: 'shoes' },
  { id: 'sho-4', category: 'shoes', name: 'Zapatitos Terracota', color: '#df7446', secondaryColor: '#ffffff', subType: 'shoes' },

  // Accessories
  { id: 'acc-1', category: 'accessories', name: 'Gorro Beanie Crema', color: '#e8ded1', secondaryColor: '#cfbeab', subType: 'hat' },
  { id: 'acc-2', category: 'accessories', name: 'Babero Algodón Blanco', color: '#ffffff', secondaryColor: '#df7446', subType: 'bib' },
  { id: 'acc-3', category: 'accessories', name: 'Gorro Terracota Bichito', color: '#df7446', secondaryColor: '#fff8f2', subType: 'hat' },
];

const DEFAULT_SAVED_OUTFITS: SavedOutfit[] = [
  { id: 'outfit-1', name: 'Conjunto Avena Suéter', topId: 'top-2', bottomId: 'bot-2', shoesId: 'sho-2', accessoryId: null, createdAt: '2026-10-20' },
  { id: 'outfit-2', name: 'Estilo Urbano Verde', topId: 'top-3', bottomId: 'bot-4', shoesId: 'sho-1', accessoryId: null, createdAt: '2026-10-22' },
  { id: 'outfit-3', name: 'Look Elegante Blazer', topId: 'top-5', bottomId: 'bot-5', shoesId: 'sho-2', accessoryId: null, createdAt: '2026-10-25' },
];

// Clase Principal del Probador 3D con Three.js
export class BabyStyle3D {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private mannequinGroup: THREE.Group;
  
  // Mallas anatómicas del maniquí
  private headMesh!: THREE.Mesh;
  private torsoMesh!: THREE.Mesh;
  private leftArmMesh!: THREE.Mesh;
  private rightArmMesh!: THREE.Mesh;
  private leftLegMesh!: THREE.Mesh;
  private rightLegMesh!: THREE.Mesh;

  // Capas de ropa 3D
  private topLayer!: THREE.Group;
  private topTorsoMesh!: THREE.Mesh;
  private topSleeveLeft!: THREE.Mesh;
  private topSleeveRight!: THREE.Mesh;

  private bottomLayer!: THREE.Group;
  private bottomHipsMesh!: THREE.Mesh;
  private bottomLegLeft!: THREE.Mesh;
  private bottomLegRight!: THREE.Mesh;

  private shoesLayer!: THREE.Group;
  private shoeLeft!: THREE.Mesh;
  private shoeRight!: THREE.Mesh;

  private accessoryLayer!: THREE.Group;
  private hatMesh!: THREE.Mesh;

  // Interacción y rotación
  private isDragging = false;
  private previousMousePosition = { x: 0, y: 0 };
  private targetRotationY = 0;
  private autoRotate = false;
  private animationFrameId: number | null = null;

  // Estado reactivo
  public state: WardrobeState;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;

    // Cargar o inicializar estado
    this.state = this.loadState();

    // Three.js setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, this.container.clientWidth / (this.container.clientHeight || 450), 0.1, 100);
    this.camera.position.set(0, 1.35, 4.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight || 450);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.innerHTML = '';
    this.container.appendChild(this.renderer.domElement);

    this.mannequinGroup = new THREE.Group();
    this.scene.add(this.mannequinGroup);

    this.setupLighting();
    this.buildMannequin();
    this.buildClothingLayers();
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
          items: parsed.items || DEFAULT_ITEMS,
          currentOutfit: parsed.currentOutfit || { topId: 'top-1', bottomId: 'bot-1', shoesId: 'sho-1', accessoryId: null },
          savedOutfits: parsed.savedOutfits || DEFAULT_SAVED_OUTFITS,
          activeCategory: 'tops',
          backgroundTheme: parsed.backgroundTheme || 'studio'
        };
      }
    } catch (e) {
      console.warn('Error loading wardrobe from localStorage:', e);
    }
    return {
      items: DEFAULT_ITEMS,
      currentOutfit: { topId: 'top-1', bottomId: 'bot-1', shoesId: 'sho-1', accessoryId: null },
      savedOutfits: DEFAULT_SAVED_OUTFITS,
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
      console.warn('Error saving wardrobe:', e);
    }
  }

  private setupLighting() {
    // Luz ambiental cálida
    const ambientLight = new THREE.AmbientLight(0xfff6ed, 1.4);
    this.scene.add(ambientLight);

    // Luz principal de estudio
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(3, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.001;
    this.scene.add(keyLight);

    // Luz de relleno suave
    const fillLight = new THREE.DirectionalLight(0xe4edff, 1.0);
    fillLight.position.set(-3, 3, 2);
    this.scene.add(fillLight);

    // Luz de contorno trasera (rim light)
    const rimLight = new THREE.DirectionalLight(0xffeedb, 1.2);
    rimLight.position.set(0, 4, -4);
    this.scene.add(rimLight);
  }

  private buildMannequin() {
    // Material del maniquí: acabado cerámico/plateado pulido suave como en la referencia
    const mannequinMaterial = new THREE.MeshStandardMaterial({
      color: 0xe8e5e0,
      metalness: 0.25,
      roughness: 0.35
    });

    const jointMaterial = new THREE.MeshStandardMaterial({
      color: 0x9e9992,
      metalness: 0.4,
      roughness: 0.3
    });

    // 1. Pedestal / Suelo circular
    const pedestalGeo = new THREE.CylinderGeometry(1.3, 1.4, 0.08, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0xede6de, roughness: 0.6 });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -1.1;
    pedestal.receiveShadow = true;
    this.mannequinGroup.add(pedestal);

    // 2. Cabeza del bebé estilizada
    const headGeo = new THREE.SphereGeometry(0.38, 32, 32);
    this.headMesh = new THREE.Mesh(headGeo, mannequinMaterial);
    this.headMesh.position.y = 1.35;
    this.headMesh.castShadow = true;
    this.mannequinGroup.add(this.headMesh);

    // Cara estilizada (visera ovalada)
    const facePlateGeo = new THREE.SphereGeometry(0.35, 24, 24, 0, Math.PI, 0, Math.PI * 0.6);
    const facePlateMat = new THREE.MeshStandardMaterial({ color: 0xc8c2b9, roughness: 0.25, metalness: 0.5 });
    const facePlate = new THREE.Mesh(facePlateGeo, facePlateMat);
    facePlate.rotation.x = Math.PI * 0.15;
    facePlate.position.set(0, 1.37, 0.08);
    this.mannequinGroup.add(facePlate);

    // Cuello
    const neckGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.16, 24);
    const neck = new THREE.Mesh(neckGeo, jointMaterial);
    neck.position.y = 1.05;
    this.mannequinGroup.add(neck);

    // 3. Torso de proporciones infantiles
    const torsoGeo = new THREE.CylinderGeometry(0.34, 0.38, 0.72, 32);
    this.torsoMesh = new THREE.Mesh(torsoGeo, mannequinMaterial);
    this.torsoMesh.position.y = 0.65;
    this.torsoMesh.castShadow = true;
    this.mannequinGroup.add(this.torsoMesh);

    // 4. Brazos articulados
    // Brazo izquierdo
    const armGeo = new THREE.CylinderGeometry(0.09, 0.08, 0.5, 24);
    this.leftArmMesh = new THREE.Mesh(armGeo, mannequinMaterial);
    this.leftArmMesh.position.set(0.48, 0.65, 0);
    this.leftArmMesh.rotation.z = -0.25;
    this.leftArmMesh.castShadow = true;
    this.mannequinGroup.add(this.leftArmMesh);

    // Brazo derecho
    this.rightArmMesh = new THREE.Mesh(armGeo, mannequinMaterial);
    this.rightArmMesh.position.set(-0.48, 0.65, 0);
    this.rightArmMesh.rotation.z = 0.25;
    this.rightArmMesh.castShadow = true;
    this.mannequinGroup.add(this.rightArmMesh);

    // Manitos de bola suave
    const handGeo = new THREE.SphereGeometry(0.08, 16, 16);
    const leftHand = new THREE.Mesh(handGeo, mannequinMaterial);
    leftHand.position.set(0.55, 0.36, 0);
    this.mannequinGroup.add(leftHand);

    const rightHand = new THREE.Mesh(handGeo, mannequinMaterial);
    rightHand.position.set(-0.55, 0.36, 0);
    this.mannequinGroup.add(rightHand);

    // 5. Caderas
    const hipsGeo = new THREE.SphereGeometry(0.36, 32, 16);
    const hips = new THREE.Mesh(hipsGeo, mannequinMaterial);
    hips.scale.set(1.0, 0.75, 0.95);
    hips.position.y = 0.22;
    this.mannequinGroup.add(hips);

    // 6. Piernas de bebé
    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 0.62, 24);
    this.leftLegMesh = new THREE.Mesh(legGeo, mannequinMaterial);
    this.leftLegMesh.position.set(0.2, -0.22, 0);
    this.leftLegMesh.castShadow = true;
    this.mannequinGroup.add(this.leftLegMesh);

    this.rightLegMesh = new THREE.Mesh(legGeo, mannequinMaterial);
    this.rightLegMesh.position.set(-0.2, -0.22, 0);
    this.rightLegMesh.castShadow = true;
    this.mannequinGroup.add(this.rightLegMesh);

    // Pies
    const footGeo = new THREE.BoxGeometry(0.14, 0.1, 0.26);
    const leftFoot = new THREE.Mesh(footGeo, mannequinMaterial);
    leftFoot.position.set(0.2, -0.58, 0.05);
    this.mannequinGroup.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeo, mannequinMaterial);
    rightFoot.position.set(-0.2, -0.58, 0.05);
    this.mannequinGroup.add(rightFoot);
  }

  private buildClothingLayers() {
    // --- Capa Superior (Tops) ---
    this.topLayer = new THREE.Group();

    // Torso de la prenda (polera/suéter/body)
    const topTorsoGeo = new THREE.CylinderGeometry(0.365, 0.405, 0.74, 32);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.75,
      metalness: 0.05
    });
    this.topTorsoMesh = new THREE.Mesh(topTorsoGeo, topMat);
    this.topTorsoMesh.position.y = 0.65;
    this.topTorsoMesh.castShadow = true;
    this.topLayer.add(this.topTorsoMesh);

    // Mangas
    const sleeveGeo = new THREE.CylinderGeometry(0.115, 0.105, 0.32, 24);
    this.topSleeveLeft = new THREE.Mesh(sleeveGeo, topMat);
    this.topSleeveLeft.position.set(0.44, 0.74, 0);
    this.topSleeveLeft.rotation.z = -0.25;
    this.topLayer.add(this.topSleeveLeft);

    this.topSleeveRight = new THREE.Mesh(sleeveGeo, topMat);
    this.topSleeveRight.position.set(-0.44, 0.74, 0);
    this.topSleeveRight.rotation.z = 0.25;
    this.topLayer.add(this.topSleeveRight);

    this.mannequinGroup.add(this.topLayer);

    // --- Capa Inferior (Bottoms) ---
    this.bottomLayer = new THREE.Group();

    // Cintura / Falda / Pantalón superior
    const bottomHipsGeo = new THREE.CylinderGeometry(0.395, 0.45, 0.38, 32);
    const bottomMat = new THREE.MeshStandardMaterial({
      color: 0x3d5c7a,
      roughness: 0.8,
      metalness: 0.05
    });
    this.bottomHipsMesh = new THREE.Mesh(bottomHipsGeo, bottomMat);
    this.bottomHipsMesh.position.y = 0.22;
    this.bottomHipsMesh.castShadow = true;
    this.bottomLayer.add(this.bottomHipsMesh);

    // Piernas de pantalón / shorts
    const bottomLegGeo = new THREE.CylinderGeometry(0.145, 0.13, 0.34, 24);
    this.bottomLegLeft = new THREE.Mesh(bottomLegGeo, bottomMat);
    this.bottomLegLeft.position.set(0.2, -0.06, 0);
    this.bottomLayer.add(this.bottomLegLeft);

    this.bottomLegRight = new THREE.Mesh(bottomLegGeo, bottomMat);
    this.bottomLegRight.position.set(-0.2, -0.06, 0);
    this.bottomLayer.add(this.bottomLegRight);

    this.mannequinGroup.add(this.bottomLayer);

    // --- Capa Calzado (Shoes) ---
    this.shoesLayer = new THREE.Group();
    const shoeGeo = new THREE.BoxGeometry(0.165, 0.13, 0.29);
    const shoeMat = new THREE.MeshStandardMaterial({
      color: 0xcac5bf,
      roughness: 0.65,
      metalness: 0.1
    });

    this.shoeLeft = new THREE.Mesh(shoeGeo, shoeMat);
    this.shoeLeft.position.set(0.2, -0.57, 0.05);
    this.shoeLeft.castShadow = true;
    this.shoesLayer.add(this.shoeLeft);

    this.shoeRight = new THREE.Mesh(shoeGeo, shoeMat);
    this.shoeRight.position.set(-0.2, -0.57, 0.05);
    this.shoeRight.castShadow = true;
    this.shoesLayer.add(this.shoeRight);

    this.mannequinGroup.add(this.shoesLayer);

    // --- Capa Accesorios (Gorro) ---
    this.accessoryLayer = new THREE.Group();
    const hatGeo = new THREE.SphereGeometry(0.405, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const hatMat = new THREE.MeshStandardMaterial({
      color: 0xe8ded1,
      roughness: 0.9,
      metalness: 0.05
    });
    this.hatMesh = new THREE.Mesh(hatGeo, hatMat);
    this.hatMesh.position.y = 1.42;
    this.accessoryLayer.add(this.hatMesh);
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

    // Eventos Mouse
    el.addEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onPointerUp);

    // Eventos Touch (Móvil y Android WebView)
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

  public toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    return this.autoRotate;
  }

  public rotateBy(degrees: number) {
    this.targetRotationY += (degrees * Math.PI) / 180;
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
      (this.topTorsoMesh.material as THREE.MeshStandardMaterial).color = color;
      (this.topSleeveLeft.material as THREE.MeshStandardMaterial).color = color;
      (this.topSleeveRight.material as THREE.MeshStandardMaterial).color = color;

      // Adaptar forma según subType
      if (topItem.subType === 'sweater' || topItem.subType === 'jacket') {
        this.topSleeveLeft.scale.set(1.15, 1.4, 1.15);
        this.topSleeveRight.scale.set(1.15, 1.4, 1.15);
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
      (this.bottomHipsMesh.material as THREE.MeshStandardMaterial).color = color;
      (this.bottomLegLeft.material as THREE.MeshStandardMaterial).color = color;
      (this.bottomLegRight.material as THREE.MeshStandardMaterial).color = color;

      // Adaptar si es falda o pantalón
      if (botItem.subType === 'skirt') {
        this.bottomHipsMesh.scale.set(1.2, 1.15, 1.2);
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
      (this.shoeLeft.material as THREE.MeshStandardMaterial).color = color;
      (this.shoeRight.material as THREE.MeshStandardMaterial).color = color;
    } else {
      this.shoesLayer.visible = false;
    }

    // Actualizar Accesorio
    const accItem = this.state.items.find(i => i.id === accessoryId);
    if (accItem && accItem.subType === 'hat') {
      this.accessoryLayer.visible = true;
      const color = new THREE.Color(accItem.color || '#e8ded1');
      (this.hatMesh.material as THREE.MeshStandardMaterial).color = color;
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
      id: `custom-${Date.now()}`,
      isCustom: true
    };
    this.state.items.unshift(newItem);
    this.state.activeCategory = newItem.category;
    this.selectClothing(newItem);
    this.saveState();
    return newItem;
  }

  private animate() {
    this.animationFrameId = requestAnimationFrame(this.animate);

    if (this.autoRotate) {
      this.targetRotationY += 0.008;
    }

    // Interpolación suave (damping)
    this.mannequinGroup.rotation.y += (this.targetRotationY - this.mannequinGroup.rotation.y) * 0.1;

    // Sutil respiración / balanceo
    const time = Date.now() * 0.0018;
    this.headMesh.position.y = 1.35 + Math.sin(time) * 0.008;

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
