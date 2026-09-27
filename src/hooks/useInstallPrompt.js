import { useEffect, useState } from 'react';
import { getInstallState, isInstalled, platform, promptInstall, subscribeInstall } from '../services/install.js';

/** Install status for the "Install app" button and the install-first screen. */
export function useInstallPrompt() {
  const [state, setState] = useState(getInstallState);
  useEffect(() => subscribeInstall(setState), []);

  const installed = isInstalled(state);
  return {
    canInstall: Boolean(state.deferred) && !installed,
    installed,
    standalone: state.standalone,
    justInstalled: state.justInstalled,
    showIosHint: platform.ios && !installed,
    install: promptInstall,
  };
}
