import { createSignal, SimpleSignal, spawn } from "@motion-canvas/core";
import { HexPattern, PatternType, PossibleHexPattern } from "./pattern";
import { Layout, LayoutProps } from "@motion-canvas/2d";
import { IotaNode } from "./components/IotaNode";

// null represents Garbage here
export type Iota = PossibleHexPattern | number | Vector3 | Iota[] | null;

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

export const INTROSPECTION = new HexPattern("west,qqq");
export const RETROSPECTION = new HexPattern("east,eee");

function push<T>(arr:SimpleSignal<T[]>, ...elems: T[]) {
  arr([...arr(), ...elems]);
}

function pop<T>(arr:SimpleSignal<T[]>): T {
  const popped = arr().pop();
  arr([...arr()]);
  return popped;
}

export class HexVM {

  stack: SimpleSignal<Iota[]> = createSignal([]);
  introspected: SimpleSignal<Iota[]> = createSignal([]);
  
  private _introspection_state = 0;
  private _consideration_state: boolean = false;

  on_push?: (iota: Iota) => void;
  on_pop?: () => void;

  stackNode(props?: LayoutProps): Layout {
    const rect = new Layout({
      layout: true,
      direction: "column-reverse",
      alignItems: "center",
      ...props
    });

    const children: IotaNode[] = [];
    this.on_push = (iota) => {
      const node = new IotaNode({ iota, size: 0 });
      children.push(node);
      rect.add(node);
      spawn(node.size(50, 0.3));
    };
    this.on_pop = () => {
      const node = children.pop();
      spawn(node.size(0, 0.3).do(() => node.remove()));
    };

    return rect;
  }

  draw(iota: Iota): PatternType {
    if (this._consideration_state) {
      // push iota on the stack
      this.push(iota);
      this._consideration_state = false;
      return PatternType.ESCAPED;
    }

    if (this._introspection_state > 0) {
      // custom logic for introspection and retrospection
      if (iota instanceof HexPattern) {
        if (iota.equals(INTROSPECTION)) {
          this.introspection(iota);
          return PatternType.ESCAPED;
        } else if (iota.equals(RETROSPECTION)) {
          this.retrospection(iota);
          return this._introspection_state === 0 ? PatternType.EVALUATED : PatternType.ESCAPED;
        }
      }

      // push iota on the introspection list
      push(this.introspected, iota);
      return PatternType.ESCAPED;
    }

    if (!(iota instanceof HexPattern)) {
      // not a pattern
      this.push(null);
      return PatternType.UNRESOLVED;
    }

    switch (iota.toString().split(',')[1]) {
      case "qqq":
        this.introspection(iota);
        break;
      case "eee":
        this.retrospection(iota);
        break;
      default:
        this.push(null);
        return PatternType.UNRESOLVED;
    }
    return PatternType.EVALUATED;
  }

  push(...iotas: Iota[]) {
    if (this.on_push !== undefined) {
      for (const iota of iotas) {
        this.on_push(iota);
      }
    }
    push(this.stack, ...iotas);
  }

  pop(): Iota {
    if (this.on_pop !== undefined) {
      this.on_pop();
    }
    return pop(this.stack);
  }

  private introspection(pattern: HexPattern) {
    if (this._introspection_state > 0) {
      push(this.introspected, pattern);
    }
    this._introspection_state += 1;
  }

  private retrospection(pattern: HexPattern) {
    if (this._introspection_state === 0) {
      push(this.stack, pattern);
    } else {
      this._introspection_state -= 1;
      if (this._introspection_state === 0) {
        this.push(this.introspected());
        this.introspected([]);
      } else {
        this.push(pattern);
      }
    }
  }

}
