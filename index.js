window.LOGSEQ_SAVE_SCROLLBAR_POSITION =
  window.LOGSEQ_SAVE_SCROLLBAR_POSITION || {};

function getTopbar() {
  // 需要使用 top，否则只能获取沙盒中的 html 元素，无法获取 logseq 中的元素
  // github.com/vipzhicheng/logseq-plugin-vim-shortcuts/blob/c6d9defef82701a61d7b4f128e3fbdc62ca34411/src/stores/search.ts
  // console.log("body", top.document.body);
  return top.document.querySelector(".toolbar-dots-btn");
}

function debounce(func, wait, immediate = false) {
  var timer, result;
  return function () {
    var context = this;
    var args = arguments;
    var laterFn = function () {
      timer = null;
      if (!immediate) {
        result = func.apply(context, args);
      }
    };
    var callNow = immediate && !timer;

    clearTimeout(timer);
    timer = setTimeout(laterFn, wait);
    if (callNow) {
      result = func.apply(context, args);
    }
    return result;
  };
}

// onRouteChanged->handleUrlChange->recoveryScrollPosition->scrollToBlockInPage->onRouteChanged
// logseq.Editor.scrollToBlockInPage(
//   "6469cd04-e0fe-4250-8975-bce065209bd0",
//   "6469cd04-0bc1-46fa-bb9c-d3680470f0aa"
// );
function getFirstVisibleBlockId() {
  var mainBox = getMainBox();
  var mainRect = mainBox.getBoundingClientRect();
  var lsBlocks = mainBox.getElementsByClassName("ls-block");
  // console.log("mainRect", mainRect);

  var blockId = "";

  for (var i = 0; i < lsBlocks.length; i++) {
    var lsBlock = lsBlocks[i];
    var rect = lsBlock.getBoundingClientRect();
    var lsBlockChilds = lsBlock.getElementsByClassName("ls-block");

    if (rect.bottom >= mainRect.top && lsBlockChilds.length === 0) {
      blockId = lsBlock?.getAttribute("blockid");
      // console.log(lsBlock, blockId);
      break;
    }
  }
  return blockId;
}

async function getPageId() {
  var currentPage = await logseq.Editor.getCurrentPage();
  // console.log("currentPage", currentPage);

  if (top.document.body.dataset.page === "home") {
    return "home";
  } else if (top.document.body.dataset.page === "page") {
    return currentPage?.uuid;
  }
  return "";
}

function getMainBox() {
  return top.document.getElementById("main-content-container");
}

var saveScrollPosition = debounce(async function () {
  // console.log("ROAM_SAVE_SCROLLBAR_POSITION save ScrollPosition");

  var mainBox = getMainBox();
  var pageId = await getPageId();

  if (
    !mainBox ||
    ["/whiteboards", "/graph", "/all-pages"].some((item) => {
      return top.location.href.includes(item);
    })
  ) {
    return;
  }

  window.LOGSEQ_SAVE_SCROLLBAR_POSITION[pageId] = mainBox.scrollTop;

  console.log(
    "ROAM_SAVE_SCROLLBAR_POSITION data",
    window.LOGSEQ_SAVE_SCROLLBAR_POSITION
  );
}, 500);

function initScrollEvent(time) {
  setTimeout(() => {
    var mainBox = getMainBox();
    mainBox.removeEventListener("scroll", saveScrollPosition);
    mainBox.addEventListener("scroll", saveScrollPosition);
  }, time);
}

async function recoveryScrollPosition() {
  var mainBox = getMainBox();
  var targetNum = window.LOGSEQ_SAVE_SCROLLBAR_POSITION[await getPageId()];

  if (!targetNum) {
    initScrollEvent(0);
    return;
  }

  var step = 200;
  var timer = setInterval(() => {
    if (mainBox.scrollTop + step < targetNum) {
      mainBox.scrollTop += step;
    } else {
      mainBox.scrollTop = targetNum;
      clearInterval(timer);
      initScrollEvent(0);
    }
  }, 10);
}

async function handleUrlChange() {
  //   console.log(
  //     "LOGSEQ_SAVE_SCROLLBAR_POSITION onRouteChanged",
  //     await getPageId()
  //   );

  var contentsLen = top.document.querySelectorAll(".content .ls-block")?.length;
  if (contentsLen) {
    recoveryScrollPosition();
  }
}

function handleDbclickTopbar() {
  getMainBox().scrollTop = 0;
}

/**
 * entry
 */

function main() {
  // console.log("ROAM_SAVE_SCROLLBAR_POSITION ready");
  // logseq.App.showMsg("❤️ Message from Hello World Plugin :)");
  logseq.App.onRouteChanged(handleUrlChange);

  // getMainBox().addEventListener("scroll", saveScrollPosition);
  initScrollEvent(1000);

  getTopbar().addEventListener("dblclick", handleDbclickTopbar);
}

function handleUnload() {
  // console.log("ROAM_SAVE_SCROLLBAR_POSITION onunload");

  getMainBox().removeEventListener("scroll", saveScrollPosition);

  getTopbar().removeEventListener("dblclick", handleDbclickTopbar);
}

// bootstrap
logseq.ready(main).catch(console.error);

logseq.beforeunload(handleUnload);
