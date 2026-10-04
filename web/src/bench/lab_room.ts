import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  cabinetTexture,
  countertopTextures,
  floorTexture,
  paintTexture,
  tileTextures,
  windowTexture,
  woodTexture,
} from '../render/textures';
import { GAS_CYLINDER_POS, MASS_SPEC_POS, NMR_CRYO_POS, NMR_FIVE_GAUSS_R, ROOM } from './layout';

/**
 * Static lab environment. 1 unit = 1 cm. Bench top surface is y = 0; the front edge of the worktop is at z = +32,
 * the back wall at z = -45. The reagent shelf stands at the back of the bench (3 tiers × 9 slots).
 */
export const BENCH = { xMin: -120, xMax: 120, zMin: -45, zMax: 32, thickness: 3.2, floorY: -90 };
export const ANALYTICAL_BENCH = { xMin: -95, xMax: 108, zMin: 76, zMax: 141, thickness: 3.2, floorY: -90 };
export const SHELF = {
  tiers: [1.6, 21.6, 41.6], // standing heights of the tiers
  slots: 9,
  spacing: 12.6,
  z: -36.5,
  xCenter: 0,
};

const ROOM_W = ROOM.xMax - ROOM.xMin;
const ROOM_CX = (ROOM.xMax + ROOM.xMin) / 2;

export interface LabRoom {
  keyLight: THREE.DirectionalLight;
  fireLight: THREE.PointLight;
  /** Shelf slot positions [tier][slot] (world, bottle base). */
  shelfSlots: THREE.Vector3[][];
  dispose(): void;
}

