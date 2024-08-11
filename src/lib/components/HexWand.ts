import { Img, ImgProps, initial, nodeName, signal } from "@motion-canvas/2d";
import { createSignal, linear, SignalValue, SimpleSignal, createDeferredEffect, useScene } from "@motion-canvas/core";
import { LineHexPattern } from "./LineHexPattern";
import { ZappyHexPattern } from "./ZappyHexPattern";
import { DEFAULT_SCALE } from "../pattern";

import addSegment from "../../../assets/add_segment.ogg";

export type HexWandType =
  "acacia" | "bamboo" | "birch" | "cherry" | "crimson" | "dark_oak" | "edified" | "jungle" | "mangrove" | "mindsplice" | "oak" | "old" | "quenched_0" | "quenched_1" | "quenched_2" | "quenched_3" | "spruce" | "warped" |
  "cursor";

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
      offset: () => this.type() === "cursor" ? [-0.55, -0.75] : [0.75, -0.75],
      src: () => this.type() === "cursor" ? "left_ptr.svg" : `https://raw.githubusercontent.com/object-Object/HexMod/b61396b21e5e8be5232d8965cb7672427e86ddf6/Common/src/main/resources/assets/hexcasting/textures/item/staff/${this.type()}.png`,
      smoothing: false,
      ...props,
    })
  }

  public *drawPattern(pat: LineHexPattern | ZappyHexPattern, speed: number, audio: boolean = false) {
    // set position to cursor
    const transform = createSignal(() => this.worldToParent().multiply(pat.localToWorld()));
    const destination = () => pat.getCursor().transformAsPoint(transform());
    const scale = Math.sqrt(this.scale().x * this.scale().y);
    const hexDis = destination().sub(this.position()).magnitude / DEFAULT_SCALE / scale / 1.5;
    yield* this.position(destination, hexDis / speed, linear);

    // play audio
    if (audio && pat instanceof ZappyHexPattern) {
      let segments = 0;
      createDeferredEffect(() => {
        const new_segments = Math.floor(pat.endSnapped() * (pat.pattern().angles.length + 1));
        if (new_segments > segments) {
          useScene().sounds.add(addSegment, -30);
        }
        segments = new_segments;
      });
    }

    // progress pattern
    const time = (pat.pattern().angles.length + 1) / speed;
    yield* pat.end(1, time, linear);
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
