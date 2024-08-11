import { Promisable, spawn, Thread, ThreadGenerator, useScene } from "@motion-canvas/core";
import { HexPattern, INTROSPECTION, patterns, PatternType, PossibleHexPatterns, RETROSPECTION } from "./pattern";
import { Layout, LayoutProps } from "@motion-canvas/2d";
import { IotaNode } from "./components/IotaNode";
import { HexGrid } from "./components/HexGrid";
import { LineHexPattern } from "./components/LineHexPattern";
import { ZappyHexPattern } from "./components/ZappyHexPattern";

// undefined represents Garbage here
export type Iota = HexPattern | CustomPattern | number | Vector3 | Iota[] | null | undefined | Continuation;

export class Continuation {
  constructor(public iotas: Iota[][]) {}
  clone(): Continuation {
    return new Continuation([...this.iotas.map(a => [...a])]);
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

export type CustomPattern = {
  pattern: HexPattern,
} & ResolvedPattern;

export type ResolvedPattern = {
  name: string,
  perform(vm: HexVM, pattern: HexPattern): ThreadGeneratorR<PatternType | void>,
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
    this.onPush = function*(iota) {
      const node = new IotaNode({ iota, size: 0 });
      children.push(node);
      rect.add(node);
      spawn(node.size(50, 0.3));
    };
    this.onPop = function*() {
      const node = children.pop();
      spawn(node.size(0, 0.3).do(() => node.remove()));
    };

    return rect;
  }

  *step(): ThreadGenerator {
    const iotas = this._continuation.iotas;
    if (iotas.length === 0) return;

    const next = iotas[iotas.length - 1].shift();
    if (iotas[iotas.length - 1].length === 0) iotas.pop();

    if (this.grid !== undefined && next instanceof HexPattern) {
      const line = new LineHexPattern({ pattern: next, end: 0, centered: false });
      this.grid.addPattern(line);
      yield* this.grid.wand.drawPattern(line, this.wandSpeed);
    }

    const type = yield* this.perform(next);

    if (this.grid !== undefined) {
      useScene().sounds.add(type.sound, -20);
    }
  }

  *draw(...ps: PossibleHexPatterns[]): ThreadGenerator {
    for (const pattern of patterns(...ps)) {
      yield* this.run();

      if (this.grid !== undefined) {
        const line = new ZappyHexPattern({ pattern, end: 0, centered: false });
        this.grid.addPattern(line);
        yield* this.grid.wand.drawPattern(line, this.wandSpeed, true);

        const type = yield* this.perform(pattern);
        line.type(type);
        useScene().sounds.add(type.sound, -20);
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
      if (iota instanceof HexPattern) {
        if (iota.equals(INTROSPECTION)) {
          return yield* this.introspection(iota);
        } else if (iota.equals(RETROSPECTION)) {
          return yield* this.retrospection(iota);
        }
      }

      // push iota on the introspection list
      this._introspected.push(iota);
      return PatternType.ESCAPED;
    }

    if (!(iota instanceof HexPattern)) {
      // not a pattern
      yield* this.push(undefined);
      return PatternType.ERRORED;
    }

    const angles = iota.toString().split(',')[1];
    const pattern = resolvedPatterns[angles];

    // TODO: numbers, bookkeeper's gambit

    if (pattern === undefined) {
      yield* this.push(undefined);
      return PatternType.ERRORED;
    } else {
      return <PatternType | undefined>(yield* pattern.perform(this, iota)) ?? PatternType.EVALUATED;
    }
  }

  currentContinuation(): Continuation {
    return this._continuation.clone();
  }

  *setContinuation(cont: Continuation): ThreadGenerator {
    this._continuation = cont;
  }

  *pushContinuation(iotas: Iota): ThreadGenerator {
    if (iotas instanceof Continuation) {
      yield* this.setContinuation(iotas);
    } else if (Array.isArray(iotas)) {
      if (iotas.length > 0) {
        this._continuation.iotas.push(iotas);
      }
    } else {
      this._continuation.iotas.push([iotas]);
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

  *introspection(pattern: HexPattern): ThreadGeneratorR<PatternType> {
    this._introspectionState += 1;
    if (this._introspectionState > 1) {
      this._introspected.push(pattern);
      return PatternType.ESCAPED;
    } else {
      return PatternType.EVALUATED;
    }
  }

  *retrospection(pattern: HexPattern): ThreadGeneratorR<PatternType> {
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
