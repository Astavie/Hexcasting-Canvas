import { Icon, initial, Layout, Node, nodeName, NodeProps, signal, Txt } from "@motion-canvas/2d";
import { SignalValue, SimpleSignal } from "@motion-canvas/core";
import { Iota, Vector3 } from "../vm";
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
    const size = this.size;
    const fontSize = function(this: Layout): number {
      const old = (<any>this.element.style)['font-size'];
      (<any>this.element.style)['font-size'] = '';
      const ret = parseFloat.call(this, this.styles.getPropertyValue('font-size'));
      (<any>this.element.style)['font-size'] = old;
      return size() / 50 * ret;
    }
    const txt: Txt = new Txt({
      text,
      fill: "white",
      fontSize: () => fontSize.call(txt),
      fontFamily: "monospace",
      lineHeight: () => size() / 50 * 46,
      paddingTop: () => size() / 50 * 4,
    });
    return txt;
  }

  private asNode(iota: Iota): Layout {
    const node = this._asNode(iota);
    node.margin(() => this.size() / 50 * 8);
    return node;
  }

  private _asNode(iota: Iota): Layout {
    if (iota instanceof HexPattern || typeof(iota) === "string") {
      const pattern = new HexPattern(iota);
      return new LineHexPattern({ pattern, centered: true, exactHeight: this.size, lineWidth: () => this.size() / 50 * 4});
      // pattern
    } else if (typeof(iota) === "number" || iota instanceof Vector3) {
      // number
      return this.txtNode(`${iota}`);
    } else if (iota === null) {
      // garbage
      return new Icon({ icon: "material-symbols:delete-outline", size: this.size });
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
