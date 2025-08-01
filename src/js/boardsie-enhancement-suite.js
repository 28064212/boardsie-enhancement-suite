let index = -1;
let showpreviews = false;
let settings = {};
let userDetails;
let api = "https://www.boards.ie/api/v2/";
const version = '0.3.6';

try {
	document.querySelector('#themeFooter').shadowRoot.querySelector('.footer').style.background = "inherit";
	document.querySelector('#themeFooter').shadowRoot.querySelector('.footer').style.color = "inherit";
	if (!(location.pathname == '/' || location.pathname.startsWith("/profile/edit/")))
		document.querySelector('.Panel.Panel-main').style.display = "none";
} catch (e) { }

(async () => {
	storage = await browser.storage.sync.get();
	settings = storage.settings;
	if (settings === undefined)
		settings = {};
	if (settings.autobookmark === undefined)
		settings.autobookmark = true;
	if (settings.keyboard === undefined)
		settings.keyboard = true;
	if (settings.darkmode === undefined)
		settings.darkmode = false;
	if (settings.stickyheader === undefined)
		settings.stickyheader = false;
	if (settings.stickybreadcrumbs === undefined)
		settings.stickybreadcrumbs = false;
	if (settings.bookmarkbadge === undefined)
		settings.bookmarkbadge = true;

	if (settings.keyboard)
		window.addEventListener('keydown', keyShortcuts, true);
	// if (settings.darkmode) // moved to separate file to load earlier
	// 	document.body.dataset.theme = 'dark';
	if (settings.stickyheader)
		document.body.dataset.stickyheader = '';
	if (settings.stickybreadcrumbs)
		document.body.dataset.stickybreadcrumbs = '';
	if (document.querySelector('#Form_Bookmarked') && settings.autobookmark == false)
		document.querySelector('#Form_Bookmarked').checked = false;
	await browser.storage.sync.set({ "settings": settings });
})();

// let categories1Promise = fetch(api + 'categories/?limit=500&outputFormat=flat')
// 	.then(response => {
// 		if (response.ok)
// 			return response.json();
// 		else
// 			throw new Error(response.statusText);
// 	});
// let categories2Promise = fetch(api + 'categories/?limit=500&outputFormat=flat&page=2')
// 	.then(response => {
// 		if (response.ok)
// 			return response.json();
// 		else
// 			throw new Error(response.statusText);
// 	});

// let categoriesPromise = Promise.all([categories1Promise, categories2Promise])
// 	.then(data => {
// 		let categories = [];
// 		let order = 0;
// 		for (let d of data[0]) {
// 			categories.push({ "id": d.categoryID, "parent": d.parentCategoryID, "name": d.name, "slug": d.urlcode, "followed": d.followed, "depth": d.depth, "url": d.url, "order": order });
// 			order += 1;
// 		}
// 		for (let d of data[1]) {
// 			categories.push({ "id": d.categoryID, "parent": d.parentCategoryID, "name": d.name, "slug": d.urlcode, "followed": d.followed, "depth": d.depth, "url": d.url, "order": order });
// 			order += 1;
// 		}
// 		return categories;
// 	})
// 	.catch(e => console.log(e));

let categoriesPromise = fetch(api + 'categories/?maxDepth=100&outputFormat=tree')
	.then(response => {
		if (response.ok)
			return response.json();
		else
			throw new Error(response.statusText);
	})
	.then(data => {
		let categories = [];
		flattenCategories(data, categories);
		let order = 0;
		for (let c of categories) {
			c.order = order;
			order += 1;
		}
		return categories;
	})
	.catch(e => console.log(e));

let titleBar = document.querySelector('#titleBar');
if (titleBar && titleBar.innerHTML == "") {
	// some pages load titlebar contents lazily
	let observer = new MutationObserver(function (mutationsList, observer) { titleBarObserver(mutationsList, observer, categoriesPromise) });
	observer.observe(titleBar, { childList: true });
}
else if (titleBar) {
	addCategoryListing(categoriesPromise);
	menuItems();
	let bcBox = document.querySelector('.BreadcrumbsBox');
	if (bcBox)
		bcBox.parentElement.classList.add('breadcrumb-container');
}

unboldReadDiscussions();
highlightOP();
restoreOPAvatar();
removeExternalLinkCheck();
addThanksAfterPosts();
addDiscussionPreviews();
let homeTabs = document.querySelector('#homepage-tabs');
if (homeTabs) {
	for (let t of homeTabs.querySelectorAll('li')) {
		t.addEventListener('click', function () {
			addDiscussionPreviews();
		});
	}
}
userMenus();
addMarkReadButton();
//editableQuoting();
modsInfo(categoriesPromise);
userHistory(categoriesPromise);
window.addEventListener('hashchange', function () {
	userHistory(categoriesPromise);
});
markCategoriesRead(categoriesPromise);

addBookmarkStatusToComments();
let profileComments = document.querySelector('.Profile .Comments.DataList');
if (profileComments) {
	let observer = new MutationObserver(addBookmarkStatusToComments);
	observer.observe(profileComments, { childList: true, subtree: false });
}

userDetails = fetch(api + "users/me")
	.then(response => {
		if (response.ok)
			return response.json();
		else
			throw new Error(response.statusText);
	})
	.catch(e => console.log(e));

// functions
function flattenCategories(data, categories) {
	if (Array.isArray(data)) {
		for (let d of data) {
			let urlcode = d.urlcode == null ? d.urlCode : d.urlcode;
			categories.push({ "id": d.categoryID, "parent": d.parentCategoryID, "name": d.name, "slug": urlcode, "followed": d.followed, "depth": d.depth, "url": d.url });
			if (d.children) {
				if ((Array.isArray(d.children) && d.children.length > 0) || Object.keys(d.children).length > 0)
					flattenCategories(d.children, categories)
			}
		}
	} else {
		for (let d in data) {
			d = data[d];
			let urlcode = d.urlcode == null ? d.urlCode : d.urlcode;
			categories.push({ "id": d.categoryID, "parent": d.parentCategoryID, "name": d.name, "slug": urlcode, "followed": d.followed, "depth": d.depth, "url": d.url });
			if (d.children) {
				if ((Array.isArray(d.children) && d.children.length > 0) || Object.keys(d.children).length > 0)
					flattenCategories(d.children, categories)
			}
		}
	}
}

function titleBarObserver(mutationList, observer, categoriesPromise) {
	let catLink = document.querySelector("a[href='/categories'], a[href='https://www.boards.ie/categories']");
	if (catLink) {
		// if category link is available, we don't need to monitor anymore
		if (observer)
			observer.disconnect();
		addCategoryListing(categoriesPromise);
		menuItems();
		let bcBox = document.querySelector('.BreadcrumbsBox');
		if (bcBox)
			bcBox.parentElement.classList.add('breadcrumb-container');
	}
}

function menuItems() {
	let meBox = document.querySelector('.meBox');

	let sep = document.createElement('div');
	sep.classList.add('menu-separator-28064212');
	meBox.insertBefore(sep, meBox.lastElementChild);

	let a = document.createElement('a');
	a.innerHTML = '⚙';
	a.id = 'settings-icon-28064212';
	a.tabIndex = "0";
	meBox.insertBefore(a, meBox.lastElementChild);
	a.addEventListener('click', settingsModal);

	a = document.createElement('a');
	a.innerHTML = '⌨';
	a.id = 'docs-icon-28064212';
	a.tabIndex = "0";
	meBox.insertBefore(a, meBox.lastElementChild);
	a.addEventListener('click', docsModal);

	a = document.createElement('a');
	a.href = "/discussions/bookmarked";
	a.id = 'bookmarks-icon-28064212';
	a.tabIndex = "0";
	meBox.insertBefore(a, meBox.lastElementChild);
	let badge = document.createElement("div");
	badge.classList.add("notification-badge-28064212");
	a.appendChild(badge);
	checkBookmarks();

	let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	svg.setAttribute("viewBox", "0 0 12.733 16.394");
	svg.innerHTML = '<title>Bookmarks</title><path class="svgBookmark-mainPath" stroke-width="2" d="M1.05.5H11.683a.55.55,0,0,1,.55.55h0V15.341a.549.549,0,0,1-.9.426L6.714,12a.547.547,0,0,0-.7,0L1.4,15.767a.55.55,0,0,1-.9-.426V1.05A.55.55,0,0,1,1.05.5z"></path>';
	svg.style.height = "16px";
	svg.style.width = "12px";
	svg.querySelector('path').style.stroke = "white";
	svg.querySelector('path').style.fill = "rgb(59, 85, 134)";
	//svg.querySelector('path').style.fill = "none";
	a.appendChild(svg);

	sep = document.createElement('div');
	sep.classList.add('menu-separator-28064212');
	meBox.insertBefore(sep, meBox.lastElementChild);
}

