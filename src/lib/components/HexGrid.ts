import { nodeName, NodeProps, Node, initial, signal, vector2Signal, Vector2LengthSignal, Length } from "@motion-canvas/2d";
import { BBox, EPSILON, PossibleVector2, SignalValue, SimpleSignal, Vector2 } from "@motion-canvas/core";
import { HexWand, HexWandType } from "./HexWand";
import { HexCoord, HexDir, HexPattern, PossibleHexPattern } from "../pattern";
import { ZappyHexPattern } from "./ZappyHexPattern";
import { LineHexPattern, PreviewHexPattern } from "./LineHexPattern";

export interface HexGridProps extends NodeProps {
  wandType?: SignalValue<HexWandType>,
  size?: SignalValue<PossibleVector2<Length>>,
}

@nodeName('HexGrid')
export class HexGrid extends Node {
  
  @initial("oak")
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

  public constructor(props?: HexGridProps) {
    super({ ...props });
    this._wand = new HexWand({ type: () => this.wandType() });
    this.add(this._wand);
  }

  public addPattern(pat: LineHexPattern | ZappyHexPattern, cursor?: HexCoord): this {
    if (cursor === undefined) {
      const bounds = pat.pattern().bounds();
      this._pos = this.findOnoccupied(this._pos, HexDir.EAST, bounds);
    } else {
      this._pos = cursor;
    }

      pat.position(this._pos.point());
    return this.add(pat);
  }

  public patterns(): ZappyHexPattern[] {
    return this.parseChildren(this.children()).filter(c => c instanceof ZappyHexPattern);
  }

  public *drawPatterns(pats: PossibleHexPattern[], speed: number, preview: boolean = false) {
    const patterns: ZappyHexPattern[] = [];

    for (const pat of pats) {
      const pattern = new HexPattern(pat);
      const node = new ZappyHexPattern({
        pattern,
        zIndex: this._wand.zIndex() - EPSILON,
        centered: false,
        end: 0,
      });

      if (preview) {
        node.add(new PreviewHexPattern());
      }

      this.addPattern(node);
      patterns.push(node);
    }

    yield* this._wand.drawPatterns(patterns, speed);
  }

  public findOnoccupied(start: HexCoord, dir: HexDir, bounds?: [HexCoord, HexCoord]): HexCoord {
    let current = start;
    while (this.occupied(current, bounds)) {
      current = current.add(dir);
    }
    return current;
  }

  public occupied(coord: HexCoord, bounds?: [HexCoord, HexCoord]): boolean {
    const check = (point: Vector2) =>
      this.patterns().some(p => p.hit(point) !== null);

    if (bounds === undefined) {
      const point = coord.point();
      return check(point);
    } else {
      for (let r = bounds[0].r; r <= bounds[1].r; r++) {
        for (let q = bounds[0].q; q <= bounds[1].q; q++) {
          const point = new HexCoord(coord.q + q, coord.r + r).point();
          if (check(point)) return true;
        }
      }
      return false;
    }
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
}
