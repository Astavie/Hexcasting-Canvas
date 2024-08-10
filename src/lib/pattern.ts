import { BBox, Color, Vector2 } from "@motion-canvas/core";
import chroma from "chroma-js";

// Taken from:
// https://github.com/FallingColors/HexMod/blob/e1ad4b316dd1e8f1f1300ee95bdbf796e8ebcad1/Common/src/main/java/at/petrak/hexcasting/api/casting/eval/ResolvedPatternType.kt#L5
export class PatternType {
  public declare readonly name: string;
  public declare readonly color: Color;
  public declare readonly fadeColor: Color;
  public declare readonly success: boolean;

  private constructor(name: string, color: number, fadeColor: number, success: boolean) {
    this.name = name;
    this.color = chroma(color).alpha(0xc8 / 0xff);
    this.fadeColor = chroma(fadeColor).alpha(0xc8 / 0xff);
    this.success = success;
  }

  public toString(): string {
    return this.name;
  }

  public static readonly UNRESOLVED = new PatternType("UNRESOLVED ", 0x7f7f7f, 0xcccccc, false);
  public static readonly EVALUATED = new PatternType("EVALUATED ", 0x7385de, 0xfecbe6, true);
  public static readonly ESCAPED = new PatternType("ESCAPED ", 0xddcc73, 0xfffae5, true);
  public static readonly UNDONE = new PatternType("UNDONE ", 0xb26b6b, 0xcca88e, true);
  public static readonly ERRORED = new PatternType("ERRORED ", 0xde6262, 0xffc7a0, false);
  public static readonly INVALID = new PatternType("INVALID ", 0xb26b6b, 0xcca88e, false);
}

export enum HexDir {
  NORTH_EAST, EAST, SOUTH_EAST, SOUTH_WEST, WEST, NORTH_WEST
}
const dirDelta: {[key in HexDir]: [number, number]} = [
  [ 1, -1],
  [ 1,  0],
  [ 0,  1],
  [-1,  1],
  [-1,  0],
  [ 0, -1],
];

export enum HexAngle {
  FORWARD, RIGHT, RIGHT_BACK, BACK, LEFT_BACK, LEFT
}

export interface HexPattern {
  startDir: HexDir,
  angles: HexAngle[],
}

const SQRT_3 = Math.sqrt(3);
export const DEFAULT_SCALE = Math.sqrt(1920 * 1080 / 512) / 4;

export class HexCoord {
  q: number;
  r: number;

  constructor(q: number, r: number) {
    this.q = q;
    this.r = r;
  }

  static snap(vec: Vector2): HexCoord {
    let qf = (SQRT_3/3 * vec.x - 1/3 * vec.y) / DEFAULT_SCALE;
    let rf = (2/3 * vec.y) / DEFAULT_SCALE;

    const q = Math.round(qf);
    const r = Math.round(rf);
    qf -= q;
    rf -= r;

    if (Math.abs(q) >= Math.abs(r)) {
      return new HexCoord(q + Math.round(qf + 0.5 * rf), r);
    } else {
      return new HexCoord(q, r + Math.round(rf + 0.5 * qf));
    }
  }

  add(pos: HexCoord): HexCoord
  add(dir: HexDir): HexCoord
  add(q: number, r: number): HexCoord

  add(q: HexCoord | HexDir | number, r?: number): HexCoord {
    if (q instanceof HexCoord) {
      return new HexCoord(this.q + q.q, this.r + q.r);
    } else if (r !== undefined) {
      return new HexCoord(this.q + q, this.r + r);
    } else {
      const [dq, dr] = dirDelta[q as HexDir];
      return new HexCoord(this.q + dq, this.r + dr);
    }
  }

  clone(): HexCoord {
    return new HexCoord(this.q, this.r);
  }

  point(): Vector2 {
    return new Vector2(
      SQRT_3 * this.q + SQRT_3 / 2 * this.r,
      1.5 * this.r,
    ).scale(DEFAULT_SCALE);
  }

  equals(other: HexCoord): boolean {
    return this.q === other.q && this.r === other.r;
  }

  // Taken from:
  // https://github.com/FallingColors/HexMod/blob/e1ad4b316dd1e8f1f1300ee95bdbf796e8ebcad1/Common/src/main/java/at/petrak/hexcasting/api/casting/math/HexCoord.kt#L41
  range(radius: number): HexCoord[] {
    let q = -radius;
    let r = Math.max(-radius, 0);

    const out: HexCoord[] = [];
    while (r <= radius + Math.min(0, -q) || q < radius) {
      if (r > radius + Math.min(0, -q)) {
        q++;
        r = -radius + Math.max(0, -q);
      }
      out.push(new HexCoord(this.q + q, this.r + r));
      r++;
    }
    return out;
  }
}

export type PossibleHexPattern = string | HexPattern;

export class HexPattern {
  startDir: HexDir;
  angles: HexAngle[];