function checkBookmarks() {
	fetch(api + 'discussions/bookmarked')
		.then(response => {
			if (response.ok)
				return response.json();
			else
				throw new Error(response.statusText);
		})
		.then(data => {
			let bookmarked = data.filter(b => b.unread);
			if (bookmarked.length > 0 && settings.bookmarkbadge)
				document.querySelector(".notification-badge-28064212").style.display = "block";
			else
				document.querySelector(".notification-badge-28064212").style.display = "none";
		})
		.catch(e => console.log(e));
	setTimeout(checkBookmarks, 60000);
}

function settingsModal() {
	let settingsModal = document.querySelector('#settings-28064212');
	if (settingsModal) {
		settingsModal.style.display = settingsModal.style.display == 'none' ? 'block' : 'none';
		if (settingsModal.style.display == 'block') {
			settingsModal.focus();
			document.querySelectorAll('#settings-content-28064212 div[id*="settings-"]').forEach(d => d.style.display = 'none');
			document.querySelectorAll('#settings-content-28064212 div p').forEach(p => p.style.textDecoration = 'none');
			document.querySelector('#settings-content-28064212 div[id*="settings-"]').style.display = 'block';
			document.querySelector('#settings-content-28064212 div p').style.textDecoration = 'underline';
		}
		else
			document.activeElement.blur();
	} else {
		settingsModal = document.createElement('div');
		settingsModal.id = 'settings-28064212';
		settingsModal.tabIndex = "-1";
		settingsModal.addEventListener('click', function (e) {
			if (e.target == settingsModal)
				e.target.style.display = 'none';
		});
		document.body.appendChild(settingsModal);
		let content = document.createElement('div');
		content.id = 'settings-content-28064212';
		settingsModal.appendChild(content);
		let header = document.createElement("p");
		header.innerHTML = "Boardsie Enhancement Suite - Settings";
		content.appendChild(header);
		let lhm = document.createElement("div");
		lhm.innerHTML = `
			<p data-for="settings-behaviours-28064212" style='text-decoration: underline'>Behaviour</p>
			<p data-for="settings-about-28064212">About</p>`;
		content.appendChild(lhm);

		let behaviours = document.createElement('div');
		behaviours.classList.add("settings-values-28064212");
		behaviours.id = "settings-behaviours-28064212";
		content.appendChild(behaviours);
		behaviours.innerHTML += '<p><input type="checkbox" id="settings-darkmode-28064212" /><label for="settings-darkmode-28064212">Dark Mode</label></p>';
		behaviours.innerHTML += '<p><input type="checkbox" id="settings-stickyheader-28064212" /><label for="settings-stickyheader-28064212">Sticky Header</label></p>';
		behaviours.innerHTML += '<p><input type="checkbox" id="settings-stickybreadcrumbs-28064212" /><label for="settings-stickybreadcrumbs-28064212">Sticky Breadcrumbs</label></p>';
		behaviours.innerHTML += '<p><input type="checkbox" id="settings-autobookmark-28064212" /><label for="settings-autobookmark-28064212">Automatically set "Bookmark this discussion"</label></p>';
		behaviours.innerHTML += '<p><input type="checkbox" id="settings-bookmarkbadge-28064212" /><label for="settings-bookmarkbadge-28064212">Display badge for unread bookmarks</label></p>';
		behaviours.innerHTML += '<p><input type="checkbox" id="settings-keyboard-28064212" /><label for="settings-keyboard-28064212">Keyboard shortcuts</label></p>';

		let keyboard = behaviours.querySelector('#settings-keyboard-28064212');
		keyboard.checked = settings.keyboard;
		keyboard.addEventListener('change', async function (e) {
			settings.keyboard = keyboard.checked;
			if (settings.keyboard)
				window.addEventListener('keydown', keyShortcuts, true);
			else
				window.removeEventListener('keydown', keyShortcuts, true);
			await browser.storage.sync.set({ "settings": settings });
		});

		let darkmode = behaviours.querySelector('#settings-darkmode-28064212');
		darkmode.checked = settings.darkmode;
		darkmode.addEventListener('change', async function (e) {
			settings.darkmode = darkmode.checked;
			if (settings.darkmode)
				document.documentElement.dataset.theme = 'dark';
			else
				delete document.documentElement.dataset.theme;
			await browser.storage.sync.set({ "settings": settings });
		});

		let stickyheader = behaviours.querySelector('#settings-stickyheader-28064212');
		stickyheader.checked = settings.stickyheader;
		stickyheader.addEventListener('change', async function (e) {
			settings.stickyheader = stickyheader.checked;
			if (settings.stickyheader)
				document.body.dataset.stickyheader = '';
			else
				delete document.body.dataset.stickyheader;
			await browser.storage.sync.set({ "settings": settings });
		});

		let stickybreadcrumbs = behaviours.querySelector('#settings-stickybreadcrumbs-28064212');
		stickybreadcrumbs.checked = settings.stickybreadcrumbs;
		stickybreadcrumbs.addEventListener('change', async function (e) {
			settings.stickybreadcrumbs = stickybreadcrumbs.checked;
			if (settings.stickybreadcrumbs)
				document.body.dataset.stickybreadcrumbs = '';
			else
				delete document.body.dataset.stickybreadcrumbs;
			await browser.storage.sync.set({ "settings": settings });
		});

		let autoBookmark = behaviours.querySelector('#settings-autobookmark-28064212');
		autoBookmark.checked = settings.autobookmark;
		autoBookmark.addEventListener('change', async function (e) {
			settings.autobookmark = autoBookmark.checked;
			if (document.querySelector('#Form_Bookmarked') && settings.autobookmark == false)
				document.querySelector('#Form_Bookmarked').checked = false;
			await browser.storage.sync.set({ "settings": settings });
		});

		let bookmarkBadge = behaviours.querySelector('#settings-bookmarkbadge-28064212');
		bookmarkBadge.checked = settings.bookmarkbadge;
		bookmarkBadge.addEventListener('change', async function (e) {
			settings.bookmarkbadge = bookmarkBadge.checked;
			if (!settings.bookmarkbadge)
				document.querySelector(".notification-badge-28064212").style.display = "none";
			await browser.storage.sync.set({ "settings": settings });
		});

		let about = document.createElement('div');
		about.style.display = "none"; // hide initially
		about.classList.add("settings-values-28064212");
		about.id = "settings-about-28064212";
		content.appendChild(about);
		about.innerHTML += '<p>Version: ' + version + '</p>';
		about.innerHTML += '<p>Extension Homepage: <a href="https://github.com/28064212/boardsie-enhancement-suite" target="_blank">https://github.com/28064212/boardsie-enhancement-suite</p>';

		let items = lhm.querySelectorAll('p');
		for (const i of items) {
			i.addEventListener('click', function (e) {
				document.querySelectorAll('#settings-content-28064212 div[id*="settings-"]').forEach(div => div.style.display = 'none');
				lhm.querySelectorAll('p').forEach(p => p.style.textDecoration = 'none');
				document.querySelector('#' + i.dataset.for).style.display = "block";
				this.style.textDecoration = 'underline';
			});
		}
		settingsModal.focus();
	}
}

