/** Walks backward through siblings until one matches `selector`. */
export function findPreviousSibling(el: Element, selector: string): Element | undefined {
  let sibling = el.previousElementSibling;

  while (sibling) {
    if (sibling.matches(selector)) {
      return sibling;
    }

    sibling = sibling.previousElementSibling;
  }

  return undefined;
}
