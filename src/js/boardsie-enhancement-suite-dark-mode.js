(async () => {
	storage = await browser.storage.sync.get();
	settings = storage.settings;
	if (settings === undefined)
		settings = {};
	if (settings.darkmode === undefined)
		settings.darkmode = false;
	if (settings.darkmode) {
		document.documentElement.dataset.theme = 'dark';
	}
})();