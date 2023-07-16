window.LOGSEQ_SAVE_SCROLLBAR_POSITION =
  window.LOGSEQ_SAVE_SCROLLBAR_POSITION || {};

let curMainBox = null;
let curMainRect = null;
let curPageType = "";
let lastGraphName = "";
let lastPageType = "";
let curPageId = "";

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
  // console.log(
  //   "---scroll Page Ready function",
  //   window.LOGSEQ_SAVE_SCROLLBAR_POSITION
  // );

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
    if (curPageType === "home" || curPageType === "page") {
      getPageContent(getLsBlocks);
    } else if (curPageType === "whiteboards") {
      getPageContent(getDashboardCards);
    } else if (curPageType === "all-pages") {
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

// 1. onRouteChanged->handleRouteChange->recoveryScrollPosition->scrollToBlockInPage->onRouteChanged : infinite loop
// 2. scrollToBlockInPage 滚动到较远的位置失败
// logseq.Editor.scrollToBlockInPage(
//   "6469cd04-e0fe-4250-8975-bce065209bd0",
//   "6469cd04-0bc1-46fa-bb9c-d3680470f0aa"
// );
function getFirstVisibleBlockId() {
  const lsBlocks = curMainBox.getElementsByClassName("ls-block");
  // console.log("curMainRect", curMainRect);

  let blockId = "";

  for (let i = 0; i < lsBlocks.length; i++) {
    const lsBlock = lsBlocks[i];
    const rect = lsBlock.getBoundingClientRect();
    const lsBlockChilds = lsBlock.getElementsByClassName("ls-block");

    if (rect.top >= curMainRect.top) {
      blockId = lsBlock.getAttribute("blockid");
      // console.log(lsBlock, blockId);
      break;
    }
  }
  return blockId;
}

function firstLoadingElementIsVisible() {
  const firstLoadingElement = curMainBox.querySelectorAll(
    ".lazy-visibility .shadow.fade-in"
  )[0];

  // console.log("firstLoadingElement", firstLoadingElement);

  if (!firstLoadingElement) return false;
  return checkElementIsVisible(firstLoadingElement);
}

function checkElementIsVisible(element) {
  const rect = element.getBoundingClientRect();
  return rect.top >= curMainRect.top && rect.top <= curMainRect.bottom;
}

function checkElementPassViewBottom(element) {
  const rect = element.getBoundingClientRect();
  return rect.top <= curMainRect.bottom;
}

async function getCurGraphName() {
  const currentGraph = await logseq.Editor.getCurrentGraph();
  return currentGraph.name;
}

async function getPageId() {
  const curGraphName = await getCurGraphName();
  const currentPage = await logseq.Editor.getCurrentPage();
  const pageType = getPageType();
  // console.log("curGraphName", curGraphName);
  // console.log("currentPage", currentPage);
  // console.log("pageType", pageType);

  if (
    pageType === "home" ||
    pageType === "all-pages" ||
    pageType === "whiteboards"
  ) {
    return `${curGraphName}/${pageType}`;
  } else if (pageType === "page") {
    return `${curGraphName}/${currentPage.uuid}`;
  }
  return "";
}

const saveScrollPosition = debounce(async function () {
  // console.log(
  //   "---scrollPage is ready, save ScrollPosition",
  //   window.LOGSEQ_SAVE_SCROLLBAR_POSITION
  // );

  window.LOGSEQ_SAVE_SCROLLBAR_POSITION[curPageId] = curMainBox.scrollTop;

  // console.log(
  //   "---LOGSEQ_SAVE_SCROLLBAR_POSITION_PLUGIN data",
  //   window.LOGSEQ_SAVE_SCROLLBAR_POSITION
  // );
}, 500);

function initScrollEvent() {
  // console.log(
  //   "---scrollPage is ready, init ScrollEvent",
  //   window.LOGSEQ_SAVE_SCROLLBAR_POSITION
  // );

  setTimeout(() => {
    curMainBox.removeEventListener("scroll", saveScrollPosition);
    curMainBox.addEventListener("scroll", saveScrollPosition); // ---
  }, 10);
}

function recoveryScrollPosition() {
  // console.log(
  //   "---scrollPage is ready, recovery ScrollPosition",
  //   window.LOGSEQ_SAVE_SCROLLBAR_POSITION
  // );

  const targetNum = window.LOGSEQ_SAVE_SCROLLBAR_POSITION[curPageId];

  if (!targetNum) {
    initScrollEvent();
    return;
  }

  const now = Date.now();
  const step = 400;

  let scrollTimer = null;
  let loadingTimer = null;

  startTimer();
  function startTimer() {
    scrollTimer = setInterval(() => {
      // console.log("scrollTimer function");

      if (curMainBox.scrollTop + step < targetNum) {
        if (firstLoadingElementIsVisible()) {
          // console.log(
          //   "firstLoadingElementIsVisible",
          //   firstLoadingElementIsVisible()
          // );
          clearInterval(scrollTimer);

          loadingTimer = setInterval(() => {
            // console.log("loadingTimer function");
            if (!firstLoadingElementIsVisible()) {
              clearInterval(loadingTimer);
              startTimer();
            }
          }, 0);
        } else {
          curMainBox.scrollTop += step;
        }
      } else {
        clearInterval(scrollTimer);
        curMainBox.scrollTop = targetNum;

        setTimeout(() => {
          curMainBox.scrollTop = targetNum;
          initScrollEvent();
          console.log("scroll To Target 1 time", (Date.now() - now) / 1000);
        }, 10);
      }
    }, 10);
  }

  // Whiteboards error
  // const now = Date.now();
  // const step = 200;
  // let animationFrameId;
  // function scrollToTarget() {
  //   if (mainBox.scrollTop + step < targetNum) {
  //     mainBox.scrollTop += step;
  //     animationFrameId = requestAnimationFrame(scrollToTarget);
  //   } else {
  //     cancelAnimationFrame(animationFrameId);
  //     mainBox.scrollTop = targetNum;
  //     initScrollEvent();
  //
  //     console.log("scroll To Target 2 time", (Date.now() - now) / 1000);
  //   }
  // }
  // scrollToTarget();
}

async function handleRouteChange(route) {
  // console.log(
  //   "---------route change---------",
  //   window.LOGSEQ_SAVE_SCROLLBAR_POSITION
  // );

  curPageId = await getPageId();
  // 【在同一个 graph 中的 Journals 页面中】点击 Journals 按钮，使其和在 All pages、Whiteboards 中的行为保持一致
  const curGraphName = await getCurGraphName();
  curPageType = getPageType();

  // console.log("curPageId", curPageId);
  // console.log("curGraphName", curGraphName);
  // console.log("curPageType", curPageType);

  if (
    curGraphName === lastGraphName &&
    lastPageType === "home" &&
    curPageType === "home"
  ) {
    window.LOGSEQ_SAVE_SCROLLBAR_POSITION[curPageId] = 0;
  }
  lastGraphName = curGraphName;
  lastPageType = curPageType;

  scrollPageReady(async function () {
    curMainBox = getMainBox();
    curMainRect = curMainBox.getBoundingClientRect();

    // console.log("---scrollPage Ready---", curPageType);

    recoveryScrollPosition();
  });
}

function handleUnload() {
  console.log("LOGSEQ_SAVE_SCROLLBAR_POSITION_PLUGIN unload");
  getMainBox().removeEventListener("scroll", saveScrollPosition);
}

// logseq.Editor.getBlock 可传 id(number) 或 uuid(string)
async function setParentExpand(curBlockObj) {
  // console.log("curBlockObj", curBlockObj);
  const parentId = curBlockObj?.parent?.id;

  if (parentId) {
    // 获取父级
    const parent = await logseq.Editor.getBlock(parentId);
    // console.log("parent", parent);

    if (parent === null) {
      // 当前已经是最顶层父级
      return curBlockObj.uuid;
    }

    if (parent?.["collapsed?"] === true) {
      await logseq.Editor.setBlockCollapsed(parent.uuid, false);
    }

    return await setParentExpand(parent);
  }
}

/**
 * user model
 */
const model = {
  backToTop() {
    getMainBox().scrollTop = 0;
  },
  async goToAnchorTarget(e) {
    const currentBlockId = e?.dataset?.currentBlockId;
    const targetBlockId = e?.dataset?.targetBlockId;

    const currentBlockObj = await logseq.Editor.getBlock(currentBlockId);
    const targetBlockObj = await logseq.Editor.getBlock(targetBlockId);

    const pageObjOfCurrentBlock = await logseq.Editor.getPage(
      currentBlockObj.page.id
    );
    const pageObjOfTargetBlock = await logseq.Editor.getPage(
      targetBlockObj.page.id
    );

    // console.log("pageObjOfCurrentBlock", pageObjOfCurrentBlock);
    // console.log("pageObjOfTargetBlock", pageObjOfTargetBlock);
    if (pageObjOfTargetBlock.uuid !== pageObjOfCurrentBlock.uuid) {
      logseq.App.showMsg("Target block is not on the current page.");
      console.log("目标块和当前块不在同一个页面，targetElement 将为 null");

      // 进入目标页面
      // logseq.App.pushState("page", {
      //   name: pageObjOfTargetBlock.name,
      // });

      return;
    }

    // 展开所有父级
    // const topParentId = await setParentExpand(targetBlockObj);
    // console.log("topParentId", topParentId);
    await setParentExpand(targetBlockObj);

    await scrollTargetBlockIntoView(currentBlockObj, targetBlockObj);
  },
};

async function scrollTargetBlockIntoView(currentBlockObj, targetBlockObj) {
  // console.log(
  //   "currentBlockObj, targetBlockObj",
  //   currentBlockObj,
  //   targetBlockObj
  // );

  const pageObjOfCurrentBlock = await logseq.Editor.getPage(
    currentBlockObj.page.id
  );

  // console.log("pageObjOfCurrentBlock", pageObjOfCurrentBlock);

  const curPageBlocksTree = await logseq.Editor.getPageBlocksTree(
    pageObjOfCurrentBlock.uuid
  );
  // console.log("curPageBlocksTree", curPageBlocksTree);

  let targetIsBottom = "";
  function findBlock(curPageBlocksTree) {
    for (const block of curPageBlocksTree) {
      if (targetIsBottom === "") {
        if (block.uuid === currentBlockObj.uuid) {
          targetIsBottom = true;
          break;
        } else if (block.uuid === targetBlockObj.uuid) {
          targetIsBottom = false;
          break;
        } else if (block.children.length > 0) {
          findBlock(block.children);
        }
      } else {
        break;
      }
    }
  }
  findBlock(curPageBlocksTree);

  // console.log("targetIsBottom", targetIsBottom);
  if (targetIsBottom === false) {
    scrollLoadedBlockIntoView(targetBlockObj.uuid);
  } else if (targetIsBottom === true) {
    scrollUnloadedBlockIntoView(targetBlockObj.uuid);
  }
}

function getBlockElement(blockId) {
  // console.log(`document.querySelector("div>#block-content-${blockId}")`);

  // 排除 block reference：`span.block-ref>#block-content-${targetBlockId}`
  return curMainBox.querySelector(`div>#block-content-${blockId}`);
}

function setElementHighlight(element) {
  const oldBackgroundColor = element.style.backgroundColor;
  element.style.backgroundColor = "#ddd";
  setTimeout(() => {
    element.style.backgroundColor = oldBackgroundColor;
  }, 1000);
}

function scrollLoadedBlockIntoView(targetBlockId) {
  const targetElement = getBlockElement(targetBlockId);

  if (!targetElement) {
    console.log("targetElement is", targetElement);
    return;
  }

  const targetElementRect = targetElement.getBoundingClientRect();
  const distance = targetElementRect.top - curMainRect.top;
  // console.log("targetElementRect", targetElementRect, targetElementRect.top);
  // console.log("curMainRect", curMainRect, curMainRect.top);
  // console.log("distance", distance);
  curMainBox.scrollTop = curMainBox.scrollTop + distance;

  setTimeout(() => {
    setElementHighlight(targetElement);
  }, 10);
}

function scrollUnloadedBlockIntoView(targetBlockId) {
  const now = Date.now();
  const step = 400;

  let scrollTimer = null;
  let loadingTimer = null;

  let lastScrollTop = 0;

  startTimer();
  function startTimer() {
    scrollTimer = setInterval(() => {
      const targetElement = getBlockElement(targetBlockId);
      if (!targetElement) {
        // console.log("targetElement dom 未加载");

        // console.log(
        //   "firstLoadingElementIsVisible",
        //   firstLoadingElementIsVisible()
        // );

        if (firstLoadingElementIsVisible()) {
          clearInterval(scrollTimer);

          loadingTimer = setInterval(() => {
            console.log("loadingTimer function");

            if (!firstLoadingElementIsVisible()) {
              clearInterval(loadingTimer);
              startTimer();
            }
          }, 0);
        } else {
          curMainBox.scrollTop += step;

          // 折叠targetBlock的父级后，重新进入当前页面，滚动时block加载不出来，停在这里
          if (curMainBox.scrollTop === lastScrollTop) {
            curMainBox.scrollTop -= 1;
          }

          lastScrollTop = curMainBox.scrollTop;
        }
      } else {
        // console.log("targetElement dom 已加载");

        clearInterval(scrollTimer);
        scrollLoadedBlockIntoView(targetBlockId);
        console.log("scroll To Target 3 time", (Date.now() - now) / 1000);
      }
    }, 10);
  }
}

function copyToClipboard(value) {
  const doc = top.document;
  const element = doc.createElement("textarea");

  doc.body.appendChild(element);
  element.value = value;
  element.select();

  if (doc.execCommand) {
    doc.execCommand("copy");
    doc.body.removeChild(element);
    return true;
  }

  doc.body.removeChild(element);
  return false;
}

function setAnchorRenderer() {
  const anchorType = "ls-save-scrollbar-position-anchor";

  // 注册 block 中的自定义渲染内容 {{renderer anchorType, 64b2691b-c7b2-4d76-bd71-32f87d86b6ab}}
  logseq.App.onMacroRendererSlotted(async ({ slot, payload }) => {
    // console.log("slot", slot);
    // console.log("payload", payload);

    const rendered = top.document.getElementById(slot)?.childElementCount;
    // 同一个 block 中，防止重复渲染
    if (rendered) {
      return;
    }

    const currentBlockId = payload.uuid;
    const [type, targetBlockId] = payload.arguments;
    // const showText = `anchor: ${targetBlockId.slice(-6)}`;
    const showText = `anchor`;

    if (type !== anchorType) {
      return;
    }

    logseq.provideUI({
      // 如果 key 相同，后面的会覆盖前面的，导致不同 block 中只能渲染出一个，所以需要加上 slot
      key: `anchor-button-${slot}`,
      slot,
      template: `
        <button 
          style="border:1px solid #ddd; border-radius: 5px; padding: 0 6px;"
          data-on-click="goToAnchorTarget"
          data-current-block-id="${currentBlockId}"
          data-target-block-id="${targetBlockId}"
        >${showText}</button>
      `,
    });
  });

  // 注册 block context menu
  // logseq.Editor.registerBlockContextMenuItem(
  //   "Save Scrollbar Position: Copy anchor link",
  //   async (params) => {
  //     // console.log("params", params);
  //
  //     const blockId = params.uuid;
  //     const customRendererText = `((${blockId})) {{renderer ${anchorType}, ${blockId}}}`;
  //
  //     if (copyToClipboard(customRendererText)) {
  //       logseq.App.showMsg("Copy success");
  //     }
  //   }
  // );
}

/**
 * entry
 */
async function main() {
  console.log("LOGSEQ_SAVE_SCROLLBAR_POSITION_PLUGIN load");
  // logseq.App.showMsg("❤️ Message from Hello World Plugin :)");
  logseq.App.onRouteChanged(handleRouteChange);

  curPageId = await getPageId();
  curPageType = getPageType();

  // getMainBox().addEventListener("scroll", saveScrollPosition);
  scrollPageReady(async function () {
    curMainBox = getMainBox();
    curMainRect = curMainBox.getBoundingClientRect();

    // console.log("---scrollPage Ready---first", curPageType);

    initScrollEvent();
  });

  setTimeout(() => {
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

    setAnchorRenderer();
  }, 10);

  logseq.beforeunload(handleUnload);
}

logseq.ready(main).catch(console.error);