function docsModal() {
	let docsModal = document.querySelector('#docs-28064212');
	if (docsModal == null) {
		docsModal = document.createElement('div');
		docsModal.id = 'docs-28064212';
		docsModal.style.display = 'none';
		docsModal.addEventListener('click', function (e) {
			if (e.target == docsModal)
				e.target.style.display = 'none';
		});
		document.body.appendChild(docsModal);
		docsModal.innerHTML = `
	<div id="docs-content-28064212">
		<p>Boardsie Enhancement Suite</p>
		<div class="docs-keygroup">
			<p>General</p>
			<table>
				<tbody>
					<tr>
						<td><kbd>?</kbd></td>
						<td>Toggle documentation</td>
					</tr>
					<tr>
						<td><kbd>s</kbd></td>
						<td>Toggle settings menu</td>
					</tr>
					<tr>
						<td><kbd>a / z</kbd></td>
						<td>Highlight next/previous</td>
					</tr>
					<tr>
						<td><kbd>→</kbd></td>
						<td>Next page</td>
					</tr>
					<tr>
						<td><kbd>shift</kbd><kbd>→</kbd></td>
						<td>Last page</td>
					</tr>
					<tr>
						<td><kbd>←</kbd></td>
						<td>Previous page</td>
					</tr>
					<tr>
						<td><kbd>shift</kbd><kbd>←</kbd></td>
						<td>First page</td>
					</tr>
					<tr>
						<td><kbd>ctrl</kbd><kbd>←</kbd></td>
						<td>Go to parent</td>
					</tr>
					<tr>
						<td><kbd>c</kbd></td>
						<td>Display category menu</td>
					</tr>
					<tr>
						<td><kbd>ctrl</kbd><kbd>space</kbd></td>
						<td>Focus on search box</td>
					</tr>
					<tr>
						<td><kbd>esc</kbd></td>
						<td>Close settings/documentation</td>
					</tr>
				</tbody>
			</table>
		</div>
		<div class="docs-keygroup">
			<p>Discussion Lists</p>
			<table>
				<tbody>
					<tr>
						<td><kbd>q</kbd></td>
						<td>Open highlighted discussion</td>
					</tr>
					<tr>
						<td><kbd>ctrl</kbd><kbd>q</kbd></td>
						<td>Open at last page</td>
					</tr>
					<tr>
						<td><kbd>alt</kbd><kbd>q</kbd></td>
						<td>Open at first page</td>
					</tr>
					<tr>
						<td><kbd>r</kbd></td>
						<td>Start a new discussion</td>
					</tr>
					<tr>
						<td><kbd>o</kbd></td>
						<td>Open all unread discussion</td>
					</tr>
					<tr>
						<td><kbd>f</kbd></td>
						<td>Follow category</td>
					</tr>
					<tr>
						<td><kbd>m</kbd></td>
						<td>Mark category read</td>
					</tr>
					<tr>
						<td><kbd>x</kbd></td>
						<td>Show discussion preview</td>
					</tr>
				</tbody>
			</table>
		</div>
		<div class="docs-keygroup">
			<p>Post Lists</p>
			<table>
				<tbody>
					<tr>
						<td><kbd>r</kbd></td>
						<td>Add a new reply</td>
					</tr>
					<tr>
						<td><kbd>q</kbd></td>
						<td>Quote highlighted post</td>
					</tr>
					<tr>
						<td><kbd>l</kbd></td>
						<td>Go to latest unread on current page</td>
					</tr>
					<tr>
						<td><kbd>t</kbd></td>
						<td>Toggle thanks on highlighted post</td>
					</tr>
					<tr>
						<td><kbd>f</kbd></td>
						<td>Follow discussion</td>
					</tr>
					<tr>
						<td><kbd>1-9</kbd></td>
						<td>Open the corresponding link</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>`;
	}
	docsModal.style.display = docsModal.style.display == 'none' ? 'block' : 'none';
}

function addMarkReadButton() {
	if (location.pathname.startsWith('/categories/') && document.querySelector('meta[name=catid]')) {
		let markread = document.createElement('span');
		markread.appendChild(document.createTextNode('Mark Read ✓'));
		markread.style.marginRight = '10px';
		markread.style.padding = '5px';
		markread.style.borderRadius = '5px';
		markread.style.opacity = '1';
		markread.style.setProperty('cursor', 'pointer', 'important');

		let pager = document.querySelector('#PagerBefore');
		pager.insertBefore(markread, pager.firstElementChild);

		markread.addEventListener('click', markCategoryRead);
	}
}

function markCategoriesRead(categoriesPromise) {
	let catFollowedPage = location.pathname == '/categories' && document.querySelector('.selectBox-selected').textContent == 'Following';
	let listed = document.querySelectorAll("h2.CategoryNameHeading a");
	for (let l of listed) {
		l.style.opacity = "0.1";
	}
	categoriesPromise.then(categories => {
		if (catFollowedPage) {
			// display all followed on categories page
			let followed = categories.filter(c => c.followed);
			let listedArray = Array.from(listed);
			for (let f of followed) {
				if (!listedArray.find(a => a.href == f.url)) {
					let row = document.createElement('tr');
					row.innerHTML = `<tr class="">
					<td>
						<div class="spritethreadbit spritethreadbit-threadunread" title="Discussion has no unread posts"></div>
					</td>
					<td id="CategoryName">
						<div class="Wrap">
							<h2 aria-level='3' class='CategoryNameHeading'><a href="` + f.url + `" class="threadbit-threadlink">` + f.name + `</a></h2>
						</div>
					</td>
					<td class="forum-threadlist-lastpost">
						<div class="Block Wrap"><div>
					</td>
					<td class="forum-threadlist-replies">
						<div class="Wrap"></div>
					</td>
					<td class="forum-threadlist-replies">
						<div class="Wrap"></div>
					</td>
				</tr>`;
					document.querySelector('.forum-threadlist-table tbody').appendChild(row);
				}
			}
			let rows = Array.from(document.querySelectorAll('.forum-threadlist-table tbody tr'));
			rows.sort(function (a, b) {
				let first = followed.find(f => f.url == a.querySelector('.CategoryNameHeading a').href);
				let second = followed.find(f => f.url == b.querySelector('.CategoryNameHeading a').href);
				if (first === undefined)
					return 1;
				else if (second === undefined)
					return -1;
				else
					return first.order - second.order;
			});
			for (let r of rows) {
				document.querySelector('.forum-threadlist-table tbody').appendChild(r);
			}
		}
		listed = document.querySelectorAll("h2.CategoryNameHeading a"); // need to get the newly added rows
		for (let l of listed) {
			let slug = (new URL(l.href)).pathname.replace("/categories/", "");
			if (categories.find(o => o.slug == slug)) {
				fetch(api + 'discussions/?categoryID=' + categories.find(o => o.slug == slug).id + '&sort=-dateLastComment&pinOrder=mixed')
					.then(response => {
						if (response.ok)
							return response.json();
						else
							throw new Error(response.statusText);
					})
					.then(d => {
						let unread = d.find(o => o.unread);
						if (!unread)
							l.style.fontWeight = "normal";
						// add last post to manually added rows
						let row = l.parentElement.parentElement.parentElement.parentElement;
						if (row.querySelector('.forum-threadlist-lastpost .Block').querySelector("a") == null) {
							let lastPost = new Date(d[0].dateLastComment);
							let lastPostFormatted = ("0" + lastPost.getDate()).slice(-2) + "-" + ("0" + (lastPost.getMonth() + 1)).slice(-2) + "-" + lastPost.getFullYear().toString().slice(-2) + " " + ("0" + lastPost.getHours()).slice(-2) + ":" + ("0" + lastPost.getMinutes()).slice(-2);
							row.querySelector('.forum-threadlist-lastpost .Block').innerHTML = `<a href="` + d[0].url + `#latest" class="BlockTitle LatestPostTitle" title="` + d[0].name + `">` + d[0].name + `</a>
						<div class="Meta">
							<span>in <a href="` + l.href + `">` + l.textContent + `</a></span>
						</div>
						<div class="forum-threadlist-thread-lastpost">` + lastPostFormatted + `</div>
						<div class="forum-threadlist-thread-lastposter">
							<a title="View latest post" href="` + d[0].url + `#latest">
								<div class="spritethreadbit spritethreadbit-latestpost"></div>
							</a>
							<a class="threadbit-lastposter" href="` + d[0].insertUser.url + `" title="View profile for">` + d[0].insertUser.name + `</a>
						</div>`;
						}
						l.style.transition = "opacity 750ms linear";
						l.style.opacity = "1";
					})
					.catch(e => console.log(e));
			} else {
				l.style.transition = "opacity 750ms linear";
				l.style.opacity = "1";
				l.style.fontStyle = "italic";
			}
		}
	});
}

function unboldReadDiscussions() {
	for (let t of document.querySelectorAll('.forum-threadlist-thread')) {
		if (t.querySelector('.HasNew') == null && t.querySelector('.unread') != null)
			t.querySelector('.unread').classList.remove('unread');
	}
}

function removeExternalLinkCheck() {
	for (let a of document.querySelectorAll('a[href]')) {
		try {
			let url = new URL(a.href);
			if (url.pathname.indexOf("/home/leaving") == 0 && url.hostname.indexOf('boards.ie') != -1) {
				let needle = "/home/leaving?allowTrusted=1&target=";
				a.href = decodeURIComponent(a.href.substring(a.href.indexOf(needle) + needle.length))
			}
		} catch (e) {
			console.log(e);
		}
	}
}

