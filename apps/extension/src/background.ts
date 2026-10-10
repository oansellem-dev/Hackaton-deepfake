// Un clic sur l'icône de l'extension ouvre le panneau latéral (et accorde activeTab sur l'onglet de visio).
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
