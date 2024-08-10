import { SignalValue, SimpleSignal, TimingFunction, unwrap, Vector2 } from "@motion-canvas/core";
import { HexPattern } from "../pattern";
import { initial, Line, LineProps, nodeName, signal } from "@motion-canvas/2d";
import { ZappyHexPattern } from "./ZappyHexPattern";

export interface LineHexPatternProps extends LineProps {
  pattern: SignalValue<HexPattern>;
  centered?: SignalValue<boolean>;
}

@nodeName('LineHexPattern')
export class LineHexPattern extends Line {
  @signal()
  public declare readonly pattern: SimpleSignal<HexPattern, this>;

  @initial(true)
  @signal()
  public declare readonly centered: SimpleSignal<boolean, this>;
  
  public constructor(props: LineHexPatternProps) {
    super({
      radius: () => this.lineWidth() / 8,
      lineWidth: 4,
      stroke: 'white',
      lineCap: 'round',
      points: () => this.pattern().points(this.centered()),
      ...props,
    });
  }

  public endSnapped(): number {
    return this.end();
  }

  public getCursor(): Vector2 {
    return this.getPointAtPercentage(this.end()).position;
  }

  public *tweenPattern(value: SignalValue<HexPattern>, time: number, timingFunction?: TimingFunction) {
    // TODO: the default vector tweening function is kinda ugly
    // we should probably tween between hex angles
    yield *this.points(unwrap(value).points(this.centered()), time,timingFunction);
    this.pattern(value);
  }
}

@nodeName('PreviewHexPattern')
export class PreviewHexPattern extends LineHexPattern {
  public constructor(props?: LineProps) {
    super({
      lineWidth: 2,
      opacity: 0.2,
      pattern: () => (this.parent() as LineHexPattern | ZappyHexPattern).pattern(),
      centered: () => (this.parent() as LineHexPattern | ZappyHexPattern).centered(),
      ...props,
    });
  }
}