function innerText(string) {
	let element = document.createElement('div');
	element.innerHTML = string;
	element.querySelectorAll('div.js-embed').forEach(node => node.parentElement.removeChild(node))

	function getTextLoop(element) {
		const texts = [];
		Array.from(element.childNodes).forEach(node => {
			if (node.nodeType === 3)
				texts.push(node.textContent.trim());
			else
				texts.push(...getTextLoop(node));
		});
		return texts;
	}
	return getTextLoop(element).join(' ');
}

function userMenus() {
	for (let old of document.querySelectorAll('.userinfo-username-title')) {
		let nu = old.cloneNode(true);
		nu.classList.remove('userinfo-username-title'); // boards adds eventListener after page load
		nu.classList.add('usertitle-28064212');
		old.parentElement.replaceChild(nu, old);
		let username = nu.textContent;

		let indicator = document.createElement('span');
		indicator.classList.add('usermenu-indicator-28064212');
		nu.insertBefore(indicator, nu.firstChild);

		let menu = document.createElement('div');
		menu.classList.add('usermenu-28064212');
		menu.style.display = 'none';
		nu.parentElement.parentElement.appendChild(menu);

		let profile = document.createElement('a');
		profile.textContent = 'View profile';
		profile.href = '/profile/' + username;
		menu.appendChild(profile);

		let message = document.createElement('a');
		message.textContent = 'Message ' + username;
		message.href = 'https://www.boards.ie/messages/add/' + username;
		menu.appendChild(message);

		let history = document.createElement('a');
		history.textContent = 'View all posts';
		history.href = 'https://www.boards.ie/discussions#bes:' + encodeURIComponent(username);
		menu.appendChild(history);

		nu.addEventListener("mouseover", function (e) {
			//hide all menus, show this one
			document.querySelectorAll('.usermenu-28064212').forEach(m => m.style.display = 'none');
			menu.style.display = 'block';
		});
		menu.addEventListener("mouseleave", function (e) {
			menu.style.display = 'none';
		});
	}
}

function modsInfo(categoriesPromise) {
	if (location.pathname.startsWith("/categories/")) {
		categoriesPromise.then(categories => {
			fetch(api + 'discussions/?discussionID=2058234282')
				.then(response => {
					if (response.ok)
						return response.json();
					else
						throw new Error(response.statusText);
				})
				.then(data => {
					let catMods = {};
					const parser = new DOMParser();
					const cmodPost = parser.parseFromString(data[0].body, 'text/html');
					const catParagraphs = cmodPost.querySelectorAll('p:not(:has(*))');
					for (let p of catParagraphs) {
						let cat = p.textContent == "Region" ? "Regional" : p.textContent;
						cat = cat.replace(" and ", " & ").toLowerCase();
						let cmodLinks = p.nextElementSibling.querySelectorAll('a');
						let mods = [];
						for (let c of cmodLinks) {
							mods.push(c.dataset.username);
						}
						catMods[cat] = mods.sort();
					}
					//let mods = document.querySelectorAll('.postbit-postbody a["data-userid"]');
					let breadcrumbs = document.querySelector(".Breadcrumbs").textContent.split("› ");
					let cat = "";
					if (breadcrumbs[1].toLowerCase() == "regional")
						cat = "regional";
					else if (breadcrumbs[1].toLowerCase() == "topics")
						cat = breadcrumbs[2].toLowerCase();
					if (cat !== "") {
						let container = document.createElement("div");
						container.classList.add("mod-info-28064212");
						// let modP = document.createElement("p");
						// container.appendChild(modP);
						// modP.textContent = "Moderators: ";
						let cmodP = document.createElement("p");
						container.appendChild(cmodP);
						cmodP.textContent = "Category Moderators: ";
						if (catMods[cat].length == 0) {
							cmodP.appendChild(document.createTextNode('N/A'));
						}
						else {
							for (let c of catMods[cat]) {
								let link = document.createElement("a");
								link.href = "/profile/" + c;
								link.textContent = c;
								cmodP.appendChild(link);
								cmodP.appendChild(document.createTextNode(' | '));
							}
							cmodP.removeChild(cmodP.lastChild);
						}
						document.querySelector("section.Content.MainContent").appendChild(container);
					}
				})
				.catch(e => {
					console.log(e);
				});
		});
	}
}

