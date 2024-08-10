import { Img, makeScene2D, View2D } from "@motion-canvas/2d";
import { HexVM, INTROSPECTION, RETROSPECTION } from "../lib/vm";
import { createRef, tween, waitFor } from "@motion-canvas/core";
import { HexGrid } from "../lib/components/HexGrid";

function animateGif(img: Img, frames: number, delay: number, path: (frame: number) => string) {
	return tween(frames * delay, (value) => {
		let frame = Math.floor(value * (frames-1));
		img.src(path(frame));
	});
}

function* explode(view:View2D) {
  const video = <Img width={1000} height={1000} smoothing={false}/> as Img;
  view.add(video);
  yield* animateGif(video, 17, 0.05, ff => {
  	const f = (ff + 8) % 17;
  	return `frame_${f < 10 ? `0${f}` : f}_delay-0.1s.gif`
  });
}

export default makeScene2D(function* (view) {
  const vm = new HexVM();
  view.add(vm.stackNode({ scale: 2, x: -500 }));

  const grid = createRef<HexGrid>();
  view.add(<HexGrid scale={2} size={500} ref={grid}/>);

  const patterns = [
    INTROSPECTION,
    "northeast,qaq",
    "east,aa",
    "southeast,aqaae",
    "east,aawaawaa",
    RETROSPECTION,
    "southeast,wwwwwwwwwwwwwwwwwwww"
  ];
  yield* grid().drawPatterns(patterns, 16, false, vm);

  yield* waitFor(1.2);
  yield explode(view);
  yield* waitFor(0.2);
});
