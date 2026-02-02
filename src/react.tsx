/**
 * slowmo React Components
 *
 * React wrapper for the slowmo dial controller.
 *
 * @example
 * import { Slowmo } from 'slowmo/react';
 * function App() {
 *   return <Slowmo />;
 * }
 */

import { useEffect } from 'react';
import { setupDial, shutdownDial } from './dial-api';

/**
 * Slowmo dial component for React applications.
 *
 * Renders the draggable slowmo dial that controls animation speed.
 * Automatically handles mount/unmount lifecycle.
 *
 * @example
 * <Slowmo />
 */
export function Slowmo(): null {
  useEffect(() => {
    setupDial();
    return () => {
      shutdownDial();
    };
  }, []);

  return null;
}

export default Slowmo;