function userHistory(categoriesPromise) {
	if (location.hash.indexOf('#bes:') == 0 && location.pathname == '/discussions') {
		let remove = document.querySelectorAll('.forum-threadlist-table tbody tr, .forum-threadlist-table thead, .BoxNewDiscussion, .PageControls-filters, .HomepageTitle, #PagerBefore *, #PagerAfter *');
		for (let r of remove) {
			r.parentElement.removeChild(r);
		}
		let params = location.hash.replace('#bes:', '').split(':');
		let username = decodeURIComponent(params[0]);
		let page = params[1] === undefined ? 1 : parseInt(params[1]);
		document.querySelector('.forum-threadlist-header').textContent = 'Posts by ' + username;
		document.title = 'Posts by ' + username;

		let table = document.querySelector('.forum-threadlist-table');
		table.classList.add('userhistory-28064212');

		let tbody = table.querySelector('tbody');
		let loadingRow = document.createElement('tr');
		let loadingCell = document.createElement('td');
		loadingCell.classList.add('postbit-postbody');
		loadingRow.appendChild(loadingCell);
		tbody.appendChild(loadingRow);

		let loadingText = document.createElement('p');
		loadingText.style.fontStyle = 'italic';
		loadingText.appendChild(document.createTextNode('Loading...'));
		loadingCell.appendChild(loadingText);

		// pagination
		let pagerBefore = document.querySelector('#PagerBefore');
		let pagerAfter = document.querySelector('#PagerAfter');

		let current = document.createElement('a');
		current.className = 'Pager-p p-1 FirstPage';
		current.setAttribute("aria-current", 'page');
		current.classList.add("Highlight");
		current.href = '/discussions#bes:' + encodeURIComponent(username);
		current.textContent = page;
		pagerBefore.appendChild(current);
		let currentAfter = current.cloneNode(true);
		pagerAfter.appendChild(currentAfter);

		//before current
		for (let i = (page - 1); i >= 1 && i >= (page - 5); i--) {
			let pi = document.createElement('a');
			pi.href = '/discussions#bes:' + encodeURIComponent(username) + ':' + i;
			pi.className = 'Pager-p p-' + i;
			pi.textContent = i;
			pagerBefore.insertBefore(pi, pagerBefore.firstElementChild);
			pagerAfter.insertBefore(pi.cloneNode(true), pagerAfter.firstElementChild);
		}
		//after current
		for (let i = page + 1; i <= (page + 5); i++) {
			let pi = document.createElement('a');
			pi.href = '/discussions#bes:' + encodeURIComponent(username) + ':' + i;
			pi.className = 'Pager-p p-' + i;
			pi.textContent = i;
			pagerBefore.appendChild(pi);
			pagerAfter.appendChild(pi.cloneNode(true));
		}

		let prev = document.createElement('a');
		prev.textContent = '«';
		if (page == 1) {
			prev.setAttribute("aria-disabled", true);
			prev.classList.add("Highlight");
		} else {
			prev.className = 'Previous';
			prev.href = '/discussions#bes:' + encodeURIComponent(username) + ':' + (page - 1);
		}
		pagerBefore.insertBefore(prev, pagerBefore.firstElementChild);
		pagerAfter.insertBefore(prev.cloneNode(true), pagerAfter.firstElementChild);

		let next = document.createElement('a');
		next.textContent = '»';
		next.className = 'Next';
		next.href = '/discussions#bes:' + encodeURIComponent(username) + ':' + (page + 1);
		pagerBefore.appendChild(next);
		pagerAfter.appendChild(next.cloneNode(true));

		categoriesPromise.then(categories => {
			fetch(api + 'users/by-names?name=' + username)
				.then(response => {
					if (response.ok)
						return response.json();
					else
						throw new Error(response.statusText);
				})
				.then(users => {
					let userid = users && users[0] !== undefined ? users[0].userID : null;
					if (userid) {
						fetch(api + 'search?limit=30&insertUserIDs[0]=' + userid + '&sort=-dateInserted&types[0]=discussion&types[1]=comment&types[2]=poll&types[3]=question&types[4]=idea&page=' + page)
							.then(response => {
								if (response.ok)
									return response.json();
								else
									throw new Error(response.statusText);
							})
							.then(posts => {
								if (posts.length == 0) {
									loadingRow.parentElement.removeChild(loadingRow);
									let tr = document.createElement('tr');
									let td = document.createElement('td');
									td.classList.add('postbit-postbody');
									tr.appendChild(td);
									tbody.appendChild(tr);

									let text = document.createElement('p');
									text.appendChild(document.createTextNode('[No posts found]'));
									td.appendChild(text);
								} else {
									let parentDiscussionList = [];
									let commentList = [];
									for (let p of posts) {
										parentDiscussionList.push(p.discussionID);
										if (p.type == 'comment') {
											commentList.push(p.recordID)
										}
									}
									if (commentList.length == 0)
										commentList.push(-1);
									let discussionsP = fetch(api + 'discussions/?limit=500&discussionID=' + parentDiscussionList.join(','))
										.then(response => {
											if (response.ok)
												return response.json();
											else
												throw new Error(response.statusText);
										})
										.catch(e => console.log(e));
									let commentsP = fetch(api + 'comments/?limit=500&commentID=' + commentList.join(','))
										.then(response => {
											if (response.ok)
												return response.json();
											else
												throw new Error(response.statusText);
										})
										.catch(e => console.log(e));

									Promise.all([discussionsP, commentsP])
										.then(data => {
											let charsToDisplay = 500;
											loadingRow.parentElement.removeChild(loadingRow);

											let header = document.createElement('thead');
											let headerRow = document.createElement('tr');
											let bodyHeader = document.createElement('th');
											bodyHeader.innerText = 'Post';
											let thanksHeader = document.createElement('th');
											thanksHeader.innerText = 'Thanks';
											let postedHeader = document.createElement('th');
											postedHeader.innerText = 'Posted';
											let catHeader = document.createElement('th');
											catHeader.innerText = 'Category';
											headerRow.appendChild(bodyHeader);
											headerRow.appendChild(postedHeader);
											headerRow.appendChild(catHeader);
											headerRow.appendChild(thanksHeader);
											header.appendChild(headerRow);
											table.insertBefore(header, table.firstChild);

											for (let p of posts) {
												try {
													let discussion = data[0].find(item => item.discussionID == p.discussionID);
													let comment = data[1].find(item => item.commentID == p.recordID);

													let tr = document.createElement('tr');
													tbody.appendChild(tr);

													let td = document.createElement('td');
													td.classList.add('postbit-postbody');
													tr.appendChild(td);

													let text = document.createElement('p');
													let body = p.bodyPlainText.trim();
													text.appendChild(document.createTextNode(body.substring(0, charsToDisplay - 1) + (body.length > charsToDisplay ? '...' : '')));
													td.appendChild(text);

													let meta = document.createElement('p');
													let title = document.createElement('a');
													title.classList.add("threadbit-threadlink");
													if (p.recordType == 'discussion') {
														meta.appendChild(document.createTextNode('• '));
														td.insertBefore(meta, td.firstChild);
													} else {
														meta.appendChild(document.createTextNode('in '));
														td.appendChild(meta);
													}
													if (discussion.unread)
														title.style.fontWeight = "bold";
													title.href = discussion.url;
													title.appendChild(document.createTextNode(discussion.name));
													meta.appendChild(title);

													if (discussion.countUnread) {
														let countUnread = document.createElement('span');
														countUnread.classList.add("HasNew", "NewCommentCount");
														countUnread.appendChild(document.createTextNode(discussion.countUnread + ' new'));
														meta.appendChild(document.createTextNode(' '));
														meta.appendChild(countUnread);
													}

													if (discussion.bookmarked) {
														let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
														svg.setAttribute("viewBox", "0 0 12.733 16.394");
														svg.innerHTML = '<title>Bookmark</title><path class="svgBookmark-mainPath" stroke-width="2" d="M1.05.5H11.683a.55.55,0,0,1,.55.55h0V15.341a.549.549,0,0,1-.9.426L6.714,12a.547.547,0,0,0-.7,0L1.4,15.767a.55.55,0,0,1-.9-.426V1.05A.55.55,0,0,1,1.05.5z"></path>';
														svg.style.height = "16px";
														svg.style.width = "12px";
														svg.style.float = "right";
														svg.style.marginLeft = "10px";
														svg.querySelector('path').style.stroke = "rgb(59, 85, 134)";
														svg.querySelector('path').style.fill = "rgb(59, 85, 134)";
														td.insertBefore(svg, td.lastChild);
													}

													let postedCell = document.createElement('td');
													postedCell.classList.add('postbit-postbody');
													let timestamp = document.createElement('a');
													timestamp.href = p.url.split(/[?]/)[0]; // search api returning urls with querystring that broke anchor tag
													let t = new Date(p.dateInserted);
													let tFormatted = (t.getFullYear().toString() + "-" + ("0" + (t.getMonth() + 1)).slice(-2) + "-" + ("0" + t.getDate()).slice(-2) + " " + ("0" + t.getHours()).slice(-2) + ":" + ("0" + t.getMinutes()).slice(-2));
													timestamp.appendChild(document.createTextNode(tFormatted));
													postedCell.appendChild(timestamp);
													postedCell.style.whiteSpace = "nowrap";
													tr.appendChild(postedCell);

													let catCell = document.createElement('td');
													catCell.classList.add('postbit-postbody');
													let cat = categories.find(d => d.id == p.categoryID)
													let category = document.createElement('a');
													category.appendChild(document.createTextNode(cat.name));
													category.href = cat.url;
													catCell.appendChild(category)
													tr.appendChild(catCell);

													let thanks = document.createElement('td');
													thanks.classList.add('postbit-postbody');
													tr.appendChild(thanks);
													if (p.recordType == 'discussion')
														thanks.appendChild(document.createTextNode(discussion.score == null ? "-" : discussion.score));
													else
														thanks.appendChild(document.createTextNode(comment.score == null ? "-" : comment.score));
												}
												catch (e) {
													console.log(e);
												}
											}
										});
								}
							})
							.catch(e => {
								console.log(e);
								loadingRow.parentElement.removeChild(loadingRow);
								let tr = document.createElement('tr');
								let td = document.createElement('td');
								td.classList.add('postbit-postbody');
								tr.appendChild(td);
								tbody.appendChild(tr);

								let text = document.createElement('p');
								text.appendChild(document.createTextNode('[Error searching for posts]'));
								td.appendChild(text);
							});
					} else
						loadingCell.textContent = '[User not found]';
				})
				.catch(e => {
					console.log(e);
				});
		});
	}
}

function editableQuoting() {
	for (let post of document.querySelectorAll('.ItemComment, .ItemDiscussion')) {
		let q = post.querySelector('a.Quote');
		let eq = q.cloneNode(true);
		eq.childNodes.forEach(n => {
			if (n.nodeType == 3)
				n.nodeValue = ' Quote (Editable)';
		});
		eq.classList.remove('ReactButton'); // otherwise eventListener added dynamically
		eq.classList.add('reactions-28064212');
		eq.addEventListener('click', function (e) {
			let editor = document.querySelector('.richEditor-text.userContent');
			if (editor.textContent == "")
				editor.removeChild(editor.firstElementChild);
			let blockquote = document.createElement('div');
			blockquote.classList.add('blockquote');
			let blockquoteContent = document.createElement('div');
			blockquoteContent.classList.add('blockquote-content');
			let quote = post.querySelector('.Message.userContent').cloneNode(true);
			quote.querySelectorAll('.js-embed.embedResponsive').forEach(e => {
				e.parentElement.removeChild(e);
			});
			blockquoteContent.appendChild(quote);
			blockquote.appendChild(blockquoteContent);
			editor.appendChild(blockquote);
		});
		post.querySelector('.Reactions').insertBefore(eq, q.nextElementSibling);
	}
}

