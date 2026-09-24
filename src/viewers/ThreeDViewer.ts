import {
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { FramePixels, SliceImage, VideoMeta } from '../core/types';

export interface VolumePlaneData {
  frameIndex: number;
  tNorm: number;
  pixels: FramePixels;
}

function pixelsToTexture(pixels: FramePixels | SliceImage): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('texture canvas failed');
  }
  ctx.putImageData(
    new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height),
    0,
    0,
  );
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function disposeMesh(mesh: Mesh): void {
  mesh.geometry.dispose();
  const material = mesh.material;
  if (Array.isArray(material)) {
    for (const item of material) {
      const mapped = item as MeshBasicMaterial;
      if (mapped.map) {
        mapped.map.dispose();
      }
      mapped.dispose();
    }
    return;
  }
  const single = material as MeshBasicMaterial;
  if (single.map) {
    single.map.dispose();
  }
  single.dispose();
}

export class ThreeDViewer {
  private readonly container: HTMLElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly volumeGroup = new Group();
  private readonly sliceGroup = new Group();
  private readonly axisGroup = new Group();
  private readonly boundsGroup = new Group();
  private animationId = 0;
  private disposed = false;
  private temporalScale = 1;
  private meta: VideoMeta | null = null;
  private xyMesh: Mesh | null = null;
  private xtMesh: Mesh | null = null;
  private ytMesh: Mesh | null = null;
  private volumeMeshes: Mesh[] = [];
  private x0 = 0.5;
  private y0 = 0.5;
  private t0 = 0;
  private boundsMaterial: LineBasicMaterial | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(new Color('#0b0d10'));
    container.appendChild(this.renderer.domElement);

