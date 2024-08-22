import { easeOutCubic, Promisable, SoundBuilder, spawn, Thread, ThreadGenerator, Vector2, waitFor } from "@motion-canvas/core";
import { hermesSound, HexCoord, HexPattern, INTROSPECTION, PatternType, PossibleHexPattern, RETROSPECTION } from "./pattern";
import { Layout, LayoutProps } from "@motion-canvas/2d";
import { IotaNode } from "./components/IotaNode";
import { HexGrid } from "./components/HexGrid";
import { LineHexPattern, PreviewHexPattern } from "./components/LineHexPattern";
import { ZappyHexPattern } from "./components/ZappyHexPattern";
import { HexWand } from "./components/HexWand";

// undefined represents Garbage here
export type Iota = IotaPattern | number | Vector3 | Iota[] | null | undefined | Continuation;

export type PossibleHexPatterns = (PossibleHexPattern | (Omit<IotaPattern, 'pattern'> & { pattern: PossibleHexPattern }) | PossibleHexPatterns)[];

export function patterns(...inputs: PossibleHexPatterns): IotaPattern[] {
  let output: IotaPattern[] = [];

  for (const input of inputs) {
    if (Array.isArray(input)) {
      output.push({pattern: INTROSPECTION}, ...patterns(...input), {pattern: RETROSPECTION});
    } else if (typeof(input) !== "string" && "pattern" in input) {
      output.push({ ...input, pattern: new HexPattern(input.pattern) });
    } else {
      output.push({ pattern: new HexPattern(input) });
    }
  }

  return output;
}

export function isPattern(iota: Iota): iota is IotaPattern {
  return typeof(iota) === "object" && "pattern" in iota;
}

export class Continuation {
  constructor(public frames: ContinuationFrame[] = []) {}
  clone(): Continuation {
    return new Continuation([...this.frames.map(f => f.clone())]);
  }
}

export interface ContinuationFrame {
  step(vm: HexVM): ThreadGenerator,

  clone(): ContinuationFrame,

  remove(grid?: HexGrid): void,
  restore(grid?: HexGrid): void,
}

export class EvaluationFrame implements ContinuationFrame {
  private evaluated: number = 0;
  private savedWand: Vector2 = Vector2.zero;

  constructor(private iotas: Iota[], private wand?: HexWand) {}

  remove(grid?: HexGrid): void {
    if (grid) {
      for (const iota of this.iotas) {
        if (isPattern(iota) && iota.node) {
          iota.node.remove();
        }
      }
    }
  }

  restore(grid?: HexGrid): void {
    this.wand?.position(this.savedWand);
    if (grid) {
      for (let i = 0; i < this.iotas.length; i++) {
        const iota = this.iotas[i];
        if (isPattern(iota) && iota.node) {
          iota.node.end(i < this.evaluated ? 1 : 0);
          grid.add(iota.node);
        }
      }
    }
  }

  clone(): ContinuationFrame {
    const frame = new EvaluationFrame(this.iotas, this.wand);
    frame.evaluated = this.evaluated;
    frame.savedWand = this.wand?.position() ?? Vector2.zero;
    return frame;
  }

  *step(vm: HexVM): ThreadGenerator {
    if (this.evaluated >= this.iotas.length) {
      vm.continuation.frames.pop();
      return;
    }
  
    const next = this.iotas[this.evaluated];
    this.evaluated += 1;

    if (vm.grid !== undefined && isPattern(next) && next.node) {
      yield* this.wand.drawPattern(next.node, vm.wandSpeed, true);
    }

    const result = yield* vm.perform(next);
    const type = result.type ?? PatternType.EVALUATED;

    if (vm.grid !== undefined) {
      (result.sound ?? type.sound).play();
    }
  }
}

export class Vector3 {
  x: number;
  y: number;
  z: number;

  constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  toString(): string {
    return `<${this.x}, ${this.y}, ${this.z}>`;
  }
}