function addDiscussionPreviews() {
	let links = document.querySelectorAll('a.threadbit-threadlink:not(.previewed-28064212), .tabs-container div[style="display: block;"] .threadlink-wrapper a:not(.previewed-28064212)');
	let discussions = [];
	for (let l of links) {
		let path = new URL(l.href).pathname.replace('/discussion/', '');
		let id = path.slice(0, path.indexOf('/'));
		if (id != "")
			discussions.push(id);
	}
	if (discussions.length > 0) {
		fetch(api + 'discussions/?limit=500&expand=lastPost&discussionID=' + discussions.join(','))
			.then(response => {
				if (response.ok)
					return response.json();
				else
					throw new Error(response.statusText);
			})
			.then(data => {
				for (let l of links) {
					let path = new URL(l.href).pathname.replace('/discussion/', '');
					let id = path.slice(0, path.indexOf('/'));
					let d = data.find(n => n.discussionID == id);
					if (d) {
						let preview = document.createElement("div");
						preview.classList.add("preview-28064212");
						preview.innerHTML = d.body ? d.body : "";
						preview.style.display = "none";
						let parent = null;
						let row = null;
						if (l.parentElement.classList.contains("threadlink-wrapper")) {
							parent = l.parentElement.parentElement;
							row = l.parentElement.parentElement.parentElement;
							preview.style.top = '28px';
							parent.appendChild(preview);
							preview.parentElement.title = '';
							// unbolds read discussions on homepage
							if (d.unread == false) {
								l.style.fontWeight = "normal";
							}
						} else {
							parent = l.parentElement;
							row = l.parentElement.parentElement;
							preview.style.top = '46px';
							parent.appendChild(preview);
						}
						l.addEventListener('mouseover', function (e) {
							preview.style.display = "block";
						});
						l.addEventListener('mouseout', function (e) {
							preview.style.display = "none";
						});
						l.classList.add('previewed-28064212');

						try {
							//update last post link
							let lastPostLink = row.querySelector('.forum-threadlist-lastpost a, .lastposter-wrapper a');
							lastPostLink.href = d.lastPost.url;
							// add first post column (in place of views column)
							if (l.classList.contains("threadbit-threadlink")) {
								let cell = row.lastElementChild;
								cell.className = "";
								let firstPost = new Date(d.dateInserted);
								let firstPostFormatted = ("0" + firstPost.getDate()).slice(-2) + "-" + ("0" + (firstPost.getMonth() + 1)).slice(-2) + "-" + firstPost.getFullYear().toString().slice(-2) + " " + ("0" + firstPost.getHours()).slice(-2) + ":" + ("0" + firstPost.getMinutes()).slice(-2);
								cell.innerHTML = '<div style="float:right">' +
									'<a title="View first post" href="' + d.url + '/p1"><div class="spritethreadbit spritethreadbit-latestpost"></div></a> ' +
									'<a class="threadbit-lastposter" href="' + d.insertUser.url + '">' + d.insertUser.name + '</a></div><div>' + firstPostFormatted + '</div>';
								row.removeChild(cell);
								row.insertBefore(cell, row.lastElementChild);
								let table = l.closest('table:not(firstpost-added-28064212)');
								if (table) {
									table.querySelector('th.forum-threadlist-replies').textContent = 'First post';
									//need to set a clasee, then width 17%
									table.querySelector('th.forum-threadlist-views').textContent = 'Replies';
									table.classList.add('firstpost-added-28064212');
								}

							}
						} catch (e) { console.log(e) }
					}
				}
			})
			.catch(error => console.log(error));
	}
}

function addThanksAfterPosts(post) {
	if (post !== undefined) {
		// post argument passed => thanks button was clicked
		userDetails.then(data => {
			let thankers = [];
			if (post.querySelector(".thanks-28064212")) {
				thankers = Array.from(post.querySelector(".thanks-28064212").querySelectorAll("a"));
				let me = thankers.find(m => m.textContent == data.name);
				if (me)
					thankers.splice(thankers.indexOf(me), 1);
				else {
					let link = document.createElement('a');
					link.href = "/profile/" + data.name;
					link.textContent = data.name;
					thankers.push(link);
				}
				appendThanks(post, thankers);
			}
			else {
				let link = document.createElement('a');
				link.href = "/profile/" + data.name;
				link.textContent = data.name;
				thankers.push(link);
				appendThanks(post, thankers);
			}
		});
	}
	else {
		// only called with no args on page load, will need to get and add thanks to all posts
		let posts = document.querySelectorAll('.ItemComment, .ItemDiscussion');
		for (let p of posts) {
			// add eventListener to update thanks list when button is clicked
			p.querySelector('.ReactButton-Like').addEventListener("click", function () {
				addThanksAfterPosts(p);
			});
			p.querySelector('.ReactButton-Like').classList.add("thanks-listener-28064212");
			// have to re-add eventListener each time, clicking button deletes and re-creates it, so observe the post
			let observer = new MutationObserver(function (mutationsList, observer) { thanksObserver(mutationsList, observer, p) });
			observer.observe(p, { childList: true, subtree: true });
			if (p.classList.contains('ItemDiscussion')) {
				let path = new URL(p.querySelector(".post-count a").href).pathname.replace('/discussion/', '');
				let id = path.slice(0, path.indexOf('/'));
				getThanks(p, 'discussions', id);
			}
			else {
				let id = p.id.replace('Comment_', '');
				getThanks(p, 'comments', id);
			}
		}
	}
}

function thanksObserver(mutationsList, observer, p) {
	let thanksButton = p.querySelector('.ReactButton-Like');
	if (thanksButton) {
		thanksButton.blur();
		if (!thanksButton.classList.contains('thanks-listener-28064212')) {
			thanksButton.addEventListener("click", function () {
				addThanksAfterPosts(p);
			});
			thanksButton.classList.add("thanks-listener-28064212");
		}
	}
}

function getThanks(element, type, id) {
	fetch(api + type + '/' + id + '/reactions?limit=100&type=Like')
		.then(response => {
			if (response.ok)
				return response.json();
			else
				throw new Error(response.statusText);
		})
		.then(data => {
			if (data.length > 0) {
				let links = [];
				for (let d of data) {
					let link = document.createElement('a');
					link.href = d.user.url;
					link.textContent = d.user.name;
					links.push(link);
				}
				appendThanks(element, links);
			}
		})
		.catch(error => console.log(error));
}

function appendThanks(post, linksList) {
	if (post.querySelector(".thanks-28064212"))
		post.querySelector(".thanks-28064212").remove();
	if (linksList.length > 0) {
		linksList.sort(function (a, b) {
			return a.textContent.toLowerCase().localeCompare(b.textContent.toLowerCase());
		});
		let thankscontainer = document.createElement('div');
		thankscontainer.classList.add('thanks-28064212')
		post.appendChild(thankscontainer);

		let thankscount = document.createElement('div');
		thankscount.innerText = "Thanks (" + linksList.length + ")";
		thankscontainer.appendChild(thankscount);

		let thankers = document.createElement('div');
		thankscontainer.appendChild(thankers);
		for (let l of linksList) {
			thankers.appendChild(l);
			thankers.appendChild(document.createTextNode(", "));
		}
		thankers.removeChild(thankers.lastChild);
	}
}

function highlightOP() {
	if (document.head.querySelector('meta[name="threadid"]') && document.head.querySelector('meta[name="threadid"]').getAttribute("content")) {
		fetch(api + 'discussions/' + document.head.querySelector('meta[name="threadid"]').getAttribute("content"))
			.then(response => {
				if (response.ok)
					return response.json();
				else
					throw new Error(response.statusText);
			})
			.then(data => {
				let userid = data.insertUserID;
				let posts = document.querySelectorAll("span[data-dropdown='user" + userid + "-menu']");
				for (let p of posts)
					p.parentElement.classList.add('original-poster-28064212');
			})
			.catch(error => console.log(error));
	}
}

function restoreOPAvatar() {
	if (location.pathname.startsWith("/discussion/") && document.querySelector('.Comment') && document.querySelector('.Comment').querySelector('.ProfilePhotoLarge') == null) {
		let userid = document.querySelector('.user-tools').id.replace("user", "").replace("-menu", "");
		fetch(api + 'users/' + userid)
			.then(response => {
				if (response.ok)
					return response.json();
				else
					throw new Error(response.statusText);
			})
			.then(data => {
				let link = document.createElement("a");
				link.title = data.name;
				link.href = data.url;
				link.classList.add("ProfilePhotoLarge", "PhotoWrap", "js-userCard", "js-userCardInitialized");
				link.ariaLabel = "User: " + data.name;
				link.dataset.userid = data.userID;
				link.setAttribute("aria-controls", "popupTrigger-16-content");

				let img = document.createElement("img");
				img.src = data.photoUrl;
				img.alt = data.name;
				img.dataset.fallback = "avatar";
				img.loading = "lazy";
				img.classList.add("ProfilePhoto", "ProfilePhotoMedium");

				link.appendChild(img);
				document.querySelector(".userinfo-username").appendChild(link);
			})
			.catch(error => console.log(error));
	}
}

