window.LOGSEQ_SAVE_SCROLLBAR_POSITION =
  window.LOGSEQ_SAVE_SCROLLBAR_POSITION || {};

function getMainBox() {
  // 需要使用 top.document，否则只能获取沙盒中的 html 元素，无法获取 logseq 中的元素：https://github.com/vipzhicheng/logseq-plugin-vim-shortcuts/blob/c6d9defef82701a61d7b4f128e3fbdc62ca34411/src/stores/search.ts#L146
  // console.log("body", top.document.body);
  return top.document.getElementById("main-content-container");
}

function getLsBlocks() {
  return top.document.querySelectorAll(".content .ls-block");
}

function getDashboardCards() {
  return top.document.querySelectorAll(".dashboard-create-card ~ div");
}

function getPageEntries() {
  return top.document.querySelectorAll(".cp__all_pages_table td.name");
}

function getPageType() {
  return top.document.body.dataset.page;
  // Journals->home                 mainBox > lsBlocks
  // Page->page                     mainBox > lsBlocks
  // Whiteboards->whiteboards       mainBox > dashboardCards
  // All pages->all-pages           mainBox > pageEntries
  // -------------------------------------------------------------
  // Whiteboard->whiteboard         no scrollbar
  // Graph view->graph              no scrollbar
}

function scrollPageReady(callback) {
  // when scrollPage is ready, callback will be called, can get mainBox and lsBlocks/dashboardCards/pageEntries
  const pageType = getPageType();
  let getContTimer = null;
  let endTimer = null;

  const getPageContent = function (method) {
    const len = method().length;
    // console.log("get PageContent:", method.name, len);

    if (len) {
      clearInterval(getContTimer);
      clearTimeout(endTimer);
      callback();
    }
  };

  getContTimer = setInterval(() => {
    if (pageType === "home" || pageType === "page") {
      getPageContent(getLsBlocks);
    } else if (pageType === "whiteboards") {
      getPageContent(getDashboardCards);
    } else if (pageType === "all-pages") {
      getPageContent(getPageEntries);
    }
  }, 10);

  endTimer = setTimeout(() => {
    clearInterval(getContTimer);
  }, 3000);
}

function debounce(func, wait, immediate = false) {
  let timer, result;
  return function () {
    const context = this;
    const args = arguments;
    const laterFn = function () {
      timer = null;
      if (!immediate) {
        result = func.apply(context, args);
      }
    };
    const callNow = immediate && !timer;

    clearTimeout(timer);
    timer = setTimeout(laterFn, wait);
    if (callNow) {
      result = func.apply(context, args);
    }
    return result;
  };
}

// onRouteChanged->handleRouteChange->recoveryScrollPosition->scrollToBlockInPage->onRouteChanged : infinite loop
// logseq.Editor.scrollToBlockInPage(
//   "6469cd04-e0fe-4250-8975-bce065209bd0",
//   "6469cd04-0bc1-46fa-bb9c-d3680470f0aa"
// );
function getFirstVisibleBlockId() {
  const mainBox = getMainBox();
  const mainRect = mainBox.getBoundingClientRect();
  const lsBlocks = mainBox.getElementsByClassName("ls-block");
  // console.log("mainRect", mainRect);

  let blockId = "";

  for (let i = 0; i < lsBlocks.length; i++) {
    const lsBlock = lsBlocks[i];
    const rect = lsBlock.getBoundingClientRect();
    const lsBlockChilds = lsBlock.getElementsByClassName("ls-block");

    if (rect.bottom >= mainRect.top && lsBlockChilds.length === 0) {
      blockId = lsBlock.getAttribute("blockid");
      // console.log(lsBlock, blockId);
      break;
    }
  }
  return blockId;
}

