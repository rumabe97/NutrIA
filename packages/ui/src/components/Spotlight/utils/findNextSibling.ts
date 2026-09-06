/** Walks forward through siblings until one matches `selector`. */
export function findNextSibling(el: Element, selector: string): Element | undefined {
  let sibling = el.nextElementSibling;

  while (sibling) {
    if (sibling.matches(selector)) {
      return sibling;
    }

    sibling = sibling.nextElementSibling;
  }

  return undefined;
}
