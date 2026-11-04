/**
 * Viewport rects of characters [startIndex, endIndex) inside an input/textarea,
 * computed with a hidden mirror <div> that copies the field's text layout.
 */
export function getTextareaCharacterRects(
  element: HTMLTextAreaElement | HTMLInputElement,
  startIndex: number,
  endIndex: number
): DOMRect[] {
  const text = element.value;
  if (startIndex < 0 || endIndex > text.length || startIndex >= endIndex) {
    return [];
  }

  const isInput = element.tagName.toLowerCase() === "input";
  const computed = window.getComputedStyle(element);
  const elemRect = element.getBoundingClientRect();

  const mirror = document.createElement("div");
  mirror.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    visibility: hidden;
    pointer-events: none;
    z-index: -9999;
    box-sizing: ${computed.boxSizing};
    font-family: ${computed.fontFamily};
    font-size: ${computed.fontSize};
    font-weight: ${computed.fontWeight};
    font-style: ${computed.fontStyle};
    line-height: ${computed.lineHeight};
    letter-spacing: ${computed.letterSpacing};
    word-spacing: ${computed.wordSpacing};
    text-transform: ${computed.textTransform};
    text-indent: ${computed.textIndent};
    tab-size: ${computed.tabSize};
    padding-top: ${computed.paddingTop};
    padding-right: ${computed.paddingRight};
    padding-bottom: ${computed.paddingBottom};
    padding-left: ${computed.paddingLeft};
    border-top-width: ${computed.borderTopWidth};
    border-right-width: ${computed.borderRightWidth};
    border-bottom-width: ${computed.borderBottomWidth};
    border-left-width: ${computed.borderLeftWidth};
    border-style: solid;
    white-space: ${isInput ? "pre" : computed.whiteSpace};
    word-wrap: ${isInput ? "normal" : computed.wordWrap};
    word-break: ${isInput ? "normal" : computed.wordBreak};
    overflow-wrap: ${isInput ? "normal" : computed.overflowWrap};
    width: ${element.clientWidth}px;
    height: auto;
    overflow: hidden;
  `;

  const textNode = document.createTextNode(text);
  mirror.appendChild(textNode);
  document.body.appendChild(mirror);

  const mirrorRect = mirror.getBoundingClientRect();
  const range = document.createRange();
  range.setStart(textNode, startIndex);
  range.setEnd(textNode, endIndex);
  const clientRects = Array.from(range.getClientRects());
  document.body.removeChild(mirror);

  const borderLeft = parseFloat(computed.borderLeftWidth) || 0;
  const borderTop = parseFloat(computed.borderTopWidth) || 0;

  const visibleTop = elemRect.top + borderTop;
  const visibleBottom = visibleTop + element.clientHeight;
  const visibleLeft = elemRect.left + borderLeft;
  const visibleRight = visibleLeft + element.clientWidth;

  const finalRects: DOMRect[] = [];

  for (const r of clientRects) {
    const relX = r.left - mirrorRect.left;
    const relY = r.top - mirrorRect.top;

    const actualLeft = elemRect.left + borderLeft + relX - element.scrollLeft;
    const actualTop = elemRect.top + borderTop + relY - element.scrollTop;
    const actualWidth = r.width;
    const actualHeight = r.height;

    // Clip rects outside visible scroll boundary
    if (
      actualTop + actualHeight < visibleTop ||
      actualTop > visibleBottom ||
      actualLeft + actualWidth < visibleLeft ||
      actualLeft > visibleRight
    ) {
      continue;
    }

    finalRects.push(new DOMRect(actualLeft, actualTop, actualWidth, actualHeight));
  }

  return finalRects;
}