export type ThreadGeneratorR<T> = Generator<
  ThreadGenerator | Promise<any> | Promisable<any> | void,
  T,
  Thread | any
>;

export type IotaPattern = {
  pattern: HexPattern,
  origin?: HexCoord,
  node?: LineHexPattern,
} & Partial<ResolvedPattern>;

export type ResolvedPattern = {
  name: string,
  perform(vm: HexVM, pattern: IotaPattern): ThreadGeneratorR<CastResult | PatternType | void>,
}

export type CastResult = {
  continuation?: Continuation | ContinuationFrame,
  type?: PatternType,
  sound?: SoundBuilder,
}

export const resolvedPatterns: Record<string, ResolvedPattern> = {
  "qqq": {
    name: "Introspection",
    *perform(vm, pattern) {
      return yield* vm.introspection(pattern);
    }
  },
  "eee": {
    name: "Retrospection",
    *perform(vm, pattern) {
      return yield* vm.retrospection(pattern);
    }
  },
  "deaqq": {
    name: "Hermes' Gambit",
    *perform(vm) {
      const patterns = yield* vm.pop();
      yield* vm.pushContinuation(patterns);
      return { sound: hermesSound };
    }
  },
  "qwaqde": {
    name: "Iris' Gambit",
    *perform(vm) {
      const patterns = yield* vm.pop();
      const cont = vm.continuation.clone();
      yield* vm.push(cont);
      yield* vm.pushContinuation(patterns);
      return { sound: hermesSound };
    }
  },
};

export class HexVM {

  private stack: Iota[] = [];
  private escaped: Iota[] = [];

  private introspections = 0;
  private escapeNext: boolean = false;

  public continuation: Continuation = new Continuation();

  onPush?: (iota: Iota) => ThreadGenerator;
  onPop?: () => ThreadGenerator;

  constructor(public grid?: HexGrid, public wandSpeed: number = 8) {}

  stackNode(props?: LayoutProps): Layout {
    const rect = new Layout({
      layout: true,
      direction: "column-reverse",
      alignItems: "center",
      ...props
    });

    const children: IotaNode[] = [];
    const speed = this.wandSpeed;
    this.onPush = function*(iota) {
      const node = new IotaNode({ iota, size: 0 });
      children.push(node);
      rect.add(node);
      spawn(node.size(50, 2 / speed));
    };
    this.onPop = function*() {
      const node = children.pop();
      spawn(node.size(0, 2 / speed).do(() => node.remove()));
    };

    return rect;
  }

  *step(): ThreadGenerator {
    const frames = this.continuation.frames;
    if (frames.length === 0) return;

    yield* frames[frames.length - 1].step(this);
  }

  *draw(...ps: PossibleHexPatterns[]): ThreadGenerator {
    for (const pattern of patterns(...ps)) {
      yield* this.run();

      if (this.grid !== undefined) {
        const line = new ZappyHexPattern({ pattern: pattern.pattern, end: 0, centered: false });
        const origin = this.grid.addPattern(line);
        yield* this.grid.wand.drawPattern(line, this.wandSpeed, true);

        const result = yield* this.perform({ ...pattern, origin });
        const type = result.type ?? PatternType.EVALUATED;

        line.type(type);
        (result.sound ?? type.sound).play();
      } else {
        yield* this.perform(pattern);
      }
    }
  }

  *run(): ThreadGenerator {
    while (this.continuation.frames.length > 0) {
      yield* this.step();
    }
  }

