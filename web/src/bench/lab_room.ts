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

/**
 * Static lab environment. 1 unit = 1 cm. Bench top surface is y = 0; the front edge of the worktop is at z = +32,
 * the back wall at z = -45. The reagent shelf stands at the back of the bench (3 tiers × 9 slots).
 */
export const BENCH = { xMin: -120, xMax: 120, zMin: -45, zMax: 32, thickness: 3.2, floorY: -90 };
export const SHELF = {
  tiers: [1.6, 21.6, 41.6], // standing heights of the tiers
  slots: 9,
  spacing: 12.6,
  z: -36.5,
  xCenter: 0,
};

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
  fTex.repeat.set(12, 12);
  fTex.needsUpdate = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: fTex, roughness: 0.75 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, BENCH.floorY, 100);
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
  const upper = new THREE.Mesh(new THREE.PlaneGeometry(320, 140), paintMat);
  upper.position.set(0, 75 + 70, BENCH.zMin);
  scene.add(upper);
  const lower = new THREE.Mesh(new THREE.PlaneGeometry(320, -BENCH.floorY), paintMat);
  lower.position.set(0, BENCH.floorY / 2, BENCH.zMin - 0.2);
  scene.add(lower);
  // side walls
  for (const sx of [-160, 160]) {
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
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(320, 400), new THREE.MeshStandardMaterial({ color: 0xdcdfdc, roughness: 0.95 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 220, 155);
  scene.add(ceiling);
  for (const lx of [-60, 60]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshBasicMaterial({ color: 0xc8d0d8, toneMapped: true }));
    panel.rotation.x = Math.PI / 2;
    panel.position.set(lx, 219.5, 20);
    scene.add(panel);
  }

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
