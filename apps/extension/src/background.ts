// Un clic sur l'icône : sur une page web, on affiche ou cache le widget flottant Oval (injecté à la volée s'il n'est
// pas encore là) ; sur une page interne de Chrome, on ouvre le panneau latéral.
// `sidePanel.open()` doit être appelé directement dans le clic (geste utilisateur) : aucun `await` avant lui.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(console.error);

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  if (tab.url && /^https?:\/\//.test(tab.url)) {
    const id = tab.id;
    chrome.tabs.sendMessage(id, { type: 'oval:toggle' }).catch(() => {
      // Pas encore de widget sur cette page (site hors visio, ou onglet ouvert avant l'installation) : on l'injecte.
      chrome.scripting.executeScript({ target: { tabId: id }, files: ['widget.js'] }).catch(console.error);
    });
    return;
  }
  chrome.sidePanel.open({ tabId: tab.id }).catch(console.error);
});