    this.camera = new PerspectiveCamera(50, 1, 0.1, 500);
    this.camera.position.set(2.6, 2.0, 3.2);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0, 0);

    this.scene.add(new AmbientLight(0xffffff, 0.8));
    const key = new DirectionalLight(0xffffff, 0.7);
    key.position.set(3, 4, 2);
    this.scene.add(key);

    this.scene.add(this.volumeGroup);
    this.scene.add(this.sliceGroup);
    this.scene.add(this.axisGroup);
    this.scene.add(this.boundsGroup);

    this.buildAxes();
    this.rebuildBounds();
    this.resize();
    window.addEventListener('resize', this.resize);
    this.tick();
  }

  setMeta(meta: VideoMeta | null): void {
    this.meta = meta;
  }

  setTemporalScale(scale: number): void {
    this.temporalScale = scale;
    this.applyLayout();
    this.rebuildBounds();
  }

  setVolumePlanes(planes: VolumePlaneData[]): void {
    for (const mesh of this.volumeMeshes) {
      disposeMesh(mesh);
      this.volumeGroup.remove(mesh);
    }
    this.volumeMeshes = [];

    for (const plane of planes) {
      const texture = pixelsToTexture(plane.pixels);
      const material = new MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.42,
        side: DoubleSide,
        depthWrite: false,
      });
      const mesh = new Mesh(new PlaneGeometry(1, 1), material);
      mesh.userData.tNorm = plane.tNorm;
      this.volumeGroup.add(mesh);
      this.volumeMeshes.push(mesh);
    }
    this.applyLayout();
  }

  setCuttingPlaneImages(xy: SliceImage | null, xt: SliceImage | null, yt: SliceImage | null): void {
    this.replaceCut('xy', xy, 0x4ea1ff, 0.55);
    this.replaceCut('xt', xt, 0xff7a45, 0.5);
    this.replaceCut('yt', yt, 0x7dffb3, 0.5);
    this.applyCutTransforms();
  }

  setCutPositions(x0: number, y0: number, t0: number): void {
    if (!this.meta) {
      return;
    }
    this.x0 = this.meta.width > 1 ? x0 / (this.meta.width - 1) : 0.5;
    this.y0 = this.meta.height > 1 ? y0 / (this.meta.height - 1) : 0.5;
    this.t0 = this.meta.durationSec > 0 ? t0 / this.meta.durationSec : 0;
    this.applyCutTransforms();
  }

  exportPng(filename: string): void {
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animationId);
    window.removeEventListener('resize', this.resize);
    this.controls.dispose();
    for (const mesh of this.volumeMeshes) {
      disposeMesh(mesh);
    }
    if (this.xyMesh) {
      disposeMesh(this.xyMesh);
    }
    if (this.xtMesh) {
      disposeMesh(this.xtMesh);
    }
    if (this.ytMesh) {
      disposeMesh(this.ytMesh);
    }
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  private replaceCut(
    kind: 'xy' | 'xt' | 'yt',
    image: SliceImage | null,
    color: number,
    opacity: number,
  ): void {
    const current =
      kind === 'xy' ? this.xyMesh : kind === 'xt' ? this.xtMesh : this.ytMesh;
    if (current) {
      disposeMesh(current);
      this.sliceGroup.remove(current);
    }
    if (!image) {
      if (kind === 'xy') {
        this.xyMesh = null;
      } else if (kind === 'xt') {
        this.xtMesh = null;
      } else {
        this.ytMesh = null;
      }
      return;
    }
    const texture = pixelsToTexture(image);
    const material = new MeshBasicMaterial({
      map: texture,
      color,
      transparent: true,
      opacity,
      side: DoubleSide,
      depthWrite: false,
    });
    const mesh = new Mesh(new PlaneGeometry(1, 1), material);
    this.sliceGroup.add(mesh);
    if (kind === 'xy') {
      this.xyMesh = mesh;
    } else if (kind === 'xt') {
      this.xtMesh = mesh;
    } else {
      this.ytMesh = mesh;
    }
  }

  private applyLayout(): void {
    for (const mesh of this.volumeMeshes) {
      const tNorm = Number(mesh.userData.tNorm ?? 0);
      mesh.position.set(0, 0, (tNorm - 0.5) * this.temporalScale);
    }
    this.applyCutTransforms();
  }

  private applyCutTransforms(): void {
    if (this.xyMesh) {
      this.xyMesh.rotation.set(0, 0, 0);
      this.xyMesh.scale.set(1, 1, 1);
      this.xyMesh.position.set(0, 0, (this.t0 - 0.5) * this.temporalScale);
    }
    if (this.xtMesh) {
      // Plane local XY -> world XZ (X-T), fixed Y
      this.xtMesh.rotation.set(Math.PI / 2, 0, 0);
      this.xtMesh.scale.set(1, this.temporalScale, 1);
      this.xtMesh.position.set(0, 0.5 - this.y0, 0);
    }
    if (this.ytMesh) {
      // Plane local XY -> world ZY (T-Y), fixed X
      this.ytMesh.rotation.set(0, Math.PI / 2, 0);
      this.ytMesh.scale.set(this.temporalScale, 1, 1);
      this.ytMesh.position.set(this.x0 - 0.5, 0, 0);
    }
  }

  private rebuildBounds(): void {
    while (this.boundsGroup.children.length > 0) {
      const child = this.boundsGroup.children[0]!;
      this.boundsGroup.remove(child);
      if (child instanceof Line) {
        child.geometry.dispose();
      }
    }
    if (this.boundsMaterial) {
      this.boundsMaterial.dispose();
      this.boundsMaterial = null;
    }

    const d = this.temporalScale * 0.5;
    const edges: Array<[Vector3, Vector3]> = [
      [new Vector3(-0.5, -0.5, -d), new Vector3(0.5, -0.5, -d)],
      [new Vector3(0.5, -0.5, -d), new Vector3(0.5, 0.5, -d)],
      [new Vector3(0.5, 0.5, -d), new Vector3(-0.5, 0.5, -d)],
      [new Vector3(-0.5, 0.5, -d), new Vector3(-0.5, -0.5, -d)],
      [new Vector3(-0.5, -0.5, d), new Vector3(0.5, -0.5, d)],
      [new Vector3(0.5, -0.5, d), new Vector3(0.5, 0.5, d)],
      [new Vector3(0.5, 0.5, d), new Vector3(-0.5, 0.5, d)],
      [new Vector3(-0.5, 0.5, d), new Vector3(-0.5, -0.5, d)],
      [new Vector3(-0.5, -0.5, -d), new Vector3(-0.5, -0.5, d)],
      [new Vector3(0.5, -0.5, -d), new Vector3(0.5, -0.5, d)],
      [new Vector3(0.5, 0.5, -d), new Vector3(0.5, 0.5, d)],
      [new Vector3(-0.5, 0.5, -d), new Vector3(-0.5, 0.5, d)],
    ];
    this.boundsMaterial = new LineBasicMaterial({ color: 0x3a4450 });
    for (const [a, b] of edges) {
      const geometry = new BufferGeometry().setFromPoints([a, b]);
      this.boundsGroup.add(new Line(geometry, this.boundsMaterial));
    }
  }

  private buildAxes(): void {
    const makeLine = (from: Vector3, to: Vector3, color: number) => {
      const geometry = new BufferGeometry().setFromPoints([from, to]);
      return new Line(geometry, new LineBasicMaterial({ color }));
    };
    this.axisGroup.add(makeLine(new Vector3(-0.5, -0.5, -0.5), new Vector3(0.75, -0.5, -0.5), 0xff6666));
    this.axisGroup.add(makeLine(new Vector3(-0.5, -0.5, -0.5), new Vector3(-0.5, 0.75, -0.5), 0x66ff99));
    this.axisGroup.add(makeLine(new Vector3(-0.5, -0.5, -0.5), new Vector3(-0.5, -0.5, 0.75), 0x6699ff));
    this.addAxisLabel('X', new Vector3(0.85, -0.5, -0.5), '#ff8888');
    this.addAxisLabel('Y', new Vector3(-0.5, 0.85, -0.5), '#88ffaa');
    this.addAxisLabel('T', new Vector3(-0.5, -0.5, 0.9), '#88aaff');
  }

  private addAxisLabel(text: string, position: Vector3, color: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.fillStyle = color;
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText(text, 24, 48);
    const texture = new CanvasTexture(canvas);
    const material = new MeshBasicMaterial({ map: texture, transparent: true, side: DoubleSide });
    const mesh = new Mesh(new PlaneGeometry(0.28, 0.14), material);
    mesh.position.copy(position);
    this.axisGroup.add(mesh);
  }

  private readonly resize = (): void => {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly tick = (): void => {
    if (this.disposed) {
      return;
    }
    this.controls.update();
    for (const child of this.axisGroup.children) {
      if (child instanceof Mesh) {
        child.quaternion.copy(this.camera.quaternion);
      }
    }
    this.renderer.render(this.scene, this.camera);
    this.animationId = requestAnimationFrame(this.tick);
  };
}