  public constructor(startDir: HexDir, angles: HexAngle[]);
  public constructor(pat: PossibleHexPattern);
  public constructor(startDir: HexDir | PossibleHexPattern, angles?: HexAngle[]) {
    if (angles === undefined) {
      const pat = startDir as PossibleHexPattern;
      if (typeof pat === "string") {
        const parsed = HexPattern.parse(pat);
        this.startDir = parsed.startDir;
        this.angles = parsed.angles;
      } else {
        this.startDir = pat.startDir;
        this.angles = [...pat.angles];
      }
    } else {
      this.startDir = startDir as HexDir;
      this.angles = angles;
    }
  }

  public static parse(str: string): HexPattern {
    const [l, r] = str.split(",");

    let startDir: HexDir;
    switch (l) {
      case "northeast": startDir = HexDir.NORTH_EAST; break;
      case      "east": startDir = HexDir.      EAST; break;
      case "southeast": startDir = HexDir.SOUTH_EAST; break;
      case "northwest": startDir = HexDir.NORTH_WEST; break;
      case      "west": startDir = HexDir.      WEST; break;
      case "southwest": startDir = HexDir.SOUTH_WEST; break;
    }

    const angles = Array.from(r).map(c => {
      switch (c) {
        case "w": return HexAngle.FORWARD;
        case "e": return HexAngle.RIGHT;
        case "d": return HexAngle.RIGHT_BACK;
        case "s": return HexAngle.BACK;
        case "a": return HexAngle.LEFT_BACK;
        case "q": return HexAngle.LEFT;
      }
    });

    return new HexPattern(startDir, angles);
  }

  public toString(): string {
    let s = "";

    switch (this.startDir) {
      case HexDir.NORTH_EAST: s += "northeast"; break;
      case HexDir.      EAST: s +=      "east"; break;
      case HexDir.SOUTH_EAST: s += "southeast"; break;
      case HexDir.SOUTH_WEST: s += "southwest"; break;
      case HexDir.      WEST: s +=      "west"; break;
      case HexDir.NORTH_WEST: s += "northwest"; break;
    }

    s += ",";

    for (const angle of this.angles) {
      switch (angle) {
        case HexAngle.FORWARD:    s += "w"; break;
        case HexAngle.RIGHT:      s += "e"; break;
        case HexAngle.RIGHT_BACK: s += "d"; break;
        case HexAngle.BACK:       s += "s"; break;
        case HexAngle.LEFT_BACK:  s += "a"; break;
        case HexAngle.LEFT:       s += "q"; break;
      }
    }

    return s;
  }

  public bounds(): [HexCoord, HexCoord] {
    const coords = this.coords();

    const minQ = Math.min(...coords.map(c => c.q));
    const maxQ = Math.max(...coords.map(c => c.q));
    const minR = Math.min(...coords.map(c => c.r));
    const maxR = Math.max(...coords.map(c => c.r));

    return [
      new HexCoord(minQ, minR),
      new HexCoord(maxQ, maxR),
    ];
  }

  public reversed(): HexPattern {
    const totalAngle = this.angles.reduce((a, b) => a + b);
    const reverseDir = (this.startDir + totalAngle + 3) % 6;
    const reverseAngles = this.angles.map(a => (a * 5) % 6).reverse();
    return new HexPattern(reverseDir, reverseAngles);
  }

  public mirrored(): HexPattern {
    const mirrorDir = (this.startDir + 3) % 6;
    const mirrorAngles = this.angles.map(a => (a * 5) % 6);
    return new HexPattern(mirrorDir, mirrorAngles);
  }

  public equals(other: HexPattern): boolean {
    // patterns are equal irrespective of orientation
    return this.angles.length === other.angles.length && this.angles.every((a, i) => a === other.angles[i]);
  }

  public coords(): HexCoord[] {
    let currentCoord = new HexCoord(0, 0);
    let currentDir = this.startDir;

    const coords: HexCoord[] = [currentCoord];
    currentCoord = currentCoord.add(currentDir);
    coords.push(currentCoord);

    for (const angle of this.angles) {
      currentDir = (currentDir + angle) % 6;
      currentCoord = currentCoord.add(currentDir);
      coords.push(currentCoord);
    }

    return coords;
  }

  public points(centered: boolean = true, height?: number): Vector2[] {
    let points = this.coords().map(c => c.point());

    if (centered) {
      const center = BBox.fromPoints(...points).center;
      points = points.map(p => p.sub(center));
    }

    if (height !== undefined) {
      const h = BBox.fromPoints(...points).height;
      points = points.map(p => p.scale(height / h));
    }

    return points;
  }

  // Taken from:
  // https://github.com/FallingColors/HexMod/blob/e1ad4b316dd1e8f1f1300ee95bdbf796e8ebcad1/Common/src/main/java/at/petrak/hexcasting/client/render/RenderLib.kt#L326
  public findDupIndices(end: number = -1): Set<number> {
    const pts = this.coords();
    if (end === -1) {
      end = pts.length;
    }

    const found: Set<number> = new Set();
    for (let i = 0; i < end; i++) {
      const pt = pts[i];
      const ix = pts.findIndex(c => c.equals(pt));
      if (ix !== -1 && ix < i) {
        found.add(i);
        found.add(ix);
      }
    }
    return found;
  }
}
