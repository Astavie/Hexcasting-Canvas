import { nodeName, NodeProps, Node, initial, signal, vector2Signal, Vector2LengthSignal, Length } from "@motion-canvas/2d";
import { BBox, EPSILON, PossibleVector2, SignalValue, SimpleSignal, Vector2 } from "@motion-canvas/core";
import { HexWand, HexWandType } from "./HexWand";
import { DEFAULT_SCALE, HexCoord, HexDir, HexPattern, PatternType, PossibleHexPattern } from "../pattern";
import { ZappyHexPattern } from "./ZappyHexPattern";
import { LineHexPattern, PreviewHexPattern } from "./LineHexPattern";
import { drawSpot, lerp } from "../render";
import chroma from "chroma-js";
import { HexVM } from "../vm";

export interface HexGridProps extends NodeProps {
  wandType?: SignalValue<HexWandType>,
  size?: SignalValue<PossibleVector2<Length>>,
}

@nodeName('HexGrid')
export class HexGrid extends Node {
  
  @initial("cursor")
  @signal()
  public declare readonly wandType: SimpleSignal<HexWandType, this>;

  @initial({x: null, y: null})
  @vector2Signal({x: 'width', y: 'height'})
  public declare readonly size: Vector2LengthSignal<this>;

  private _wand: HexWand;
  private _pos: HexCoord = new HexCoord(0, 0);

  public get wand(): HexWand {
    return this._wand;
  }

  public patterns(): (LineHexPattern | ZappyHexPattern)[] {
    return this.children().filter(c => c instanceof LineHexPattern || c instanceof ZappyHexPattern);
  }

  public constructor(props?: HexGridProps) {
    super({ ...props });
    this._wand = new HexWand({
      type: () => this.wandType(),
      position: new HexCoord(0.333, 0.333).point()
    });
    this.add(this._wand);
  }

  public addPattern(pat: LineHexPattern | ZappyHexPattern, cursor?: HexCoord): this {
    const bounds = pat.pattern().bounds();
    const offset = -Math.floor((bounds[0].r + bounds[1].r) / 2);

    if (cursor === undefined) {
      this._pos = this.findOnoccupied(this._pos.add(0, offset), HexDir.EAST, pat.pattern()).add(0, -offset);
    } else {
      this._pos = cursor;
    }

    pat.position(this._pos.add(0, offset).point());
    return this.add(pat);
  }

  public *drawPatterns(pats: PossibleHexPattern[], speed: number, preview: boolean = false, vm?: HexVM, audio: boolean = true) {
    const patterns: ZappyHexPattern[] = [];

    for (const pat of pats) {
      const pattern = new HexPattern(pat);
      const node = new ZappyHexPattern({
        pattern,
        zIndex: this._wand.zIndex() - EPSILON,
        centered: false,
        type: PatternType.EVALUATED,
        end: 0,
      });

      if (preview) {
        node.add(new PreviewHexPattern());
      }

      this.addPattern(node);
      patterns.push(node);
    }

    yield* this._wand.drawPatterns(patterns, speed, vm, audio);
  }

  public findOnoccupied(start: HexCoord, dir: HexDir, pattern: HexPattern): HexCoord {
    let current = start;
    while (this.occupied(...pattern.coords().map(c => c.add(current)))) {
      current = current.add(dir);
    }
    return current;
  }

  public occupied(...coords: HexCoord[]): boolean {
    for (const node of this.patterns()) {
      const pos = HexCoord.snap(node.position());
      const pattern = node.pattern();
      const pcoords = pattern.coords();
      if (pcoords.some(c => coords.some(o => c.add(pos).equals(o)))) {
        return true;
      }
    }
    return false;
  }

  public override hit(position: Vector2): Node | null {
    const local = position.transformAsPoint(this.localToParent().inverse());
    if (this.cacheBBox().includes(local)) {
      return super.hit(position) ?? this;
    }
    return null;
  }

  protected override getCacheBBox(): BBox {
    return BBox.fromSizeCentered(this.size());
  }

  protected override draw(context: CanvasRenderingContext2D): void {
    const mousePos = this._wand.position();
    const mouseCoord = HexCoord.snap(mousePos);
    const radius = 3;
    for (const dot of mouseCoord.range(radius)) {
      const dotPx = dot.point();
      const delta = dotPx.sub(mousePos).magnitude;
      const scaledDist = Math.min(Math.max(1 - ((delta - DEFAULT_SCALE) / (radius * DEFAULT_SCALE)), 0), 1);
      drawSpot(context, dotPx, scaledDist * 2, chroma.rgb(
        lerp(scaledDist, 0.4, 0.5) * 255,
        lerp(scaledDist, 0.8, 1.0) * 255,
        lerp(scaledDist, 0.7, 0.9) * 255,
        scaledDist * this._wand.opacity(),
      ));
    }
    super.draw(context);
  }
}
