import {Img, makeScene2D, Video, View2D} from '@motion-canvas/2d';
import {createRef, tween, waitFor} from '@motion-canvas/core';
import { HexGrid } from '../lib/components/HexGrid';

function animateGif(img: Img, frames: number, delay: number, path: (frame: number) => string) {
	return tween(frames * delay, (value) => {
		let frame = Math.floor(value * (frames-1));
		img.src(path(frame));
	});
}

function* explode(view:View2D) {
  const video = <Img width={1000} height={1000} smoothing={false}/> as Img;
  view.add(video);
  yield* animateGif(video, 17, 0.05, ff => { const f = (ff + 8) % 17; return `frame_${f < 10 ? `0${f}` : f}_delay-0.1s.gif`});
}

export default makeScene2D(function* (view) {
  const grid = createRef<HexGrid>();
  view.add(<HexGrid scale={4} size={500} ref={grid}/>);

  grid().wand.opacity(0);
  yield* grid().wand.opacity(1, 1);

  const patterns = ["northeast,qaq", "east,aa", "southeast,aqaae", "east,aawaawaa"];
  yield* grid().drawPatterns(patterns, 8);

  yield* grid().wand.opacity(0, 0.6);
  yield explode(view);
  yield* waitFor(0.5);
});
