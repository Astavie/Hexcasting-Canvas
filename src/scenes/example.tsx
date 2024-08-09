import {makeScene2D} from '@motion-canvas/2d';
import {createRef, waitFor} from '@motion-canvas/core';
import { HexGrid } from '../lib/components/HexGrid';

export default makeScene2D(function* (view) {
  const grid = createRef<HexGrid>();
  view.add(<HexGrid scale={4} size={500} ref={grid}/>);

  const patterns = ["east,qaqqqqq", "east,qaqqqqq"];
  yield* grid().drawPatterns(patterns, 8, true);

  for (const p of grid().patterns()) {
    yield p.opacity(0, 1);
  }
  yield* waitFor(1);
});