function addBookmarkStatusToComments() {
	let commentElements = document.querySelectorAll('.Profile .Comments .Item:not(.bookmark-status-28064212)');
	let commentList = [];
	for (let c of commentElements)
		commentList.push(c.id.replace("Comment_", ""));
	if (commentList.length > 0) {
		fetch(api + 'comments/?limit=500&commentId=' + commentList.join(','))
			.then(response => {
				if (response.ok)
					return response.json();
				else
					throw new Error(response.statusText);
			})
			.then(commentData => {
				let discussionList = [];
				for (let d of commentData)
					discussionList.push(d.discussionID);
				if (discussionList.length > 0) {
					fetch(api + 'discussions/?limit=500&discussionID=' + discussionList.join(','))
						.then(response => {
							if (response.ok)
								return response.json();
							else
								throw new Error(response.statusText);
						})
						.then(discussionData => {
							for (let c of commentElements) {
								let id = c.id.replace("Comment_", "");
								let discussion = commentData.find(item => item.commentID == id).discussionID;
								let svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
								svg.setAttribute("viewBox", "0 0 12.733 16.394");
								svg.innerHTML = '<title>Bookmark</title><path class="svgBookmark-mainPath" stroke-width="2" d="M1.05.5H11.683a.55.55,0,0,1,.55.55h0V15.341a.549.549,0,0,1-.9.426L6.714,12a.547.547,0,0,0-.7,0L1.4,15.767a.55.55,0,0,1-.9-.426V1.05A.55.55,0,0,1,1.05.5z"></path>';
								svg.style.height = "16px";
								svg.style.width = "12px";
								svg.style.float = "right";
								svg.style.marginLeft = "10px";
								svg.querySelector('path').style.stroke = "rgb(59, 85, 134)";
								if (discussionData.find(item => item.discussionID == discussion).bookmarked)
									svg.querySelector('path').style.fill = "rgb(59, 85, 134)";
								else
									svg.querySelector('path').style.fill = "none";
								c.querySelector(".ItemContent").insertBefore(svg, c.querySelector(".ItemContent").firstChild);
								c.classList.add("bookmark-status-28064212");

								let score = commentData.find(item => item.commentID == id) ? commentData.find(item => item.commentID == id).score : null;
								if (score) {
									let s = document.createElement('span');
									s.className = 'MItem';
									s.style.float = "right";
									s.textContent = '(' + score + ')';
									c.querySelector('.Meta').appendChild(s);
								}
							}
						})
						.catch(error => console.log(error));;
				}
			})
			.catch(error => console.log(error));
	}
}

function addCategoryListing(categoriesPromise) {
	categoriesPromise.then(data => {
		let catLink = document.querySelector("a[href='/categories'], a[href='https://www.boards.ie/categories']");
		let categories = document.createElement("div");
		categories.id = "categories-28064212";
		categories.style.display = "none";
		categories.tabIndex = -1;
		document.body.appendChild(categories);

		let timeout = null;
		catLink.parentElement.addEventListener("mouseout", function () {
			clearTimeout(timeout);
		});
		catLink.parentElement.addEventListener("mouseover", function () {
			timeout = setTimeout(function () { categories.style.display = "block"; }, 250);
		});
		categories.addEventListener("mouseleave", function () {
			categories.style.display = "none";
			for (let i of document.querySelectorAll("#categories-header-28064212 a")) {
				i.style.backgroundColor = "";
				i.style.color = "";
			}
			for (let i of document.querySelectorAll('.categories-division-28064212 a')) {
				i.style.display = 'none';
			}
		});
		let categoriesHeader = document.createElement("div");
		categoriesHeader.id = "categories-header-28064212";
		categories.appendChild(categoriesHeader);

		let group = document.createElement("div");
		group.classList.add("categories-group-28064212");
		group.style.display = "grid";
		categories.appendChild(group);

		for (let i = 2; i < 8; i++) {
			let division = document.createElement("div");
			division.classList.add("categories-division-28064212");
			division.dataset.depth = i;
			group.appendChild(division);
		}

		// remove "followed"
		data.unshift({ "id": 0, "parent": null, "followed": false, "name": "Followed", "url": "/categories?followed=1", "slug": "followed", "depth": 1 });

		let links = data.filter(f => f.depth == 1);
		links.sort(function (a, b) {
			// Followed first, then reverse alphabetical => Topics - Talk to - Regional
			if (a.name.toLowerCase() == "followed")
				return -1;
			else if (b.name.toLowerCase() == "followed")
				return 1;
			else
				return b.name.toLowerCase().localeCompare(a.name.toLowerCase());
		});
		categoriesHeader.style.gridTemplateColumns = "1fr ".repeat(links.length).trim(); // some users have more top-level categories available
		for (let l of links) {
			let header = document.createElement("a");
			header.dataset.id = l.id;
			header.innerText = l.name;
			header.href = l.url;
			categoriesHeader.appendChild(header);

			header.addEventListener("mouseover", function () {
				//clear all divisions, populate children
				for (let i of document.querySelectorAll('.categories-division-28064212 a')) {
					if (i.dataset.parent == l.id)
						i.style.display = 'block';
					else
						i.style.display = 'none';
				}
				// style current header, reset others
				for (let i of document.querySelectorAll("#categories-header-28064212 a")) {
					i.style.backgroundColor = "";
					i.style.color = "";
				}
				header.style.backgroundColor = "rgb(59, 85, 134)";
				header.style.color = "white";
			});
		}
		links = data.filter(f => f.depth > 1);
		links.sort(function (a, b) {
			return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
		});
		for (let l of links) {
			let childLink = document.createElement('a');
			childLink.dataset.id = l.id;
			childLink.dataset.parent = l.parent;
			childLink.innerText = l.name;
			childLink.href = l.url;
			if (data.filter(c => c.parent == l.id).length > 0) {
				let arrow = document.createElement("div");
				arrow.innerText = "⇒";
				arrow.style.float = "right";
				childLink.appendChild(arrow);
			}
			document.querySelectorAll('.categories-division-28064212')[l.depth - 2].appendChild(childLink);

			childLink.addEventListener("mouseover", function () {
				for (let i = l.depth + 1; i < 8; i++) {
					// hide items from divisions greater than depth
					for (let j of document.querySelectorAll('.categories-division-28064212[data-depth="' + i + '"] a'))
						j.style.display = "none";
					// remove style from links in divisions greater than or equal to depth
					for (let j of document.querySelectorAll('.categories-division-28064212[data-depth="' + (i - 1) + '"] a')) {
						j.style.backgroundColor = "";
						j.style.color = "";
					}
				}
				childLink.style.backgroundColor = "rgb(59, 85, 134)";
				childLink.style.color = "white";
				for (let i of document.querySelectorAll('.categories-division-28064212 a[data-parent="' + l.id + '"]'))
					i.style.display = "block";
			});
		}
		links = data.filter(f => f.followed);
		links.sort(function (a, b) {
			return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
		});
		for (let l of links) {
			let childLink = document.createElement('a');
			childLink.dataset.id = l.id;
			childLink.dataset.parent = 0;
			childLink.innerText = l.name;
			childLink.href = l.url;
			document.querySelectorAll('.categories-division-28064212')[0].appendChild(childLink);
		}
	});
}

function createAlert(msg) {
	for (let a of document.querySelectorAll(".alert-28064212")) {
		a.style.opacity = 0;
	}
	let alertBox = document.querySelector(".InformMessages");
	if (alertBox == null) {
		alertBox = document.createElement("div");
		alertBox.classList.add("InformMessages");
		document.body.appendChild(alertBox);
	}
	let alert = document.createElement("div");
	alert.className = "InformWrapper Dismissable AutoDismiss alert-28064212";
	alert.innerHTML = `
<div role="alert" class="InformMessage">
<span aria-label="polite" class="InformMessageBody">
	<div class="Title">` + msg + `</div>
</span>
</div>`;
	alertBox.appendChild(alert);
}

function markCategoryRead() {
	let category = document.querySelector('meta[name=catid]').content;
	let bookmarkLink = document.querySelector('a.Bookmark').href;
	let transientKey = bookmarkLink.slice(bookmarkLink.lastIndexOf('/') + 1);
	fetch("https://www.boards.ie/category/markread?categoryid=" + category + "&tkey=" + transientKey)
		.then(createAlert("Marked read"))
		.then(d => {
			for (let u of document.querySelectorAll(".unread"))
				u.classList.remove("unread")
		});
}

function isElementInViewport(el) {
	let rect = el.getBoundingClientRect();
	return (
		rect.top >= 0 &&
		rect.left >= 0 &&
		rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
		rect.right <= (window.innerWidth || document.documentElement.clientWidth)
	);
}