export function buildLabRoom(scene: THREE.Scene, renderer: THREE.WebGLRenderer): LabRoom {
  // ---------------------------------------------------------------- image based lighting
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.38;
  pmrem.dispose();
  scene.background = new THREE.Color(0x8a9299);

  // ---------------------------------------------------------------- lights
  const hemi = new THREE.HemisphereLight(0xdde3eb, 0x363430, 0.22);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff4e6, 1.15);
  key.position.set(-55, 170, 95);
  key.target.position.set(0, 0, -6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -135;
  sc.right = 135;
  sc.top = 95;
  sc.bottom = -95;
  sc.near = 40;
  sc.far = 380;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.1;
  key.shadow.radius = 3;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(0xdce7ff, 0.28);
  fill.position.set(110, 80, 70);
  scene.add(fill);

  const back = new THREE.DirectionalLight(0xffffff, 0.18);
  back.position.set(30, 120, -120);
  scene.add(back);

  const fireLight = new THREE.PointLight(0xff9a3c, 0, 160, 2);
  fireLight.position.set(0, 20, 0);
  scene.add(fireLight);

  // ---------------------------------------------------------------- worktop
  const top = countertopTextures();
  const topMap = top.map.clone();
  topMap.repeat.set(2.2, 0.75);
  topMap.needsUpdate = true;
  const topRough = top.roughnessMap.clone();
  topRough.repeat.set(2.2, 0.75);
  topRough.needsUpdate = true;
  const benchMat = new THREE.MeshPhysicalMaterial({
    map: topMap,
    roughnessMap: topRough,
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.22,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.45,
  });
  const W = BENCH.xMax - BENCH.xMin;
  const D = BENCH.zMax - BENCH.zMin;
  const benchShape = new THREE.Shape();
  const r = 1.2;
  benchShape.moveTo(BENCH.xMin, BENCH.zMin);
  benchShape.lineTo(BENCH.xMax, BENCH.zMin);
  benchShape.lineTo(BENCH.xMax, BENCH.zMax - r);
  benchShape.quadraticCurveTo(BENCH.xMax, BENCH.zMax, BENCH.xMax - r, BENCH.zMax);
  benchShape.lineTo(BENCH.xMin + r, BENCH.zMax);
  benchShape.quadraticCurveTo(BENCH.xMin, BENCH.zMax, BENCH.xMin, BENCH.zMax - r);
  benchShape.lineTo(BENCH.xMin, BENCH.zMin);
  const benchGeo = new THREE.ExtrudeGeometry(benchShape, {
    depth: BENCH.thickness - 0.8,
    bevelEnabled: true,
    bevelThickness: 0.4,
    bevelSize: 0.4,
    bevelSegments: 3,
    curveSegments: 4,
  });
  // shape is in XY (y = z); extrude along +Z -> rotate so extrusion goes down
  benchGeo.rotateX(Math.PI / 2);
  benchGeo.translate(0, -0.4, 0);
  // planar UVs from world xz
  {
    const pos = benchGeo.attributes.position as THREE.BufferAttribute;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) - BENCH.xMin) / W;
      uv[i * 2 + 1] = (pos.getZ(i) - BENCH.zMin) / D + pos.getY(i) * 0.01;
    }
    benchGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  const bench = new THREE.Mesh(benchGeo, benchMat);
  bench.receiveShadow = true;
  bench.castShadow = false;
  scene.add(bench);

  // cabinets below the worktop
  const cabTex = cabinetTexture().clone();
  cabTex.repeat.set(3, 1);
  cabTex.wrapS = THREE.RepeatWrapping;
  cabTex.needsUpdate = true;
  const cabMat = new THREE.MeshStandardMaterial({ map: cabTex, roughness: 0.6, metalness: 0 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(W - 4, -BENCH.floorY - BENCH.thickness - 10, D - 6), [
    new THREE.MeshStandardMaterial({ color: 0xc9cdcb, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0xc9cdcb, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0xc9cdcb, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0xc9cdcb, roughness: 0.7 }),
    cabMat,
    new THREE.MeshStandardMaterial({ color: 0xc9cdcb, roughness: 0.7 }),
  ]);
  const cabH = -BENCH.floorY - BENCH.thickness - 10;
  cab.position.set(0, -BENCH.thickness - cabH / 2, (BENCH.zMin + BENCH.zMax) / 2 - 2);
  cab.receiveShadow = true;
  scene.add(cab);
  const kick = new THREE.Mesh(new THREE.BoxGeometry(W - 6, 10, D - 12), new THREE.MeshStandardMaterial({ color: 0x2d3033, roughness: 0.8 }));
  kick.position.set(0, BENCH.floorY + 5, (BENCH.zMin + BENCH.zMax) / 2 - 5);
  scene.add(kick);

  // floor
  const fTex = floorTexture().clone();
  fTex.repeat.set((ROOM_W + 120) / 50, 12);
  fTex.needsUpdate = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W + 120, 600), new THREE.MeshStandardMaterial({ map: fTex, roughness: 0.75 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(ROOM_CX, BENCH.floorY, 100);
  floor.receiveShadow = true;
  scene.add(floor);

  // ---------------------------------------------------------------- walls
  const tiles = tileTextures();
  const tileRep = (t: THREE.Texture) => {
    const c = t.clone();
    c.repeat.set(320 / 60, 75 / 30);
    c.needsUpdate = true;
    return c;
  };
  const tileMat = new THREE.MeshStandardMaterial({
    map: tileRep(tiles.map),
    roughnessMap: tileRep(tiles.roughnessMap),
    bumpMap: tileRep(tiles.bumpMap),
    bumpScale: 0.6,
    roughness: 1,
    metalness: 0,
  });
  const tileWall = new THREE.Mesh(new THREE.PlaneGeometry(320, 75), tileMat);
  tileWall.position.set(0, 37.5, BENCH.zMin);
  tileWall.receiveShadow = true;
  scene.add(tileWall);

  const paint = paintTexture('#dfe3dd').clone();
  paint.repeat.set(4, 2);
  paint.needsUpdate = true;
  const paintMat = new THREE.MeshStandardMaterial({ map: paint, roughness: 0.92, metalness: 0 });
  // back wall: tiled splash behind the wet bench, painted everywhere else (the room runs on to the right, the NMR bay)
  const upper = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, 145), paintMat);
  upper.position.set(ROOM_CX, 75 + 72.5, BENCH.zMin);
  scene.add(upper);
  const lower = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, -BENCH.floorY), paintMat);
  lower.position.set(ROOM_CX, BENCH.floorY / 2, BENCH.zMin - 0.2);
  scene.add(lower);
  const rightSplash = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.xMax - 160, 75), paintMat);
  rightSplash.position.set((ROOM.xMax + 160) / 2, 37.5, BENCH.zMin);
  scene.add(rightSplash);
  // side walls
  for (const sx of [ROOM.xMin, ROOM.xMax]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(400, 310), paintMat);
    wall.position.set(sx, BENCH.floorY + 155, 155);
    wall.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
    wall.receiveShadow = true;
    scene.add(wall);
  }
  // window on the left wall (soft daylight source in reflections)
  const win = new THREE.Mesh(
    new THREE.PlaneGeometry(110, 90),
    new THREE.MeshBasicMaterial({ map: windowTexture(), toneMapped: true, color: 0xd8e0e6 })
  );
  win.position.set(-159.5, 70, 40);
  win.rotation.y = Math.PI / 2;
  scene.add(win);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 116), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.6 }));
  sill.position.set(-157, 24, 40);
  scene.add(sill);
  // ceiling
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, 400), new THREE.MeshStandardMaterial({ color: 0xdcdfdc, roughness: 0.95 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(ROOM_CX, ROOM.ceilingY, 155);
  scene.add(ceiling);
  // recessed 60 x 120 troffers: two rows over the benches, one over the instruments, two over the NMR bay
  const troffer = new THREE.MeshBasicMaterial({ color: 0xd2d9e0, toneMapped: true });
  const troffFrame = new THREE.MeshStandardMaterial({ color: 0xb9bec2, roughness: 0.6 });
  const troffers: Array<[number, number]> = [[-60, 20], [60, 20], [-45, 106], [45, 106], [230, 40], [230, 140], [320, 40], [320, 140], [170, 140]];
  for (const [lx, lz] of troffers) {
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(64, 34), troffFrame);
    frame.rotation.x = Math.PI / 2;
    frame.position.set(lx, ROOM.ceilingY - 0.3, lz);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), troffer);
    panel.rotation.x = Math.PI / 2;
    panel.position.set(lx, ROOM.ceilingY - 0.5, lz);
    scene.add(frame, panel);
  }
  // cove base along the walls
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x2d3235, roughness: 0.8 });
  const baseBack = new THREE.Mesh(new THREE.BoxGeometry(ROOM.xMax - 162, 9, 1.2), baseMat);
  baseBack.position.set((ROOM.xMax + 162) / 2, BENCH.floorY + 4.5, BENCH.zMin + 0.6);
  const baseRight = new THREE.Mesh(new THREE.BoxGeometry(1.2, 9, 400), baseMat);
  baseRight.position.set(ROOM.xMax - 0.6, BENCH.floorY + 4.5, 155);
  const baseLeft = baseRight.clone();
  baseLeft.position.x = ROOM.xMin + 0.6;
  scene.add(baseBack, baseRight, baseLeft);

  // ---------------------------------------------------------------- reagent shelf
  const wood = woodTexture().clone();
  wood.repeat.set(1.5, 1);
  wood.needsUpdate = true;
  const woodMat = new THREE.MeshStandardMaterial({ map: wood, roughness: 0.6, metalness: 0, color: 0xe8dccb });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc3c8cc, metalness: 1, roughness: 0.32 });
  const shelfW = SHELF.slots * SHELF.spacing + 4;
  const shelfD = 13;
  const x0 = SHELF.xCenter - shelfW / 2;
  for (let t = 0; t < SHELF.tiers.length; t++) {
    const y = SHELF.tiers[t];
    const board = new THREE.Mesh(new THREE.BoxGeometry(shelfW, 1.6, shelfD), woodMat);
    board.position.set(SHELF.xCenter, y - 0.8, SHELF.z);
    board.castShadow = true;
    board.receiveShadow = true;
    scene.add(board);
    // front guard rail
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, shelfW, 10), steel);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(SHELF.xCenter, y + 3.0, SHELF.z + shelfD / 2 - 0.4);
    rail.castShadow = true;
    scene.add(rail);
    for (const ex of [x0 + 0.4, x0 + shelfW - 0.4]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.0, 8), steel);
      post.position.set(ex, y + 1.5, SHELF.z + shelfD / 2 - 0.4);
      scene.add(post);
    }
  }
  // uprights
  const upH = SHELF.tiers[SHELF.tiers.length - 1] + 24;
  for (const ux of [x0 + 0.9, x0 + shelfW - 0.9]) {
    for (const uz of [SHELF.z - shelfD / 2 + 0.9, SHELF.z + shelfD / 2 - 0.9]) {
      const u = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, upH, 14), steel);
      u.position.set(ux, upH / 2, uz);
      u.castShadow = true;
      scene.add(u);
    }
  }

  const shelfSlots: THREE.Vector3[][] = SHELF.tiers.map((y) => {
    const row: THREE.Vector3[] = [];
    for (let i = 0; i < SHELF.slots; i++) {
      row.push(new THREE.Vector3(SHELF.xCenter - ((SHELF.slots - 1) * SHELF.spacing) / 2 + i * SHELF.spacing, y, SHELF.z));
    }
    return row;
  });

  // a few static props for context (wash bottle, paper towels)
  addProps(scene);
  buildAnalyticalBench(scene);
  buildNmrBay(scene);
  buildGasSupply(scene);

  return {
    keyLight: key,
    fireLight,
    shelfSlots,
    dispose: () => envRT.dispose(),
  };
}

