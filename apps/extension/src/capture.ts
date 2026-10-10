// Capture de l'onglet de visio (Meet, Zoom web, Teams web…), vidéo seule.
// On ne demande pas l'audio : tabCapture couperait le son de l'onglet pour le recruteur.
export async function captureVisioTab(): Promise<MediaStream> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) throw new Error('Aucun onglet actif');
    const streamId = await new Promise<string>((resolve, reject) =>
      chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id }, (id) =>
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(id),
      ),
    );
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        // Contraintes propres à Chrome, absentes des types DOM standard.
        mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId },
      } as MediaTrackConstraints,
    });
  } catch (err) {
    // Repli : le recruteur choisit lui-même l'onglet dans le sélecteur de partage de Chrome.
    console.warn('tabCapture indisponible, repli sur getDisplayMedia', err);
    return navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  }
}
