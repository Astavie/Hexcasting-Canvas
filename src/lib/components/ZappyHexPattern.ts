import { initial, Node, nodeName, NodeProps, signal } from "@motion-canvas/2d";
import { BBox, SignalValue, SimpleSignal, Vector2 } from "@motion-canvas/core";
import chroma from "chroma-js";
import { DEFAULT_READABILITY_OFFSET, drawPatternFromPoints } from "../render";
import { HexAngle, HexPattern, PatternType } from "../pattern";

export interface ZappyHexPatternProps extends NodeProps {
  pattern: SignalValue<HexPattern>;
  snap?: SignalValue<number>;
  end?: SignalValue<number>;
  type?: SignalValue<PatternType>;
  centered?: SignalValue<boolean>;
}

@nodeName('ZappyHexPattern')
export class ZappyHexPattern extends Node {
  @signal()
  public declare readonly pattern: SimpleSignal<HexPattern, this>;

  @initial(1)
  @signal()
  public declare readonly end: SimpleSignal<number, this>;

  @initial(0.4)
  @signal()
  public declare readonly snap: SimpleSignal<number, this>;

  @initial(PatternType.UNRESOLVED)
  @signal()
  public declare readonly type: SimpleSignal<PatternType, this>;

  @initial(true)
  @signal()
  public declare readonly centered: SimpleSignal<boolean, this>;

  public constructor(props: ZappyHexPatternProps) {
    super({ ...props });
  }

  public getCursor(): Vector2 {
    return this.getCursorAtPercentage(this.end());
  }

  public getWorldCursor(): Vector2 {
    return this.getCursor().transformAsPoint(this.localToWorld());
  }

  public getCursorAtPercentage(value: number): Vector2 {
    const points = this.points();
    const nextIndex = Math.ceil(value * (points.length - 1));

    if (nextIndex > 0) {
      let t = (value * (points.length - 1)) % 1;
      if (t === 0) t = 1;

      let lerp = Vector2.lerp;

      const angles = this.pattern().angles;
      const angle = angles[Math.max(nextIndex - 2, 0)] ?? HexAngle.FORWARD;
      if (angle === HexAngle.RIGHT || angle === HexAngle.RIGHT_BACK) {
        const origin = points[nextIndex].rotate(60, points[nextIndex - 1]);
        lerp = Vector2.createPolarLerp(false, origin);
      } else if (angle === HexAngle.LEFT || angle === HexAngle.LEFT_BACK) {
        const origin = points[nextIndex].rotate(-60, points[nextIndex - 1]);
        lerp = Vector2.createPolarLerp(true, origin);
      }

      return lerp(points[nextIndex - 1], points[nextIndex], t);
    } else {
      return points[0];
    }
  }

  public progressSnapped(): number {
    if (this.isSnapped()) {
      const length = this.pattern().angles.length + 2;
      return Math.ceil(this.end() * (length - 1)) / (length - 1);
    } else {
      return this.end();
    }
  }

  public isSnapped(): boolean {
    const length = this.pattern().angles.length + 2;
    const t = (this.end() * (length - 1)) % 1;
    return t >= 1 - this.snap();
  }

  public points(): Vector2[] {
    return this.pattern().points(this.centered());
  }

  protected seed(): number {
    return Array.from(this.key).reduce(function(a, b) {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
  }

  protected override draw(context: CanvasRenderingContext2D): void {
    const pattern = this.pattern();
    if (this.end() < 1) {
      // get amount of visible points
      const length = this.pattern().angles.length + 2;
      let n = Math.ceil(this.end() * (length - 1)) + 1;

      const first = this.points().slice(0, n);

      // lerp between last two points
      if (!this.isSnapped()) {
        first[first.length - 1] = this.getCursor();
        n -= 1;
      }

      drawPatternFromPoints(
        context,
        first,
        pattern.findDupIndices(length),
        this.isSnapped(),
        chroma(0x64c8ff),
        chroma(0xfecbe6),
        0.1,
        DEFAULT_READABILITY_OFFSET,
        1,
        this.seed(),
      )
    } else {
      drawPatternFromPoints(
        context,
        this.points(),
        pattern.findDupIndices(),
        true,
        this.type().color,
        this.type().fadeColor,
        this.type().success ? 0.2 : 0.9,
        DEFAULT_READABILITY_OFFSET,
        1,
        this.seed(),
      )
    }
    
    this.drawChildren(context);
  }

  public override hit(position: Vector2): Node | null {
    const local = position.transformAsPoint(this.localToParent().inverse());
    if (this.cacheBBox().includes(local)) {
      return super.hit(position) ?? this;
    }
    return null;
  }

  protected override getCacheBBox(): BBox {
    return BBox.fromPoints(...this.points()).expand(5);
  }
}