  *perform(iota: Iota): ThreadGeneratorR<CastResult> {
    if (this.escapeNext) {
      // push iota on the stack
      yield* this.push(iota);
      this.escapeNext = false;
      return {type: PatternType.ESCAPED};
    }

    if (this.introspections > 0) {
      // custom logic for introspection and retrospection
      if (isPattern(iota)) {
        if (iota.pattern.equals(INTROSPECTION)) {
          return yield* this.introspection(iota);
        } else if (iota.pattern.equals(RETROSPECTION)) {
          return yield* this.retrospection(iota);
        }
      }

      // push iota on the introspection list
      this.escaped.push(iota);
      return {type: PatternType.ESCAPED};
    }

    if (!isPattern(iota)) {
      // not a pattern
      yield* this.push(undefined);
      return {type: PatternType.ERRORED};
    }

    const angles = iota.pattern.toString().split(',')[1];
    const perform = iota.perform ?? resolvedPatterns[angles]?.perform;

    // TODO: numbers, bookkeeper's gambit

    if (perform === undefined) {
      yield* this.push(undefined);
      return {type: PatternType.ERRORED};
    } else {
      const result = <CastResult | PatternType | undefined>(yield* perform(this, iota)) ?? {};
      if (result instanceof PatternType) {
        return {type: result};
      } else {
        return result;
      }
    }
  }

  *setContinuation(cont: Continuation): ThreadGenerator {
    this.continuation.frames.forEach(f => f.remove(this.grid));
    this.continuation = cont;
    this.continuation.frames.forEach(f => f.restore(this.grid));
  }

  *pushContinuation(iota: Iota): ThreadGenerator {
    if (iota instanceof Continuation) {
      yield* this.setContinuation(iota);
      return;
    }

    let iotas: Iota[] = Array.isArray(iota) ? iota : [iota];
    if (iotas.length === 0) {
      return;
    }
    if (this.grid) {
      this.grid.cursor = new HexCoord(0, this.continuation.frames.length * 4 + 4);
      const iotasp = iotas.map((i, idx) => {
        if (isPattern(i)) {
          const line = new LineHexPattern({ pattern: i.pattern, end: 0, centered: false, children: new PreviewHexPattern() });
          const dest = this.grid.addPattern(line);

          const offset = idx / 2 / this.wandSpeed;
          const time = 2 / this.wandSpeed;

          if (i.origin) {
            line.position(i.origin.point());
            spawn(function*() { 
              yield* waitFor(offset);
              yield* line.position(dest.point(), time, easeOutCubic)
            });
          } else {
            line.opacity(0);
            spawn(function*() { 
              yield* waitFor(offset);
              yield* line.opacity(1, time, easeOutCubic);
            });
          }

          return { ...i, origin: dest, node: line };
        } else {
          return i;
        }
      });

      const wand = new HexWand({type:"cursor"});
      this.grid.add(wand);
      this.continuation.frames.push(new EvaluationFrame(iotasp, wand));
    } else {
      this.continuation.frames.push(new EvaluationFrame(iotas));
    }
  }

  *push(...iotas: Iota[]): ThreadGenerator {
    if (this.onPush !== undefined) {
      for (const iota of iotas) {
        yield* this.onPush(iota);
      }
    }
    this.stack.push(...iotas);
  }

  *pop(): ThreadGeneratorR<Iota> {
    if (this.onPop !== undefined) {
      yield* this.onPop();
    }
    return this.stack.pop();
  }

  *introspection(pattern: IotaPattern): ThreadGeneratorR<CastResult> {
    this.introspections += 1;
    if (this.introspections > 1) {
      this.escaped.push(pattern);
      return {type: PatternType.ESCAPED};
    } else {
      return {type: PatternType.EVALUATED};
    }
  }

  *retrospection(pattern: IotaPattern): ThreadGeneratorR<CastResult> {
    if (this.introspections === 0) {
      yield* this.push(pattern);
      return {type: PatternType.ERRORED};
    } else {
      this.introspections -= 1;
      if (this.introspections === 0) {
        yield* this.push(this.escaped);
        this.escaped = [];
        return {type: PatternType.EVALUATED};
      } else {
        this.escaped.push(pattern);
        return {type: PatternType.ESCAPED};
      }
    }
  }

}