function addProps(scene: THREE.Scene) {
  // LDPE wash bottle
  const ldpe = new THREE.MeshPhysicalMaterial({ color: 0xf3f4f2, roughness: 0.4, transmission: 0, transparent: true, opacity: 0.92, sheen: 0.3 });
  const pts = [
    new THREE.Vector2(0, 0), new THREE.Vector2(3.6, 0), new THREE.Vector2(3.9, 0.6), new THREE.Vector2(3.9, 14),
    new THREE.Vector2(3.0, 16), new THREE.Vector2(1.4, 17.2), new THREE.Vector2(1.4, 18.0), new THREE.Vector2(0, 18.0),
  ];
  const wb = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), ldpe);
  body.castShadow = true;
  wb.add(body);
  const capM = new THREE.MeshStandardMaterial({ color: 0x2f7fd0, roughness: 0.45 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 1.8, 24), capM);
  cap.position.y = 18.8;
  wb.add(cap);
  const nozzle = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 19.6, 0), new THREE.Vector3(0, 23, 0), new THREE.Vector3(1.5, 25, 0), new THREE.Vector3(5, 24, 0)]), 20, 0.22, 8),
    new THREE.MeshStandardMaterial({ color: 0xf0f0ee, roughness: 0.5 })
  );
  wb.add(nozzle);
  wb.position.set(-104, 0, -20);
  wb.rotation.y = 0.6;
  scene.add(wb);

  // paper towel roll on a holder
  const roll = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 6, 24, 40),
    new THREE.MeshStandardMaterial({ color: 0xf6f5f0, roughness: 0.95 })
  );
  roll.rotation.z = Math.PI / 2;
  roll.position.set(104, 7.2, -32);
  roll.castShadow = true;
  roll.receiveShadow = true;
  scene.add(roll);
  const holder = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 10), new THREE.MeshStandardMaterial({ color: 0xb8bdc1, metalness: 1, roughness: 0.35 }));
  holder.position.set(104, 0.5, -32);
  scene.add(holder);
}

