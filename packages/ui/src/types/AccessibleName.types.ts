/**
 * Discriminated union enforcing that a component has an accessible name. Apply to
 * interactive primitives that don't accept a child label — Select, Slider, Switch,
 * RadioGroup, Section, Carousel, etc. — so the type system rejects unlabelled instances
 * at compile time.
 *
 * Use as an intersection with the component's own props:
 *
 *     type SwitchProps = Omit<RadixSwitchProps, 'aria-label' | 'aria-labelledby'> & AccessibleName;
 *
 * Consumers then pick one:
 *
 *     <Switch aria-label="Dark mode" />
 *     <Switch aria-labelledby="dark-mode-heading" />
 */
export type AccessibleName = { 'aria-label': string } | { 'aria-labelledby': string };
