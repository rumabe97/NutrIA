import * as AspectRatioPrimitive from '@radix-ui/react-aspect-ratio';

export interface AspectRatioProps extends AspectRatioPrimitive.AspectRatioProps {}

export function AspectRatio(props: AspectRatioProps) {
  return <AspectRatioPrimitive.Root {...props} />;
}