function buildAnalyticalBench(scene: THREE.Scene) {
  const W = ANALYTICAL_BENCH.xMax - ANALYTICAL_BENCH.xMin;
  const D = ANALYTICAL_BENCH.zMax - ANALYTICAL_BENCH.zMin;

  const top = countertopTextures();
  const topMap = top.map.clone();
  topMap.repeat.set(1.8, 0.5);
  topMap.needsUpdate = true;
  const topRough = top.roughnessMap.clone();
  topRough.repeat.set(1.8, 0.5);
  topRough.needsUpdate = true;
  const benchMat = new THREE.MeshPhysicalMaterial({
    map: topMap,
    roughnessMap: topRough,
    roughness: 0.52,
    metalness: 0,
    clearcoat: 0.22,
    envMapIntensity: 0.45,
  });

  const benchShape = new THREE.Shape();
  const r = 1.0;
  benchShape.moveTo(ANALYTICAL_BENCH.xMin, ANALYTICAL_BENCH.zMin);
  benchShape.lineTo(ANALYTICAL_BENCH.xMax, ANALYTICAL_BENCH.zMin);
  benchShape.lineTo(ANALYTICAL_BENCH.xMax, ANALYTICAL_BENCH.zMax - r);
  benchShape.quadraticCurveTo(ANALYTICAL_BENCH.xMax, ANALYTICAL_BENCH.zMax, ANALYTICAL_BENCH.xMax - r, ANALYTICAL_BENCH.zMax);
  benchShape.lineTo(ANALYTICAL_BENCH.xMin + r, ANALYTICAL_BENCH.zMax);
  benchShape.quadraticCurveTo(ANALYTICAL_BENCH.xMin, ANALYTICAL_BENCH.zMax, ANALYTICAL_BENCH.xMin, ANALYTICAL_BENCH.zMax - r);
  benchShape.lineTo(ANALYTICAL_BENCH.xMin, ANALYTICAL_BENCH.zMin);

  const benchGeo = new THREE.ExtrudeGeometry(benchShape, {
    depth: ANALYTICAL_BENCH.thickness - 0.8,
    bevelEnabled: true,
    bevelThickness: 0.4,
    bevelSize: 0.4,
    bevelSegments: 3,
    curveSegments: 4,
  });
  benchGeo.rotateX(Math.PI / 2);
  benchGeo.translate(0, -0.4, 0);
  {
    const pos = benchGeo.attributes.position as THREE.BufferAttribute;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) - ANALYTICAL_BENCH.xMin) / W;
      uv[i * 2 + 1] = (pos.getZ(i) - ANALYTICAL_BENCH.zMin) / D + pos.getY(i) * 0.01;
    }
    benchGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  const benchMesh = new THREE.Mesh(benchGeo, benchMat);
  benchMesh.receiveShadow = true;
  scene.add(benchMesh);

  // Cabinets
  const cabTex = cabinetTexture().clone();
  cabTex.repeat.set(2.5, 1);
  cabTex.needsUpdate = true;
  const cabMat = new THREE.MeshStandardMaterial({ map: cabTex, roughness: 0.6, metalness: 0 });
  const cabH = -ANALYTICAL_BENCH.floorY - ANALYTICAL_BENCH.thickness - 10;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(W - 4, cabH, D - 6), [
    new THREE.MeshStandardMaterial({ color: 0xc9cdcb, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0xc9cdcb, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0xc9cdcb, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0xc9cdcb, roughness: 0.7 }),
    cabMat,
    new THREE.MeshStandardMaterial({ color: 0xc9cdcb, roughness: 0.7 }),
  ]);
  cab.position.set((ANALYTICAL_BENCH.xMin + ANALYTICAL_BENCH.xMax) / 2, -ANALYTICAL_BENCH.thickness - cabH / 2, (ANALYTICAL_BENCH.zMin + ANALYTICAL_BENCH.zMax) / 2);
  cab.receiveShadow = true;
  scene.add(cab);

  const kick = new THREE.Mesh(new THREE.BoxGeometry(W - 6, 10, D - 10), new THREE.MeshStandardMaterial({ color: 0x2d3033, roughness: 0.8 }));
  kick.position.set((ANALYTICAL_BENCH.xMin + ANALYTICAL_BENCH.xMax) / 2, ANALYTICAL_BENCH.floorY + 5, (ANALYTICAL_BENCH.zMin + ANALYTICAL_BENCH.zMax) / 2);
  scene.add(kick);

  // Electrical raceway bar on back edge
  const raceway = new THREE.Mesh(new THREE.BoxGeometry(W - 2, 6, 3), new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.7, roughness: 0.3 }));
  raceway.position.set((ANALYTICAL_BENCH.xMin + ANALYTICAL_BENCH.xMax) / 2, 3, ANALYTICAL_BENCH.zMin + 1.6);
  scene.add(raceway);
  // duplex sockets along the raceway
  const socketMat = new THREE.MeshStandardMaterial({ color: 0xf2f3f1, roughness: 0.5 });
  for (let x = ANALYTICAL_BENCH.xMin + 14; x < ANALYTICAL_BENCH.xMax - 6; x += 24) {
    const sock = new THREE.Mesh(new THREE.BoxGeometry(6.4, 4.2, 0.4), socketMat);
    sock.position.set(x, 3, ANALYTICAL_BENCH.zMin + 3.3);
    scene.add(sock);
  }

  // the lab PC (monitor, keyboard) is the instruments' own workstation: equipment/workstation.ts
}

