import {makeProject} from '@motion-canvas/core';

import example from './scenes/example?scene';
import audio from "../audio/deltarune-explosion.mp3";
import evaluator from './scenes/eval?scene';

export default makeProject({
  scenes: [evaluator],
  audio: audio,
});
