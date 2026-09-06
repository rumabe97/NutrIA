import { cloneElement, isValidElement } from 'react';

import type { ReactElement, ReactNode } from 'react';

interface RenderableType {
  render?: (props: Record<string, unknown>) => ReactElement;
}

function renderChildren(children: ReactElement<Record<string, unknown>>): ReactElement {
  const childrenType = children.type as ((props: Record<string, unknown>) => ReactElement) | RenderableType;

  if (typeof childrenType === 'function') {
    return childrenType(children.props);
  }

  if (typeof childrenType === 'object' && childrenType !== null && 'render' in childrenType && typeof childrenType.render === 'function') {
    return childrenType.render(children.props);
  }

  return children;
}

/**
 * Implements `asChild` for slot-like composition. When `asChild` is true and `children` is a
 * single element, the element is cloned with `render(grandchildren)` wired in — letting the
 * caller swap the rendered tag while still letting Spotlight inject its own internal markup.
 *
 * TODO(react-19-ref-as-prop): the `(childElement as ...).ref` read below uses the **legacy**
 * `element.ref` property, which React 19 has deprecated. The new home for refs on JSX
 * elements is `element.props.ref` (ref-as-prop). React 19 currently still populates the
 * legacy `.ref` field for backward compatibility — that's why this keeps working — but in
 * a future major version (likely React 20) the `.ref` field will be removed and this code
 * will silently drop the ref forward.
 *
 * When that happens (or to remove the technical debt early): replace the legacy read with
 *   const childRef = (childElement.props as { ref?: unknown }).ref;
 * and verify Spotlight's `asChild` consumers still get their refs wired through. Tests in
 * `Spotlight.test.tsx` (specifically the SpotlightItem pointer/click tests) should catch
 * a regression because they depend on the inner div ref being attached.
 *
 * Reference: https://react.dev/blog/2024/12/05/react-19#ref-as-a-prop
 */
export function slottableWithNestedChildren(
  { asChild, children }: { asChild?: boolean; children?: ReactNode },
  render: (child: ReactNode) => ReactElement
): ReactElement {
  if (asChild && isValidElement(children)) {
    const childElement = children as ReactElement<Record<string, unknown>>;
    const childProps = childElement.props ?? {};
    const grandchildren = (childProps as { children?: ReactNode }).children;
    // Legacy ref read — see TODO above. Switch to `childProps.ref` once we're ready to drop
    // React <19 compat (or once React removes the back-compat shim).
    const childRef = (childElement as unknown as { ref?: unknown }).ref;

    return cloneElement(renderChildren(childElement), { ref: childRef } as Record<string, unknown>, render(grandchildren));
  }

  return render(children);
}
