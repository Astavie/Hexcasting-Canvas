import { arc, lineTo, moveTo } from "@motion-canvas/2d";
import { Color, usePlayback, Vector2 } from "@motion-canvas/core";
import Alea from "alea";
import chroma from "chroma-js";
import { createNoise3D } from "simplex-noise";

function getTick(): number {
  const playblack = usePlayback();
  const seconds = playblack.time;
  return seconds * 20;
}

const NOISE = createNoise3D(Alea(9001));

function getNoise(x: number, y: number, z: number): number {
  return NOISE(x * 0.6, y * 0.6, z * 0.6) / 2.0;
}

function drawLineSeq(
  context: CanvasRenderingContext2D,
  points: Vector2[],
  width: number,
  tail: Color,
  head: Color,
) {
  if (points.length === 0) {
    return;
  }

  context.save();
  context.lineWidth = width;
  context.lineCap = "round";
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const next = points[i];

    const prevColor = lerpColor((i - 1) / points.length, tail, head);
    const nextColor = lerpColor((i - 1) / points.length, tail, head);

    const gradient = context.createLinearGradient(prev.x, prev.y, next.x, next.y);
    gradient.addColorStop(0, prevColor.hex("rgba"));
    gradient.addColorStop(1, nextColor.hex("rgba"));

    context.beginPath();
    moveTo(context, prev);
    lineTo(context, next);
    context.strokeStyle = gradient;
    context.stroke();
  }
  context.restore();
}

export function drawSpot(
  context: CanvasRenderingContext2D,
  point: Vector2,
  radius: number,
  color: Color,
) {
  context.save();
  context.beginPath();
  arc(context, point, radius);
  context.fillStyle = color.hex("rgba");
  context.fill();
  context.restore();
}

export function lerp(time: number, a: number, b: number): number {
  return time * a + (1 - time) * b;
}

function lerpColor(time: number, a: Color, b: Color): Color {
  const [r1,g1,b1,a1] = a.rgba();
  const [r2,g2,b2,a2] = b.rgba();
  return chroma.rgb(lerp(time, r1, r2), lerp(time, g1, g2), lerp(time, b1, b2), lerp(time, a1, a2));
}

function dodge(c: Color): Color {
  const [r,g,b,a] = c.rgba();
  return chroma.rgb(r * 0.9, g * 0.9, b * 0.9, a);
}

function screen(c: Color): Color {
  const [r,g,b,a] = c.rgba();
  return chroma.rgb((r + 255) / 2, (g + 255) / 2, (b + 255) / 2, a);
}

export const DEFAULT_READABILITY_OFFSET = 0.2;

// Taken from:
// https://github.com/FallingColors/HexMod/blob/e1ad4b316dd1e8f1f1300ee95bdbf796e8ebcad1/Common/src/main/java/at/petrak/hexcasting/client/render/RenderLib.kt#L201
export function drawPatternFromPoints(
  context: CanvasRenderingContext2D,
  points: Vector2[],
  dupIndices: Set<number> | null,
  drawLast: boolean,
  tail: Color,
  head: Color,
  flowIrregular: number,
  readabilityOffset: number,
  lastSegmentLenProportion: number,
  seed: number
) {
  const zappyPts = makeZappy(points, dupIndices, 10, 2.5, 0.1, flowIrregular, readabilityOffset, lastSegmentLenProportion, seed);
  const nodes = [...points];
  if (!drawLast) {
    nodes.pop();
  }
  drawLineSeq(context, zappyPts, 5, tail, head);
  drawLineSeq(context, zappyPts, 2, screen(tail), screen(head));
  for (const node of nodes) {
    drawSpot(context, node, 2, dodge(head))
  }
}

// Taken from:
// https://github.com/FallingColors/HexMod/blob/e1ad4b316dd1e8f1f1300ee95bdbf796e8ebcad1/Common/src/main/java/at/petrak/hexcasting/client/render/RenderLib.kt#L239
export function makeZappy(
  barePoints: Vector2[],
  dupIndices: Set<number> | null,
  hops: number,
  variance: number,
  speed: number,
  flowIrregular: number,
  readabilityOffset: number,
  lastSegmentLenProportion: number,
  seed: number,
): Vector2[] {
  if (barePoints.length === 0) {
    return [];
  }

  const zappify = (points: Vector2[], truncateLast: boolean): Vector2[] => {
    const scaleVariance = (it: number) => Math.min(1, 8 * (0.5 - Math.abs(0.5 - it)));
    const zSeed = getTick() * speed;
    
    const zappyPts: Vector2[] = [];
    zappyPts.push(points[0]);
    
    for (let i = 0; i < points.length - 1; i++) {
      const src = points[i];
      const target = points[i + 1];
      const delta = target.sub(src);

      const hopDist = delta.magnitude / hops;
      const maxVariance = hopDist * variance;

      const maxJ = truncateLast && i === points.length - 2
        ? Math.round(lastSegmentLenProportion * hops)
        : hops;

      for (let j = 1; j <= maxJ; j++) {
        const progress = j / (hops + 1);
        const pos = src.add(delta.scale(progress));

        const minorPerturb = getNoise(i, j, Math.sin(zSeed)) * flowIrregular;
        const theta = (3 * getNoise(
          i + progress + minorPerturb - zSeed,
          1337.0,
          seed,
        ) * Math.PI * 2);
        const r = (getNoise(
          i + progress - zSeed,
          69420.0,
          seed,
        ) * maxVariance * scaleVariance(progress));
        const randomHop = new Vector2(r * Math.cos(theta), r * Math.sin(theta));

        zappyPts.push(pos.add(randomHop));

        if (j === hops) {
          zappyPts.push(target);
        }
      }
    }

    return zappyPts;
  };

  if (dupIndices !== null) {
    const points: Vector2[] = [];
    let daisyChain: Vector2[] = [];

    for (let i = 0; i < barePoints.length - 1; i++) {
      const head = barePoints[i];
      const tail = barePoints[i + 1];
      const tangent = tail.sub(head).scale(readabilityOffset);
      if (i !== 0 && dupIndices.has(i)) {
        daisyChain.push(head.add(tangent));
      } else {
        daisyChain.push(head);
      }
      if (i === barePoints.length - 2) {
        daisyChain.push(tail);
        points.push(...zappify(daisyChain, true));
      } else if (dupIndices.has(i + 1)) {
        daisyChain.push(tail.sub(tangent));
        points.push(...zappify(daisyChain, false));
        daisyChain = [];
      }
    }
    return points;
  } else {
    return zappify(barePoints, true);
  }
}
