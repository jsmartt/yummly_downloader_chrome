var s = document.createElement('script');
s.src = chrome.runtime.getURL('injected.js');
s.onload = function() {
  this.remove();
};
(document.head || document.documentElement).appendChild(s);

var collection = {
  id: null,
  name: null,
  description: null,
  totalCount: null,
  feed: [],
  items: []
}
var scrollToBottomInterval = null

function reset() {
  console.debug('Resetting collection data');
  collection.id = null;
  collection.name = null;
  collection.description = null;
  collection.totalCount = null;
  collection.details = {};
  collection.items = [];
  if (scrollToBottomInterval) clearInterval(scrollToBottomInterval);
}

function addItems(rawData) {
  console.debug('Adding items from collection API response');
  let data = {};
  try {
    data = JSON.parse(rawData);
  } catch (err) {
    console.error(`Failed to parse response as json: ${err}`);
  }
  console.log(data)
  if (collection.id && collection.id != data.id) {
    reset();
  }
  if (!collection.id) {
    collection.id = data.id;
    collection.name = data.name;
    collection.description = data.description;
    collection.totalCount = data.totalCount;
  }

  // Remove some unnecessary data to keep the file size a bit smaller
  data.feed.forEach((feed) => {
    if (feed.seo) {
      delete feed.seo.spotlightSearch;
      delete feed.seo.firebase;
    }
    if (feed.content) {
      delete feed.content.moreContent;
      delete feed.content.tagsAds;
      delete feed.content.relatedContent;
      delete feed.content.relatedProducts;
    }
    if (feed.display) {
      delete feed.display.profiles;
    }
  });
  collection.feed.push(...data.feed);
  collection.items.push(...data.items);
  console.debug(`Feed length: ${data.feed.length}. Items length: ${data.items.length}`);
  console.debug(
    `Added ${data.items.length} items to the ${collection.id} collection. ` +
    `${collection.items.length} of ${collection.totalCount} loaded.`
  );
}

document.addEventListener('yummlyCollectionAPIResponse', function (e) {
  console.debug('Received event:', e);
  var data = e.detail;
  addItems(e.detail);
});

function loadingIsComplete() {
  if (collection.totalCount == null) return false
  if (collection.items.length < collection.totalCount) return false
  return true
}

function scrollToBottom() {
  if (scrollToBottomInterval) clearInterval(scrollToBottomInterval);
  scrollToBottomInterval = setInterval(function() {
    if (loadingIsComplete()) {
      console.debug('Loading is complete!');
      clearInterval(scrollToBottomInterval);
      saveCollectionFile();
    } else {
      console.debug('Scrolling to bottom and waiting for additional pages to load');
      var elem = document.querySelector("#mainApp > .App > .app-content .collection > .collection-recipe-card-grid");
      if (elem) {
        elem.scrollTo({ top: elem.scrollHeight, behavior: "smooth" });
      } else {
        console.error('Failed to scroll to bottom: element not found');
      }
    }
  }, 400); // check every 400ms
}

function saveCollectionFile() {
  console.debug('Saving collection file');
  const content = JSON.stringify(collection);
  const blob = new Blob([content], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `yummly-collection-${collection.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function addDownloadButtonAfter(element) {
  var button = document.createElement("button");
  button.innerText = "Download Collection";
  button['id'] = 'downloadCollectionButton';
  button.style.position = "absolute";
  button.style.top = "auto";
  button.style.bottom = "24px";
  button.style.left = "24px";
  button.style.right = "auto";
  button.style.zIndex = "6";
  button.style.cursor = "pointer";

  button.onclick = scrollToBottom;

  const parent = element.parentElement;
  parent.insertBefore(button, element.nextSibling);
}

var waitForDomElements = setInterval(function() {
  var button = document.querySelector("#mainApp > .App > .app-content .collection-banner > #downloadCollectionButton");
  var background = document.querySelector("#mainApp > .App > .app-content .collection-banner > .collection-background");
  if (background && !button) {
    addDownloadButtonAfter(background);
  }
}, 400); // check every 400ms
