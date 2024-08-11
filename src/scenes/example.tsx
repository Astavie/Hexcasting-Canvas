import {Circle, Img, makeScene2D, View2D} from '@motion-canvas/2d';
import {createRef, tween, waitFor, all} from '@motion-canvas/core';
import { HexGrid } from '../lib/components/HexGrid';

export default makeScene2D(function* (view) {
	  const myCircle = createRef<Circle>();

  view.add(
    <Circle
      ref={myCircle}
      // try changing these properties:
      x={-300}
      width={140}
      height={140}
      fill="#e13238"
    />,
  );

  yield* all(
    myCircle().position.x(300, 1).to(-300, 1),
    myCircle().fill('#e6a700', 1).to('#e13238', 1),
  );
});