async function getPageId() {
  const currentGraph = await logseq.Editor.getCurrentGraph();
  const currentPage = await logseq.Editor.getCurrentPage();
  const pageType = getPageType();
  // console.log("currentGraph", currentGraph);
  // console.log("currentPage", currentPage);
  // console.log("pageType", pageType);

  if (
    pageType === "home" ||
    pageType === "all-pages" ||
    pageType === "whiteboards"
  ) {
    return `${currentGraph.name}/${pageType}`;
  } else if (pageType === "page") {
    return `${currentGraph.name}/${currentPage.uuid}`;
  }
  return "";
}

const saveScrollPosition = debounce(async function () {
  // console.log("---scrollPage is ready, save ScrollPosition");

  const mainBox = getMainBox();
  const pageId = await getPageId();

  window.LOGSEQ_SAVE_SCROLLBAR_POSITION[pageId] = mainBox.scrollTop;

  // console.log(
  //   "---ROAM_SAVE_SCROLLBAR_POSITION data",
  //   window.LOGSEQ_SAVE_SCROLLBAR_POSITION
  // );
}, 500);

function initScrollEvent() {
  // console.log("---scrollPage is ready, init ScrollEvent");
  setTimeout(() => {
    const mainBox = getMainBox();
    mainBox.removeEventListener("scroll", saveScrollPosition);
    mainBox.addEventListener("scroll", saveScrollPosition);
  }, 10);
}

async function recoveryScrollPosition() {
  // console.log("---scrollPage is ready, recovery ScrollPosition");
  const mainBox = getMainBox();
  const targetNum = window.LOGSEQ_SAVE_SCROLLBAR_POSITION[await getPageId()];

  if (!targetNum) {
    initScrollEvent();
    return;
  }

  const step = 200;
  const timer = setInterval(() => {
    if (mainBox.scrollTop + step < targetNum) {
      mainBox.scrollTop += step;
    } else {
      clearInterval(timer);
      mainBox.scrollTop = targetNum;
      initScrollEvent();
    }
  }, 10);
}
let lastPageType = "";
async function handleRouteChange(route) {
  // console.log("---------route change---------");

  // 和 all-pages、whiteboards 行为保持一致
  const curPageType = getPageType();
  if (lastPageType === "home" && curPageType === "home") {
    window.LOGSEQ_SAVE_SCROLLBAR_POSITION[await getPageId()] = 0;
  }
  lastPageType = curPageType;

  scrollPageReady(function () {
    // console.log("---scrollPage Ready---", getPageType());
    recoveryScrollPosition();
  });
}

/**
 * user model
 */
const model = {
  backToTop(e) {
    getMainBox().scrollTop = 0;
  },
};

/**
 * entry
 */
function main() {
  // console.log("ROAM_SAVE_SCROLLBAR_POSITION ready");
  // logseq.App.showMsg("❤️ Message from Hello World Plugin :)");
  logseq.App.onRouteChanged(handleRouteChange);

  // getMainBox().addEventListener("scroll", saveScrollPosition);
  scrollPageReady(function () {
    // console.log("---scrollPage Ready---first", getPageType());
    initScrollEvent();
  });

  // external btns：https://github.com/xyhp915/logseq-journals-calendar/blob/8f2385cec8db180c4af06e757d25d790b7c0bebd/src/main.js#L124
  logseq.provideModel(model);
  logseq.App.registerUIItem("toolbar", {
    key: "back-to-top",
    template: `
      <a class="button" id="back-to-top-button" data-on-click="backToTop">
        <svg 
          style="width: 20px; height: 20px;"

          xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-square-rounded-arrow-up" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"
        >
          <path stroke="none" d="M0 0h20v20H0z" fill="none"></path>
          <path d="M16 12l-4 -4l-4 4"></path>
          <path d="M12 16v-8"></path>
          <path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9 -9 9s-9 -1.8 -9 -9s1.8 -9 9 -9z"></path>
        </svg>
      </a>
    `,
  });
}

function handleUnload() {
  // console.log("ROAM_SAVE_SCROLLBAR_POSITION onunload");

  getMainBox().removeEventListener("scroll", saveScrollPosition);
}

// bootstrap
logseq.ready(main).catch(console.error);

logseq.beforeunload(handleUnload);