function keyShortcuts(key) {
	let code = key.keyCode;
	let ctrl = key.ctrlKey;
	let alt = key.altKey;
	let shift = key.shiftKey;
	let intext = (document.activeElement.nodeName == 'TEXTAREA' || (document.activeElement.nodeName == 'INPUT' && document.activeElement.type != 'checkbox') || document.activeElement.contentEditable == "true");
	let hl = document.getElementsByClassName('highlight-28064212')[0];
	if (!intext) {
		if (ctrl && code == 32 && document.querySelector('button[title=Search]')) {
			// Ctrl + Space - searchbox
			document.querySelector('button[title=Search]').click()
		}
		else if (code == 39) {
			// → - next page, last page with shift
			if (shift && document.querySelector('.Pager a.LastPage'))
				location.href = document.querySelector('.Pager a.LastPage');
			else if (document.querySelector('.Pager a.Next') != null)
				location.href = document.querySelector('.Pager a.Next');
		}
		else if (code == 37) {
			// ← - previous page, first page with shift, parent category with ctrl
			if (shift && document.querySelector('.Pager a.FirstPage'))
				location.href = document.querySelector('.Pager a.FirstPage');
			else if (ctrl) {
				let items = document.querySelectorAll('.Breadcrumbs a');
				if (items.length > 0) {
					if (location.href != items[items.length - 1].href)
						location.href = items[items.length - 1];
					else if (items.length > 1)
						location.href = items[items.length - 2];
				}
			}
			else if (document.querySelector('.Pager a.Previous'))
				location.href = document.querySelector('.Pager a.Previous');
		}
		else if (code == 65 || code == 90) {
			// a/z - navigate categories/discussions
			let list = document.querySelectorAll('.forum-threadlist-table > tbody > tr, .tabs-container div[style="display: block;"] .module-wrapper tbody tr, .ItemComment, .ItemDiscussion, .Profile .DataList .Item');
			if (list.length > 0) {
				if (hl) {
					hl.classList.remove('highlight-28064212');
					if (hl.querySelector(".preview-28064212"))
						hl.querySelector(".preview-28064212").style.display = "none";
				}
				if (hl && !isElementInViewport(hl))
					index = -1;
				if (ctrl) {
					key.preventDefault();
					index = code == 65 ? 0 : list.length - 1;
				}
				if (index == -1) {
					if (code == 65) {
						for (let j = list.length - 1; j > 0 && index == -1; j--) {
							if (isElementInViewport(list[j]))
								index = j;
						}
						if (index == -1)
							index = list.length - 1;
					}
					else if (code == 90) {
						for (let j = 0; j < list.length && index == -1; j++) {
							if (isElementInViewport(list[j]))
								index = j;
						}
						if (index == -1)
							index = 0;
					}
				}
				else if (code == 65 && index > 0) {
					index--;
				}
				else if (code == 90 && index < list.length - 1) {
					index++;
				}
				hl = list[index];
				hl.classList.add('highlight-28064212');
				if (showpreviews && hl.querySelector(".preview-28064212"))
					hl.querySelector(".preview-28064212").style.display = "block";
				if (!isElementInViewport(hl))
					hl.scrollIntoView(code == 90);
			}
		}
		else if (!ctrl && code == 67) {
			// c - display category menu
			window.scrollTo(0, 0);
			document.querySelector("a[href='/categories'], a[href='https://www.boards.ie/categories']").parentElement.dispatchEvent(new Event('mouseover'));
			document.querySelector("#categories-28064212").focus();
		}
		else if (!ctrl && code == 70) {
			// f - follow/unfollow
			if (document.querySelector('a.Bookmark') && location.pathname.startsWith('/discussion/')) {
				if (document.querySelector('a.Bookmarked'))
					createAlert("Discussion bookmark removed");
				else
					createAlert("Discussion bookmarked");
				document.querySelector('a.Bookmark').click();
			}
			else if (location.pathname.startsWith('/categories/') && document.querySelector('meta[name=catid]')) {
				let category = document.querySelector('meta[name=catid]').content;
				userDetails.then(data => {
					let user = data.userID;
					fetch(api + "categories/" + category + "/preferences/" + user)
						.then(response => {
							if (response.ok)
								return response.json();
							else
								throw new Error(response.statusText);
						})
						.then(data => {
							let toggle = !data["preferences.followed"];
							fetch(api + "categories/" + category + "/preferences/" + user, {
								method: "PATCH",
								body: JSON.stringify({ "preferences.followed": toggle }),
								headers: { "Content-type": "application/json; charset=UTF-8" }
							})
								.then(response => {
									if (response.ok) {
										createAlert(toggle ? "Category followed" : "Category unfollowed");
										return response.json();
									} else
										throw new Error(response.statusText);
								})
								.catch(e => console.log(e));
						})
						.catch(e => console.log(e));
				});
			}
		}
		else if (!ctrl && code == 76 && document.querySelector('#latest')) {
			// l - scroll to latest
			document.querySelector('#latest').scrollIntoView();
		}
		else if (!ctrl && code == 77) {
			// m - Mark category read
			if (location.pathname.startsWith('/categories/') && document.querySelector('meta[name=catid]'))
				markCategoryRead();
		}
		else if (!ctrl && code == 79) {
			// o - open all unread discussions
			let discussions = document.querySelectorAll('.forum-threadlist-thread');
			for (let d of discussions) {
				if (d.querySelector('.HasNew'))
					window.open(d.querySelector('a.threadbit-threadlink'));
			}
		}
		else if (!ctrl && code == 80 && hl && hl.getElementsByClassName('customspamlink').length > 0) {
			// p - Report spammer (if https://github.com/28064212/greasemonkey-scripts/raw/master/Boards.ie%20-%20Quick%20Spam%20Reporting.user.js also installed)
			window.open(hl.getElementsByClassName('customspamlink')[0]);
		}
		else if (code == 81 && hl) {
			// q - open discussion/category or quote highlighted post
			if (ctrl && hl.querySelector('.MiniPager') && hl.querySelector('.MiniPager').querySelector('a:first-of-type')) {
				// first page
				window.open(hl.querySelector('.MiniPager').querySelector('a:first-of-type'));
			}
			else if (alt && hl.querySelector('.MiniPager') && hl.querySelector('.MiniPager').querySelector('a:last-of-type')) {
				// last page
				window.open(hl.querySelector('.MiniPager').querySelector('a:last-of-type'));
			}
			else if (hl.querySelector('.oplink-wrapper a, a.threadbit-threadlink')) {
				// last unread post
				window.open(hl.querySelector('.oplink-wrapper a, a.threadbit-threadlink'));
			}
			else if (hl.querySelector('a.Quote')) {
				// quote highlighted post
				hl.querySelector('a.Quote').click();
				key.preventDefault();
			}
		}
		else if (!ctrl && code == 82) {
			// r - reply to discussion/post new discussion
			if (document.querySelector('#vanilla-editor-focus-context')) {
				key.preventDefault();
				document.querySelector('#vanilla-editor-focus-context').firstElementChild.focus();
				document.querySelector('#vanilla-editor-focus-context').firstElementChild.scrollIntoView();
			}
			else if (document.querySelector(".BoxNewDiscussion a"))
				document.querySelector(".BoxNewDiscussion a").click();
		}
		else if (!ctrl && code == 83) {
			// s - show/hide settings
			settingsModal();
		}
		else if (!ctrl && code == 84 && hl && hl.querySelector('.ReactButton-Like')) {
			// t - toggle thanks of highlighted post
			hl.querySelector('.ReactButton-Like').click();
		}
		else if (!ctrl && code == 88) {
			// x - toggle previews display
			showpreviews = !showpreviews;
			if (hl.querySelector(".preview-28064212"))
				hl.querySelector(".preview-28064212").style.display = showpreviews ? "block" : "none";
		}
		else if (!ctrl && hl && code >= 48 && code <= 57) {
			// 0-9: open links
			code = code == 48 ? 10 : code - 49;
			if (hl.querySelectorAll('.postbit-postbody a:not(.ReactButton)').length > 0 && hl.querySelectorAll('.postbit-postbody a:not(.ReactButton)')[code])
				window.open(hl.querySelectorAll('.postbit-postbody a:not(.ReactButton)')[code]);
		}
		else if (!ctrl && code == 27) {
			// esc - close settings/documentation
			if (document.querySelector('#settings-28064212'))
				document.querySelector('#settings-28064212').style.display = "none";
			if (document.querySelector('#docs-28064212'))
				document.querySelector('#docs-28064212').style.display = "none";
		}
		else if (shift && code == 191) {
			// ? - show/hide documentation
			docsModal();
		}
	}
}