// ---------------------------------------------------------------------------------------------------------------- props
const steelMat = () => new THREE.MeshStandardMaterial({ color: 0xc9ced2, metalness: 0.9, roughness: 0.3 });

function signTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w: number, h: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Warning triangle with a horseshoe magnet, and the text lines under it. */
function magnetSignTexture(): THREE.CanvasTexture {
  return signTexture((ctx, w, h) => {
    ctx.fillStyle = '#f4d300';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 8;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.07);
    ctx.lineTo(w * 0.86, h * 0.5);
    ctx.lineTo(w * 0.14, h * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4d300';
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.14);
    ctx.lineTo(w * 0.78, h * 0.46);
    ctx.lineTo(w * 0.22, h * 0.46);
    ctx.closePath();
    ctx.fill();
    // horseshoe magnet
    ctx.strokeStyle = '#111';
    ctx.lineWidth = w * 0.045;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.34, w * 0.1, Math.PI, 0, false);
    ctx.lineTo(w / 2 + w * 0.1, h * 0.41);
    ctx.moveTo(w / 2 - w * 0.1, h * 0.34);
    ctx.lineTo(w / 2 - w * 0.1, h * 0.41);
    ctx.stroke();
    ctx.fillStyle = '#c62828';
    ctx.fillRect(w / 2 - w * 0.123, h * 0.405, w * 0.046, h * 0.035);
    ctx.fillStyle = '#1565c0';
    ctx.fillRect(w / 2 + w * 0.077, h * 0.405, w * 0.046, h * 0.035);
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(h * 0.075)}px Arial, sans-serif`;
    ctx.fillText('STRONG MAGNETIC FIELD', w / 2, h * 0.6);
    ctx.font = `700 ${Math.round(h * 0.048)}px Arial, sans-serif`;
    ctx.fillText('Pacemaker and implant wearers', w / 2, h * 0.7);
    ctx.fillText('keep out', w / 2, h * 0.755);
    ctx.fillText('No watches, cards or steel tools', w / 2, h * 0.83);
    ctx.fillText('beyond the 5 gauss line', w / 2, h * 0.885);
  }, 384, 512);
}

/**
 * The NMR bay: taped 5-gauss zone with stanchions and chains, the quench vent to the ceiling, warning signs and a door in the
 * back wall, a cryogen dewar on a cart, a step stool at the magnet and a fire extinguisher.
 */
function buildNmrBay(scene: THREE.Scene) {
  const cx = NMR_CRYO_POS.x;
  const cz = NMR_CRYO_POS.z;
  const fy = NMR_CRYO_POS.y;
  const R = NMR_FIVE_GAUSS_R;

  // floor tape: yellow band with a black edge line
  const tape = new THREE.Mesh(new THREE.RingGeometry(R - 1.8, R, 96), new THREE.MeshStandardMaterial({ color: 0xf2c500, roughness: 0.6, side: THREE.DoubleSide }));
  tape.rotation.x = -Math.PI / 2;
  tape.position.set(cx, fy + 0.12, cz);
  tape.receiveShadow = true;
  const edge = new THREE.Mesh(new THREE.RingGeometry(R - 3.1, R - 2.2, 96), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6, side: THREE.DoubleSide }));
  edge.rotation.x = -Math.PI / 2;
  edge.position.set(cx, fy + 0.13, cz);
  scene.add(tape, edge);

  // stanchions and chains, open toward the console (-x)
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xe0b400, roughness: 0.45, metalness: 0.3 });
  const chrome = steelMat();
  const chainMat = new THREE.MeshStandardMaterial({ color: 0xc9a100, roughness: 0.5, metalness: 0.4 });
  const posts: THREE.Vector3[] = [];
  const n = 7;
  const a0 = Math.PI + 0.6;
  const span = 2 * Math.PI - 1.2;
  for (let i = 0; i < n; i++) {
    const a = a0 + (i * span) / (n - 1);
    const p = new THREE.Vector3(cx + (R + 2.5) * Math.cos(a), fy, cz + (R + 2.5) * Math.sin(a));
    posts.push(p);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.4, 1.4, 28), new THREE.MeshStandardMaterial({ color: 0x25292d, roughness: 0.6, metalness: 0.5 }));
    base.position.set(p.x, fy + 0.7, p.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 92, 14), poleMat);
    pole.position.set(p.x, fy + 47, p.z);
    pole.castShadow = true;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.7, 16, 12), chrome);
    cap.position.set(p.x, fy + 93.2, p.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.25, 8, 16), chrome);
    ring.position.set(p.x, fy + 84, p.z);
    ring.rotation.x = Math.PI / 2;
    scene.add(base, pole, cap, ring);
  }
  for (let i = 0; i + 1 < n; i++) {
    const a = posts[i].clone().setY(fy + 84);
    const b = posts[i + 1].clone().setY(fy + 84);
    const mid = a.clone().lerp(b, 0.5).setY(fy + 74);
    const q1 = a.clone().lerp(b, 0.25).setY(fy + 78.5);
    const q3 = a.clone().lerp(b, 0.75).setY(fy + 78.5);
    const chain = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, q1, mid, q3, b]), 24, 0.45, 6, false), chainMat);
    chain.castShadow = true;
    scene.add(chain);
  }

  // quench vent pipe from the helium turret up to the ceiling, with a flexible hose from the turret
  const vx = cx - 22;
  const vz = cz - 26;
  const pipeBottom = fy + 168;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, ROOM.ceilingY - pipeBottom, 24), new THREE.MeshStandardMaterial({ color: 0xb8bec3, metalness: 0.85, roughness: 0.38 }));
  pipe.position.set(vx, (ROOM.ceilingY + pipeBottom) / 2, vz);
  pipe.castShadow = true;
  scene.add(pipe);
  for (const y of [pipeBottom + 4, 120, 190]) {
    const clamp = new THREE.Mesh(new THREE.CylinderGeometry(4.9, 4.9, 2.4, 24), new THREE.MeshStandardMaterial({ color: 0x3a4046, metalness: 0.6, roughness: 0.5 }));
    clamp.position.set(vx, y, vz);
    scene.add(clamp);
  }
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 1.6, 28), new THREE.MeshStandardMaterial({ color: 0x3a4046, metalness: 0.6, roughness: 0.5 }));
  flange.position.set(vx, ROOM.ceilingY - 0.8, vz);
  scene.add(flange);
  const hose = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(cx - 9.5, fy + 160, cz - 8), new THREE.Vector3(cx - 12, fy + 171, cz - 14), new THREE.Vector3(cx - 17, fy + 168, cz - 22), new THREE.Vector3(vx, pipeBottom + 0.5, vz)]), 24, 1.3, 10, false),
    new THREE.MeshStandardMaterial({ color: 0x20252a, roughness: 0.7, metalness: 0.2 })
  );
  scene.add(hose);

  // signs on the back wall behind the magnet
  const signMat = new THREE.MeshBasicMaterial({ map: magnetSignTexture(), toneMapped: true, color: 0xe6e6e6 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(33, 44), signMat);
  sign.position.set(cx - 50, 62, ROOM.zBack + 0.3);
  scene.add(sign);

  // door in the back wall with a magnet sign; leaf, frame, vision panel, lever handle
  const doorX = ROOM.xMax - 52;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a6, roughness: 0.5, metalness: 0.5 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xb6896a, roughness: 0.7 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(92, 204, 4), leafMat);
  door.position.set(doorX, fy + 102, ROOM.zBack + 2.2);
  door.receiveShadow = true;
  scene.add(door);
  for (const [dx, w, h, dy] of [[-48, 4, 212, 106], [48, 4, 212, 106], [0, 100, 4, 212]] as Array<[number, number, number, number]>) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, 6), frameMat);
    f.position.set(doorX + dx, fy + dy, ROOM.zBack + 3);
    scene.add(f);
  }
  const vision = new THREE.Mesh(new THREE.PlaneGeometry(16, 60), new THREE.MeshStandardMaterial({ color: 0x9db4c0, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.55 }));
  vision.position.set(doorX, fy + 130, ROOM.zBack + 4.3);
  scene.add(vision);
  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 12, 12), chrome);
  lever.rotation.z = Math.PI / 2;
  lever.position.set(doorX - 34, fy + 100, ROOM.zBack + 7);
  const rose = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.2, 20), chrome);
  rose.rotation.x = Math.PI / 2;
  rose.position.set(doorX - 38, fy + 100, ROOM.zBack + 4.6);
  scene.add(lever, rose);
  const doorSign = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 14),
    new THREE.MeshBasicMaterial({
      map: signTexture((ctx, w, h) => {
        ctx.fillStyle = '#143a6b';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `800 ${Math.round(h * 0.28)}px Arial, sans-serif`;
        ctx.fillText('NMR FACILITY', w / 2, h * 0.32);
        ctx.font = `700 ${Math.round(h * 0.17)}px Arial, sans-serif`;
        ctx.fillText('Strong magnetic field', w / 2, h * 0.64);
        ctx.fillText('Authorised users only', w / 2, h * 0.85);
      }, 440, 280),
      toneMapped: true,
    })
  );
  doorSign.position.set(doorX, fy + 172, ROOM.zBack + 4.4);
  scene.add(doorSign);

  // fire extinguisher on a bracket
  const ext = new THREE.Group();
  const extBody = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 36, 24), new THREE.MeshStandardMaterial({ color: 0xc4251c, roughness: 0.4, metalness: 0.3 }));
  extBody.position.y = 18;
  const extNeck = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 4.8, 4, 20), new THREE.MeshStandardMaterial({ color: 0xc4251c, roughness: 0.4, metalness: 0.3 }));
  extNeck.position.y = 38;
  const extHead = new THREE.Mesh(new THREE.BoxGeometry(7, 3.4, 4.2), new THREE.MeshStandardMaterial({ color: 0x20252a, roughness: 0.5 }));
  extHead.position.set(0, 41.4, 0);
  const extHose = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(3, 40, 0), new THREE.Vector3(8, 36, 1), new THREE.Vector3(7, 24, 2), new THREE.Vector3(5, 20, 3)]), 12, 0.6, 8, false),
    new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.8 })
  );
  const strap = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 3, 24), new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: 0.6 }));
  strap.position.y = 26;
  ext.add(extBody, extNeck, extHead, extHose, strap);
  ext.position.set(200, fy + 62, ROOM.zBack + 6);
  scene.add(ext);
  // this is a non-magnetic (aluminium / brass free) model: say so on its label
  const extLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(7.5, 10),
    new THREE.MeshBasicMaterial({
      map: signTexture((ctx, w, h) => {
        ctx.fillStyle = '#f2f2ee';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#1b3a8a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `800 ${Math.round(h * 0.16)}px Arial, sans-serif`;
        ctx.fillText('NON-', w / 2, h * 0.3);
        ctx.fillText('MAGNETIC', w / 2, h * 0.5);
        ctx.fillStyle = '#111';
        ctx.font = `700 ${Math.round(h * 0.12)}px Arial, sans-serif`;
        ctx.fillText('CO2', w / 2, h * 0.75);
      }, 150, 200),
      toneMapped: true,
    })
  );
  extLabel.position.set(0, 19, 5.25);
  ext.add(extLabel);

  // cryogen dewar on a cart, parked outside the 5 gauss line (non-magnetic stainless)
  const cart = new THREE.Group();
  const dewarProf = [[0, 0], [20, 0], [21.5, 1.5], [21.8, 6], [21.8, 82], [21.2, 88], [16, 94], [9, 98], [6.5, 100], [6.5, 108], [0, 108]].map(([r, y]) => new THREE.Vector2(r, y));
  const dewar = new THREE.Mesh(new THREE.LatheGeometry(dewarProf, 40), new THREE.MeshStandardMaterial({ color: 0xcfd4d8, metalness: 0.9, roughness: 0.3 }));
  dewar.position.y = 14;
  dewar.castShadow = true;
  const dewarTop = new THREE.Mesh(new THREE.CylinderGeometry(6.8, 6.8, 3, 24), new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.5 }));
  dewarTop.position.y = 14 + 109.5;
  const tray = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 2.4, 36), new THREE.MeshStandardMaterial({ color: 0x2a2f34, metalness: 0.6, roughness: 0.5 }));
  tray.position.y = 11;
  cart.add(dewar, dewarTop, tray);
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI / 4 + (i * Math.PI) / 2;
    const wheelFork = new THREE.Mesh(new THREE.BoxGeometry(1.6, 6, 5), new THREE.MeshStandardMaterial({ color: 0x1f2326, metalness: 0.6, roughness: 0.5 }));
    wheelFork.position.set(Math.cos(ang) * 21, 7.5, Math.sin(ang) * 21);
    wheelFork.rotation.y = -ang;
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 2.6, 20), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.9 }));
    wheel.rotation.x = Math.PI / 2;
    wheel.rotation.z = 0;
    wheel.position.set(Math.cos(ang) * 21, 4.2, Math.sin(ang) * 21);
    wheel.rotation.y = -ang;
    cart.add(wheelFork, wheel);
  }
  cart.position.set(cx + 30, fy, cz - R - 30);
  scene.add(cart);

  // aluminium step stool at the magnet (the sample lift is above head height)
  const stool = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({ color: 0xaeb4b9, metalness: 0.8, roughness: 0.4 });
  const tread = new THREE.MeshStandardMaterial({ color: 0x4a4f54, roughness: 0.85 });
  for (const [h, d, w] of [[25, 22, 46], [50, 14, 46]] as Array<[number, number, number]>) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, 2, d), tread);
    t.position.set(0, h, h > 30 ? -13 : 9);
    t.castShadow = true;
    stool.add(t);
  }
  for (const sx of [-21, 21]) {
    const front = new THREE.Mesh(new THREE.BoxGeometry(2.2, 52, 2.2), alu);
    front.position.set(sx, 26, 15);
    front.rotation.x = -0.12;
    const rear = new THREE.Mesh(new THREE.BoxGeometry(2.2, 52, 2.2), alu);
    rear.position.set(sx, 26, -22);
    rear.rotation.x = 0.0;
    stool.add(front, rear);
  }
  stool.position.set(cx - 10, fy, cz + 38);
  stool.rotation.y = Math.PI;
  scene.add(stool);
}

/** Gas cylinders beside the GC/MS (helium carrier gas, nitrogen) in a floor stand with chains, regulators and a copper line. */
function buildGasSupply(scene: THREE.Scene) {
  const copper = new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.85, roughness: 0.35 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.85, roughness: 0.3 });
  const chrome = steelMat();
  const colours = [0x7a4a21, 0x26292d]; // helium: brown, nitrogen: black
  const profile = [[0, 0], [10.6, 0], [11.4, 1.5], [11.6, 5], [11.6, 112], [11.2, 122], [9.4, 130], [5.4, 135], [2.8, 137], [2.8, 141], [0, 141]].map(([r, y]) => new THREE.Vector2(r, y));
  GAS_CYLINDER_POS.forEach((p, i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 36), new THREE.MeshStandardMaterial({ color: colours[i], roughness: 0.42, metalness: 0.35 }));
    body.castShadow = true;
    g.add(body);
    // shoulder band in the gas colour code, regulator with two gauges
    const band = new THREE.Mesh(new THREE.CylinderGeometry(11.7, 11.7, 6, 36, 1, true), new THREE.MeshStandardMaterial({ color: i === 0 ? 0xe8e4d8 : 0xe8e4d8, roughness: 0.5, side: THREE.DoubleSide }));
    band.position.y = 104;
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 8, 20), brass);
    valve.position.y = 144;
    const regBody = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 8, 24), brass);
    regBody.rotation.z = Math.PI / 2;
    regBody.position.set(0, 151, 0);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 3, 20), new THREE.MeshStandardMaterial({ color: 0x25292d, roughness: 0.6 }));
    knob.rotation.z = Math.PI / 2;
    knob.position.set(-6.5, 151, 0);
    g.add(band, valve, regBody, knob);
    for (const [gx, gy] of [[0, 157.5], [3, 150.5]] as Array<[number, number]>) {
      const gauge = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 2.2, 28), chrome);
      gauge.rotation.x = Math.PI / 2;
      gauge.position.set(gx, gy, 4.4);
      const face = new THREE.Mesh(new THREE.CircleGeometry(2.9, 28), new THREE.MeshBasicMaterial({ color: 0xf2f2ee, toneMapped: true }));
      face.position.set(gx, gy, 5.55);
      const needle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 0.1), new THREE.MeshBasicMaterial({ color: 0xc62828 }));
      needle.position.set(gx, gy + 0.5, 5.6);
      needle.rotation.z = -0.7 + 0.5 * i;
      g.add(gauge, face, needle);
    }
    g.position.set(p.x, p.y, p.z);
    scene.add(g);
  });
  // floor stand: base plate, back post and two chains
  const a = GAS_CYLINDER_POS[0];
  const b = GAS_CYLINDER_POS[1];
  const stand = new THREE.Mesh(new THREE.BoxGeometry(32, 3, b.z - a.z + 34), new THREE.MeshStandardMaterial({ color: 0x3a4046, metalness: 0.6, roughness: 0.55 }));
  stand.position.set(a.x, a.y + 1.5, (a.z + b.z) / 2);
  scene.add(stand);
  const post = new THREE.Mesh(new THREE.BoxGeometry(2.4, 110, 2.4), new THREE.MeshStandardMaterial({ color: 0x3a4046, metalness: 0.6, roughness: 0.55 }));
  post.position.set(a.x + 15, a.y + 55, (a.z + b.z) / 2);
  scene.add(post);
  for (const y of [70, 100]) {
    const c = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(a.x + 15, a.y + y, a.z + 1), new THREE.Vector3(a.x - 3, a.y + y - 1.5, a.z - 11.6), new THREE.Vector3(a.x - 12, a.y + y - 2, (a.z + b.z) / 2), new THREE.Vector3(a.x - 3, a.y + y - 1.5, b.z + 11.6), new THREE.Vector3(a.x + 15, a.y + y, b.z - 1)], false), 40, 0.45, 6, false),
      new THREE.MeshStandardMaterial({ color: 0x9aa0a5, metalness: 0.8, roughness: 0.45 })
    );
    scene.add(c);
  }
  // copper line from the helium regulator along the raceway to the back of the GC
  const gcBackX = MASS_SPEC_POS.x - 21;
  const line = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(a.x + 4, a.y + 151, a.z - 1),
          new THREE.Vector3(a.x + 8, a.y + 158, a.z - 8),
          new THREE.Vector3(a.x + 6, a.y + 130, a.z - 16),
          new THREE.Vector3(a.x + 2, 40, ANALYTICAL_BENCH.zMin - 3),
          new THREE.Vector3(ANALYTICAL_BENCH.xMax - 2, 9.5, ANALYTICAL_BENCH.zMin + 0.6),
          new THREE.Vector3(gcBackX + 16, 7.7, ANALYTICAL_BENCH.zMin + 1.6),
          new THREE.Vector3(gcBackX, 7.7, ANALYTICAL_BENCH.zMin + 1.8),
          new THREE.Vector3(gcBackX, 14, MASS_SPEC_POS.z - 27.8),
        ],
        false,
        'catmullrom',
        0.3
      ),
      120,
      0.32,
      8,
      false
    ),
    copper
  );
  scene.add(line);
  // foreline pump: a rotary-vane pump on the floor behind the bench, under the MS
  const pump = new THREE.Group();
  const pumpBody = new THREE.Mesh(roundedPumpGeo(), new THREE.MeshStandardMaterial({ color: 0x1d4f91, roughness: 0.45, metalness: 0.3 }));
  pumpBody.castShadow = true;
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 24, 28), new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: 0.5, metalness: 0.5 }));
  motor.rotation.z = Math.PI / 2;
  motor.position.set(-23, 13, 0);
  motor.castShadow = true;
  const oilGlass = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 1, 18), new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.2, transparent: true, opacity: 0.85 }));
  oilGlass.rotation.x = Math.PI / 2;
  oilGlass.position.set(4, 8, 11.2);
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 6, 16), chrome);
  exhaust.position.set(10, 28, 0);
  pump.add(pumpBody, motor, oilGlass, exhaust);
  pump.position.set(MASS_SPEC_POS.x + 20, ANALYTICAL_BENCH.floorY, ANALYTICAL_BENCH.zMin - 14);
  scene.add(pump);
}

function roundedPumpGeo(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(34, 24, 22, 1, 1, 1);
  g.translate(0, 12, 0);
  return g;
}

