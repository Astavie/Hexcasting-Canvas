import { Img, ImgProps, initial, nodeName, signal } from "@motion-canvas/2d";
import { createSignal, linear, SignalValue, SimpleSignal, TimingFunction } from "@motion-canvas/core";
import { LineHexPattern } from "./LineHexPattern";
import { ZappyHexPattern } from "./ZappyHexPattern";
import { DEFAULT_SCALE } from "../pattern";

export type HexWandType = "acacia" | "bamboo" | "birch" | "cherry" | "crimson" | "dark_oak" | "edified" | "jungle" | "mangrove" | "mindsplice" | "oak" | "old" | "quenched_0" | "quenched_1" | "quenched_2" | "quenched_3" | "spruce" | "warped";

export interface HexWandProps extends ImgProps {
  type?: SignalValue<HexWandType>;
}

@nodeName('HexWand')
export class HexWand extends Img {
  @initial("oak")
  @signal()
  public declare readonly type: SimpleSignal<HexWandType, this>;
  
  public constructor(props?: HexWandProps) {
    super({
      width: 16,
      height: 16,
      offset: [0.75, -0.75],
      src: () => `https://raw.githubusercontent.com/object-Object/HexMod/b61396b21e5e8be5232d8965cb7672427e86ddf6/Common/src/main/resources/assets/hexcasting/textures/item/staff/${this.type()}.png`,
      smoothing: false,
      ...props,
    })
  }

  public *drawPattern(pat: LineHexPattern | ZappyHexPattern, speed: number, move: boolean = false, timingFunction: TimingFunction = linear) {
    const transform = createSignal(() => this.worldToParent().multiply(pat.localToWorld()));
    const destination = () => pat.getCursor().transformAsPoint(transform());

    if (move) {
      const scale = Math.sqrt(this.scale().x * this.scale().y);
      const hexDis = destination().sub(this.position()).magnitude / DEFAULT_SCALE / scale / 1.5;
      yield* this.position(destination, hexDis / speed, timingFunction);
    } else {
      this.position(destination);
    }

    const time = (pat.pattern().angles.length + 1) / speed;
    yield* pat.end(1, time, timingFunction);
  }

  public *drawPatterns(pats: (LineHexPattern | ZappyHexPattern)[], speed: number) {
    for (let i = 0; i < pats.length; i++) {
      const pat = pats[i];
      yield* this.drawPattern(pat, speed, i > 0);
    }
  }
}

@nodeName('PreviewWand')
export class PreviewWand extends HexWand {
  public constructor(props: HexWandProps) {
    super({
      position: () => (this.parent() as LineHexPattern | ZappyHexPattern).getCursor(),
      ...props,
    })
  }
}
