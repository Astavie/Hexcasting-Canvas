import { addSound, linear, Promisable, spawn, Thread, ThreadGenerator, Vector2, waitFor } from "@motion-canvas/core";
import { HexCoord, HexPattern, INTROSPECTION, PatternType, PossibleHexPattern, RETROSPECTION } from "./pattern";
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
  constructor(public iotas: (Iota & {node?: LineHexPattern})[][], public patterns: (LineHexPattern | ZappyHexPattern)[] = [], public wandPos: Vector2[] = []) {}
  clone(): Continuation {
    return new Continuation([...this.iotas.map(a => [...a])], this.patterns, this.wandPos);
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
} & Partial<ResolvedPattern>;

export type ResolvedPattern = {
  name: string,
  perform(vm: HexVM, pattern: IotaPattern): ThreadGeneratorR<PatternType | void>,
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
      return PatternType.EVALUATED_HERMES;
    }
  },
  "qwaqde": {
    name: "Iris' Gambit",
    *perform(vm) {
      const patterns = yield* vm.pop();
      const cont = vm.currentContinuation();
      yield* vm.push(cont);
      yield* vm.pushContinuation(patterns);
      return PatternType.EVALUATED_HERMES;
    }
  },
};

export class HexVM {

  private _stack: Iota[] = [];
  private _introspected: Iota[] = [];
  private _continuation: Continuation = new Continuation([]);
  private _wands: HexWand[] = [];

  private _introspectionState = 0;
  private _considerationState: boolean = false;

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
    const iotas = this._continuation.iotas;
    if (iotas.length === 0) return;

    const idx = iotas.length - 1;
    const next = iotas[idx].shift();
    if (iotas[idx].length === 0) iotas.pop();

    if (this.grid !== undefined && isPattern(next) && next.node) {
      while (this._wands.length < idx + 1) {
        const wand = new HexWand({opacity: 0, type: 'cursor'});
        this.grid.add(wand);
        this._wands.push(wand);
        spawn(wand.opacity(1, 2 / this.wandSpeed));
      }
      yield* this._wands[idx].drawPattern(next.node, this.wandSpeed, true);
    }

    const type = yield* this.perform(next);

    if (this.grid !== undefined) {
      addSound({ audio: type.sound, gain: -12 });
    }
  }

  *draw(...ps: PossibleHexPatterns[]): ThreadGenerator {
    for (const pattern of patterns(...ps)) {
      yield* this.run();

      if (this.grid !== undefined) {
        const line = new ZappyHexPattern({ pattern: pattern.pattern, end: 0, centered: false });
        const origin = this.grid.addPattern(line);
        yield* this.grid.wand.drawPattern(line, this.wandSpeed, true);

        const type = yield* this.perform({ ...pattern, origin });
        line.type(type);
        addSound({ audio: type.sound, gain: -12 });
      } else {
        yield* this.perform(pattern);
      }
    }
  }

  *run(): ThreadGenerator {
    while (this._continuation.iotas.length > 0) {
      yield* this.step();
    }
  }

  *perform(iota: Iota): ThreadGeneratorR<PatternType> {
    if (this._considerationState) {
      // push iota on the stack
      yield* this.push(iota);
      this._considerationState = false;
      return PatternType.ESCAPED;
    }

    if (this._introspectionState > 0) {
      // custom logic for introspection and retrospection
      if (isPattern(iota)) {
        if (iota.pattern.equals(INTROSPECTION)) {
          return yield* this.introspection(iota);
        } else if (iota.pattern.equals(RETROSPECTION)) {
          return yield* this.retrospection(iota);
        }
      }

      // push iota on the introspection list
      this._introspected.push(iota);
      return PatternType.ESCAPED;
    }

    if (!isPattern(iota)) {
      // not a pattern
      yield* this.push(undefined);
      return PatternType.ERRORED;
    }

    const angles = iota.pattern.toString().split(',')[1];
    const perform = iota.perform ?? resolvedPatterns[angles]?.perform;

    // TODO: numbers, bookkeeper's gambit

    if (perform === undefined) {
      yield* this.push(undefined);
      return PatternType.ERRORED;
    } else {
      return <PatternType | undefined>(yield* perform(this, iota)) ?? PatternType.EVALUATED;
    }
  }

  currentContinuation(): Continuation {
    if (this.grid) {
      this._continuation.patterns = this.grid.patterns();
      this._continuation.wandPos = this._wands.map(w => w.position());
    }
    return this._continuation.clone();
  }

  *setContinuation(cont: Continuation): ThreadGenerator {
    this._continuation = cont;
    if (this.grid !== undefined) {
      while (this._wands.length < cont.wandPos.length) {
        const wand = new HexWand({type: 'cursor'});
        this.grid.add(wand);
        this._wands.push(wand);
      }
      while (this._wands.length > cont.wandPos.length) {
        const wand = this._wands.pop();
        wand.remove();
      }
      for (let i = 0; i < cont.wandPos.length; i++) {
        this._wands[i].position(cont.wandPos[i]);
      }

      const patterns = this.grid.patterns();
      for (const pattern of patterns) {
        if (!cont.patterns.includes(pattern)) {
          pattern.remove();
        }
      }
      for (const pattern of cont.patterns) {
        if (!patterns.includes(pattern)) {
          this.grid.add(pattern);
        }
      }
      for (const iotas of cont.iotas) {
        for (const iota of iotas) {
          if (iota.node) {
            iota.node.end(0);
          }
        }
      }
    }
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
      this.grid.cursor = new HexCoord(0, this._continuation.iotas.length * 4 + 4);
      const iotasp = iotas.map(i => {
        if (isPattern(i)) {
          const line = new LineHexPattern({ pattern: i.pattern, end: 0, centered: false, children: new PreviewHexPattern() });
          const dest = this.grid.addPattern(line);

          if (i.origin) {
            line.position(i.origin.point());
            spawn(line.position(dest.point(), 2 / this.wandSpeed));
          } else {
            line.opacity(0);
            spawn(line.opacity(1, 2 / this.wandSpeed));
          }

          return { ...i, node: line };
        } else {
          return i;
        }
      });
      this._continuation.iotas.push(iotasp);
    } else {
      this._continuation.iotas.push(iotas);
    }
  }

  *push(...iotas: Iota[]): ThreadGenerator {
    if (this.onPush !== undefined) {
      for (const iota of iotas) {
        yield* this.onPush(iota);
      }
    }
    this._stack.push(...iotas);
  }

  *pop(): ThreadGeneratorR<Iota> {
    if (this.onPop !== undefined) {
      yield* this.onPop();
    }
    return this._stack.pop();
  }

  *introspection(pattern: IotaPattern): ThreadGeneratorR<PatternType> {
    this._introspectionState += 1;
    if (this._introspectionState > 1) {
      this._introspected.push(pattern);
      return PatternType.ESCAPED;
    } else {
      return PatternType.EVALUATED;
    }
  }

  *retrospection(pattern: IotaPattern): ThreadGeneratorR<PatternType> {
    if (this._introspectionState === 0) {
      yield* this.push(pattern);
      return PatternType.ERRORED;
    } else {
      this._introspectionState -= 1;
      if (this._introspectionState === 0) {
        yield* this.push(this._introspected);
        this._introspected = [];
        return PatternType.EVALUATED;
      } else {
        this._introspected.push(pattern);
        return PatternType.ESCAPED;
      }
    }
  }

}
