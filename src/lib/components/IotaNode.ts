import { Icon, initial, Layout, Node, nodeName, NodeProps, signal, Txt } from "@motion-canvas/2d";
import { SignalValue, SimpleSignal } from "@motion-canvas/core";
import { Continuation, Iota, Vector3 } from "../vm";
import { HexPattern } from "../pattern";
import { LineHexPattern } from "./LineHexPattern";

export interface IotaNodeProps extends NodeProps {
  iota: SignalValue<Iota>;
  size?: SignalValue<number>,
}

@nodeName('IotaNode')
export class IotaNode extends Node {
  @signal()
  public declare readonly iota: SimpleSignal<Iota, this>;

  @initial(50)
  @signal()
  public declare readonly size: SimpleSignal<number, this>;

  public constructor(props: IotaNodeProps) {
    super({ ...props });
    this.children(() => this.asNode(this.iota()));
  }

  private txtNode(text: string): Layout {
    const txt: Txt = new Txt({
      text,
      fill: "white",
      fontSize: () => this.size() / 50 * 48,
      fontFamily: "monospace",
      lineHeight: () => this.size() / 50 * 46,
      paddingTop: () => this.size() / 50 * 4,
    });
    return txt;
  }

  private asNode(iota: Iota): Layout {
    const node = this._asNode(iota);
    node.margin(() => this.size() / 50 * 8);
    return node;
  }

  private _asNode(iota: Iota): Layout {
    if (typeof(iota) === "number" || iota instanceof Vector3 || iota === null) {
      // toString
      return this.txtNode(`${iota}`);
    } else if (iota instanceof Continuation) {
      // continuation
      return this.txtNode(`Jump`);
    } else if (iota === undefined) {
      // garbage
      return new Icon({ icon: "material-symbols:delete-outline", size: this.size });
    } else if (typeof(iota) === "object" && "pattern" in iota) {
      const pattern = iota.pattern;
      return new LineHexPattern({ pattern, centered: true, exactHeight: this.size, lineWidth: () => this.size() / 50 * 4});
    } else if (iota instanceof HexPattern) {
      const pattern = iota;
      return new LineHexPattern({ pattern, centered: true, exactHeight: this.size, lineWidth: () => this.size() / 50 * 4});
    } else {
      // array
      return new Layout({ layout: true, alignItems: "center", children: [
        this.txtNode("["),
        ...iota.map(iota => this.asNode(iota)),
        this.txtNode("]"),
      ] });
    }
  }
}
