import { makeScene2D } from "@motion-canvas/2d";
import { HexVM } from "../lib/vm";
import { createRef, waitFor } from "@motion-canvas/core";
import { HexGrid } from "../lib/components/HexGrid";
import { HERMES_GAMBIT, IRIS_GAMBIT } from "../lib/pattern";

export default makeScene2D(function* (view) {
  const grid = createRef<HexGrid>();
  view.add(<HexGrid size={500} scale={2} ref={grid}/>);

  const vm = new HexVM(grid(), 16);
  view.add(vm.stackNode({ scale: 2, x: -500 }));

  yield* vm.draw([[], IRIS_GAMBIT.rotated(3), IRIS_GAMBIT], HERMES_GAMBIT);
  yield* vm.run();

  yield* waitFor(1);
});
