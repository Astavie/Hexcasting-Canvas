import {makeProject} from '@motion-canvas/core';

import example from './scenes/example?scene';
import evaluator from './scenes/eval?scene';

export default makeProject({
  scenes: [evaluator],
});
